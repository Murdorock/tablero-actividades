let puntosBase = [];
let rutasGeneradas = [];
let lastRouteStartPoint = null;
let routesMap = null;
let routesMapLayerGroup = null;
let selectedRouteFilterIndex = null;

const MAX_ROWS_PREVIEW = 100;
const DEFAULT_MOTO_SPEED_KMH = 30;
const ALLOWED_SERVICE_MINUTES = [2, 5, 10, 15];
const ALLOWED_TARGET_ROUTE_HOURS = [5, 6, 7, 8];
const ROUTE_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#f43f5e', '#a855f7', '#14b8a6', '#ef4444', '#84cc16'];
const MAX_GOOGLE_MAPS_WAYPOINTS = 23;
const TARGET_REBALANCE_ITERATIONS = 80;
const TARGET_ROUTE_TOLERANCE_MIN = 30;

// Peso de compacidad geografica frente al criterio de tiempo.
// Mas alto = se prioriza agrupar puntos cercanos aunque se sacrifiquen
// algunos minutos de diferencia contra el objetivo. Mas bajo = se prioriza
// clavar el tiempo objetivo aunque queden saltos largos.
// El valor se expresa en "minutos equivalentes por km".
const COMPACTNESS_WEIGHT = 8;
// Margen de tiempo que se tolera por encima del objetivo al reasignar por
// compacidad: nunca se acepta superar el objetivo en mas de esto si hay
// alternativa razonable.
const HARD_TIME_OVERFLOW_MIN = 20;
// Factor de "aislamiento": un punto se considera atipico dentro de su ruta si
// su distancia al vecino mas cercano de la MISMA ruta es mayor que este factor
// multiplicado por la distancia a su vecino mas cercano en OTRA ruta. Es decir,
// esta mucho mas cerca de otra ruta que de la suya. 1.4 = al menos 40% mas
// cerca de otra ruta. Mas bajo = mas agresivo moviendo puntos.
const OUTLIER_DISTANCE_RATIO = 1.5;
// Numero maximo de pasadas del post-proceso de reasignacion de atipicos.
const OUTLIER_MAX_PASSES = 30;

// --- Sugerencia de rutas adicionales para puntos dispersos ---
// Un salto entre paradas consecutivas se considera "puente lejano" si supera
// este factor por la mediana de saltos de la ruta y ademas supera el minimo
// absoluto en km. Lo que queda tras ese salto se propone como ruta nueva.
const SPLIT_GAP_MEDIAN_FACTOR = 2.5;
const SPLIT_GAP_MIN_KM = 1.5;
// Un sub-grupo aislado se separa solo si tiene al menos esta cantidad de
// paradas y su distancia al nucleo de la ruta es significativa.
const SPLIT_MIN_GROUP_STOPS = 1;
const SPLIT_MIN_ISOLATION_KM = 1.5;
// Maximo de rutas adicionales que se sugeriran en una sola generacion.
const SPLIT_MAX_NEW_ROUTES = 6;

document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    initializeRoutesMap();
    renderInputTable();
    renderSummary();
    renderRoutesMap();
    renderRoutesTable();
});

function bindEvents() {
    const btnProcesar = document.getElementById('btn-procesar-pegado');
    const btnSupabase = document.getElementById('btn-cargar-supabase');
    const btnLimpiar = document.getElementById('btn-limpiar-datos');
    const btnGenerar = document.getElementById('btn-generar-rutas');
    const btnExportar = document.getElementById('btn-exportar');
    const summaryContainer = document.getElementById('summaryContainer');
    const mapLegend = document.getElementById('mapLegend');

    btnProcesar.addEventListener('click', handlePasteInput);
    btnSupabase.addEventListener('click', loadFromSupabase);
    btnLimpiar.addEventListener('click', clearAllData);
    btnGenerar.addEventListener('click', generateRoutes);
    btnExportar.addEventListener('click', exportRoutesCsv);

    if (summaryContainer) {
        summaryContainer.addEventListener('click', (event) => {
            const trigger = event.target.closest('[data-open-maps-route]');
            if (!trigger) return;

            const routeIndex = Number.parseInt(trigger.getAttribute('data-route-index'), 10);
            if (!Number.isInteger(routeIndex)) return;

            openRouteInGoogleMaps(routeIndex);
        });
    }

    if (mapLegend) {
        mapLegend.addEventListener('click', (event) => {
            const legendItem = event.target.closest('[data-map-route-index]');
            if (!legendItem) return;

            const routeIndex = Number.parseInt(legendItem.getAttribute('data-map-route-index'), 10);
            if (!Number.isInteger(routeIndex)) return;

            toggleMapRouteFilter(routeIndex);
        });
    }
}

function handlePasteInput() {
    const textarea = document.getElementById('entrada-datos');
    const delimiterMode = document.getElementById('delimitador-select').value;
    const raw = textarea.value || '';

    if (!raw.trim()) {
        showMessage('No hay datos para procesar.', 'error');
        return;
    }

    const parsed = parseRows(raw, delimiterMode);
    if (!parsed.length) {
        showMessage('No se encontraron filas validas (direccion + coordenada).', 'error');
        return;
    }

    puntosBase = deduplicatePoints(parsed);
    rutasGeneradas = [];
    refreshAllViews();
    showMessage(`Datos cargados: ${puntosBase.length} puntos.`, 'success');
}

async function loadFromSupabase() {
    try {
        const { data, error } = await supabase
            .from('coordenadas')
            .select('direccion, coordenada')
            .not('coordenada', 'is', null)
            .limit(5000);

        if (error) throw error;

        const rows = (data || []).map((row) => ({
            direccion: (row.direccion || '').trim(),
            coordenada: (row.coordenada || '').trim()
        }));

        const parsed = [];
        rows.forEach((row) => {
            const coord = parseCoordinate(row.coordenada);
            if (!coord) return;
            parsed.push({
                direccion: row.direccion || '(Sin direccion)',
                lat: coord.lat,
                lng: coord.lng,
                coordenada: `${coord.lat} ${coord.lng}`
            });
        });

        if (!parsed.length) {
            showMessage('No se encontraron coordenadas validas en Supabase.', 'error');
            return;
        }

        puntosBase = deduplicatePoints(parsed);
        rutasGeneradas = [];
        refreshAllViews();
        showMessage(`Coordenadas cargadas desde Supabase: ${puntosBase.length}.`, 'success');
    } catch (error) {
        handleError(error, 'al cargar coordenadas desde Supabase');
    }
}

function clearAllData() {
    puntosBase = [];
    rutasGeneradas = [];
    lastRouteStartPoint = null;
    selectedRouteFilterIndex = null;
    document.getElementById('entrada-datos').value = '';
    refreshAllViews();
}

function parseRows(raw, delimiterMode = 'auto') {
    const lines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (!lines.length) return [];

    const chosenDelimiter = pickDelimiter(lines[0], delimiterMode);
    const parsed = [];

    lines.forEach((line, index) => {
        const parts = splitLine(line, chosenDelimiter);
        if (parts.length < 2) return;

        const first = String(parts[0] || '').trim();
        const second = String(parts[1] || '').trim();

        // Omitir encabezado si coincide con nombres esperados.
        if (index === 0 && isHeaderRow(first, second)) return;

        const coord = parseCoordinate(second);
        if (!coord) return;

        parsed.push({
            direccion: first || '(Sin direccion)',
            lat: coord.lat,
            lng: coord.lng,
            coordenada: `${coord.lat} ${coord.lng}`
        });
    });

    return parsed;
}

function pickDelimiter(line, mode) {
    if (mode === 'tab') return '\t';
    if (mode === 'semicolon') return ';';
    if (mode === 'comma') return ',';

    if (line.includes('\t')) return '\t';
    if (line.includes(';')) return ';';
    if (line.includes(',')) return ',';
    return '\t';
}

function splitLine(line, delimiter) {
    if (delimiter === ',') {
        // Protege el split por coma para no romper coordenadas con coma decimal separada.
        const tabOrSemi = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
        if (tabOrSemi !== ',') {
            return line.split(tabOrSemi).map((part) => part.trim());
        }
        return line.split(',').map((part) => part.trim());
    }
    return line.split(delimiter).map((part) => part.trim());
}

function isHeaderRow(colA, colB) {
    const first = normalizeText(colA);
    const second = normalizeText(colB);
    const hasDireccion = first.includes('direccion') || first.includes('direccion');
    const hasCoord = second.includes('coordenada') || second.includes('coord');
    return hasDireccion && hasCoord;
}

function parseCoordinate(value) {
    if (!value) return null;

    const cleaned = String(value)
        .trim()
        .replace(/[()]/g, '')
        .replace(/\s+/g, ' ');

    const regex = /(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/;
    const match = cleaned.match(regex);
    if (!match) return null;

    const lat = Number.parseFloat(match[1]);
    const lng = Number.parseFloat(match[2]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

    return {
        lat: Number(lat.toFixed(7)),
        lng: Number(lng.toFixed(7))
    };
}

function deduplicatePoints(points) {
    const map = new Map();

    points.forEach((point) => {
        const key = `${point.lat}|${point.lng}`;
        const direccion = point.direccion || '(Sin direccion)';

                if (map.has(key)) {
            const existing = map.get(key);
            existing.count += 1;
            // Conservar TODAS las direcciones originales tal cual se pegaron,
            // incluidas las coincidentes exactas (p.ej. apendices 201, 301,
            // 401 que comparten la misma coordenada). Asi el exporte puede
            // emitir una fila por cada registro pegado.
            existing.direcciones.push(direccion);
        } else {
            map.set(key, {
                ...point,
                count: 1,
                // Lista de direcciones originales asociadas a este punto.
                direcciones: [direccion]
            });
        }
    });

    // Garantizar que count coincida con el numero de actas reales, y que
    // direcciones tenga al menos la direccion base.
    return Array.from(map.values()).map((p) => ({
        ...p,
        direcciones: p.direcciones && p.direcciones.length ? p.direcciones : [p.direccion || '(Sin direccion)']
    }));
}

function generateRoutes() {
    if (!puntosBase.length) {
        showMessage('Primero carga coordenadas para generar rutas.', 'error');
        return;
    }

    const totalPeopleRaw = Number.parseInt(document.getElementById('personas-input').value, 10);
    if (!Number.isInteger(totalPeopleRaw) || totalPeopleRaw <= 0) {
        showMessage('La cantidad de personas debe ser mayor que cero.', 'error');
        return;
    }

    const totalPeople = Math.min(totalPeopleRaw, puntosBase.length);
    if (totalPeopleRaw > puntosBase.length) {
        showMessage(`Se ajusto a ${totalPeople} personas porque hay menos puntos que personas.`, 'info');
    }

    const startPoint = parseStartPoint();
    lastRouteStartPoint = startPoint ? { ...startPoint } : null;
    const routeParams = parseRouteParams();
    const clusters = clusterBalanced(puntosBase, totalPeople);

    const orderedGroups = clusters.map((cluster) => orderRouteNearestNeighbor(cluster, startPoint));

    const initialRoutes = orderedGroups.map((stops, index) =>
        createRouteFromStops(stops, index, startPoint, routeParams)
    );

        rutasGeneradas = optimizeRoutesForTargetDuration(initialRoutes, startPoint, routeParams);

    // Post-proceso: compactar las rutas geograficamente. Mueve puntos "limite"
    // (lejanos del nucleo de su ruta) hacia la ruta vecina mas cercana cuando
    // eso reduce la distancia total y NO excede el tiempo objetivo de la ruta
    // receptora. Elimina los saltos largos manteniendo el control de tiempo.
    rutasGeneradas = compactRoutesGeographically(rutasGeneradas, startPoint, routeParams);

    // Post-proceso 2: reasignar puntos "atipicos" (aislados de su propia ruta
    // pero cercanos a otra ruta) a la ruta geograficamente correcta. Ataca
    // casos como "pocos puntos en un municipio suelto dentro de rutas de otro
    // municipio", siempre sin exceder el tiempo objetivo de la ruta receptora.
    rutasGeneradas = reassignOutlierPoints(rutasGeneradas, startPoint, routeParams);

    // Post-proceso 3 (opcional): si el usuario lo habilita, sugerir rutas
    // ADICIONALES para grupos de puntos que siguen muy alejados del resto de
    // su ruta. Separa esos sub-grupos en nuevas rutas ("Persona N+1") para que
    // ninguna persona tenga que recorrer saltos largos. Respeta el tiempo
    // objetivo: si un sub-grupo aislado admite su propia ruta, se sugiere.
    const splitOutliers = document.getElementById('split-outliers-checkbox');
    if (splitOutliers && splitOutliers.checked) {
        rutasGeneradas = suggestSplitRoutes(rutasGeneradas, startPoint, routeParams);
    }

    // Re-compactar tras la reasignacion para reacomodar ordenes y distancias.
    rutasGeneradas = compactRoutesGeographically(rutasGeneradas, startPoint, routeParams);

    renderSummary();
    renderRoutesMap();
    renderRoutesTable();

    document.getElementById('btn-exportar').disabled = rutasGeneradas.length === 0;

    const totalKmGlobal = rutasGeneradas.reduce((acc, route) => acc + route.totalKm, 0);
    const totalMinutesGlobal = rutasGeneradas.reduce((acc, route) => acc + route.totalMinutes, 0);
    const avgDeviation = rutasGeneradas.length
        ? rutasGeneradas.reduce((acc, route) => acc + Math.abs(route.deviationMinutes || 0), 0) / rutasGeneradas.length
        : 0;

    showMessage(
        `Rutas generadas: ${rutasGeneradas.length} | Distancia aprox: ${totalKmGlobal.toFixed(2)} km | Tiempo total: ${formatDuration(totalMinutesGlobal)} | Desviacion prom.: ${formatDuration(avgDeviation)}`,
        'success'
    );
}

function parseRouteParams() {
    const speedInput = document.getElementById('velocidad-moto');
    const serviceSelect = document.getElementById('tiempo-punto-select');
    const targetSelect = document.getElementById('tiempo-objetivo-ruta');

    const speedRaw = Number.parseFloat(speedInput ? speedInput.value : String(DEFAULT_MOTO_SPEED_KMH));
    const speedKmh = Number.isFinite(speedRaw) && speedRaw > 0 ? speedRaw : DEFAULT_MOTO_SPEED_KMH;

    if (speedInput && (!Number.isFinite(speedRaw) || speedRaw <= 0)) {
        speedInput.value = String(DEFAULT_MOTO_SPEED_KMH);
        showMessage(`Velocidad invalida. Se usa ${DEFAULT_MOTO_SPEED_KMH} km/h.`, 'info');
    }

    const serviceRaw = Number.parseInt(serviceSelect ? serviceSelect.value : '5', 10);
    const serviceMinutes = ALLOWED_SERVICE_MINUTES.includes(serviceRaw) ? serviceRaw : 5;

    if (serviceSelect && !ALLOWED_SERVICE_MINUTES.includes(serviceRaw)) {
        serviceSelect.value = '5';
    }

    const targetHoursRaw = Number.parseInt(targetSelect ? targetSelect.value : '6', 10);
    const targetRouteHours = ALLOWED_TARGET_ROUTE_HOURS.includes(targetHoursRaw) ? targetHoursRaw : 6;
    const targetRouteMinutes = targetRouteHours * 60;

    if (targetSelect && !ALLOWED_TARGET_ROUTE_HOURS.includes(targetHoursRaw)) {
        targetSelect.value = '6';
    }

    return {
        speedKmh,
        serviceMinutes,
        targetRouteHours,
        targetRouteMinutes
    };
}

function createRouteFromStops(stops, index, startPoint, routeParams) {
    const orderedStops = orderRouteNearestNeighbor(stops, startPoint);
    const metrics = buildRouteMetrics(
        orderedStops,
        startPoint,
        routeParams.speedKmh,
        routeParams.serviceMinutes
    );

    const deviationMinutes = Number((metrics.totalMinutes - routeParams.targetRouteMinutes).toFixed(1));

    return {
        persona: `Persona ${index + 1}`,
        totalParadas: metrics.stops.length,
        totalKm: metrics.totalDistanceKm,
        totalTravelMinutes: metrics.totalTravelMinutes,
        totalServiceMinutes: metrics.totalServiceMinutes,
        totalMinutes: metrics.totalMinutes,
        speedKmh: routeParams.speedKmh,
        serviceMinutes: routeParams.serviceMinutes,
        targetRouteHours: routeParams.targetRouteHours,
        targetRouteMinutes: routeParams.targetRouteMinutes,
        deviationMinutes,
        paradas: metrics.stops
    };
}

function optimizeRoutesForTargetDuration(initialRoutes, startPoint, routeParams) {
    if (!Array.isArray(initialRoutes) || initialRoutes.length < 2) {
        return initialRoutes;
    }

    let stopGroups = initialRoutes.map((route) => route.paradas.map((stop) => toBaseStop(stop)));

    for (let iteration = 0; iteration < TARGET_REBALANCE_ITERATIONS; iteration += 1) {
        const currentRoutes = stopGroups.map((group, idx) => createRouteFromStops(group, idx, startPoint, routeParams));
        const target = routeParams.targetRouteMinutes;

        let mostOverIdx = 0;
        let mostUnderIdx = 0;
        let maxDelta = Number.NEGATIVE_INFINITY;
        let minDelta = Number.POSITIVE_INFINITY;

        currentRoutes.forEach((route, idx) => {
            const delta = route.totalMinutes - target;
            if (delta > maxDelta) {
                maxDelta = delta;
                mostOverIdx = idx;
            }
            if (delta < minDelta) {
                minDelta = delta;
                mostUnderIdx = idx;
            }
        });

        // Si ya estamos dentro de tolerancia o no hay a quien mover, terminar.
        if (maxDelta <= TARGET_ROUTE_TOLERANCE_MIN || mostOverIdx === mostUnderIdx) {
            return currentRoutes;
        }

        if (stopGroups[mostOverIdx].length <= 1) {
            return currentRoutes;
        }

        const currentCost = totalCompactTimeCost(currentRoutes, target, startPoint, routeParams);
        let bestCost = currentCost;
        let bestGroups = null;
        let bestOverflow = Number.POSITIVE_INFINITY;

        // Evaluar mover CADA punto de la ruta mas cargada hacia la mas vacia.
        // Se penaliza tanto el desbalance de tiempo como la distancia geografica
        // del punto respecto a la ruta destino, para evitar saltos largos.
        stopGroups[mostOverIdx].forEach((candidateStop, stopIdx) => {
            const nextGroups = stopGroups.map((group) => group.slice());
            nextGroups[mostOverIdx].splice(stopIdx, 1);
            nextGroups[mostUnderIdx].push(candidateStop);

            const candidateRoutes = nextGroups.map((group, idx) => createRouteFromStops(group, idx, startPoint, routeParams));
            const candidateCost = totalCompactTimeCost(candidateRoutes, target, startPoint, routeParams);

            // Overflow maximo por encima del objetivo entre las dos rutas tocadas.
            const overflow = Math.max(
                candidateRoutes[mostOverIdx].totalMinutes - target,
                candidateRoutes[mostUnderIdx].totalMinutes - target
            );

            // Descartar movimientos que revienten el objetivo de tiempo.
            if (overflow > HARD_TIME_OVERFLOW_MIN) {
                return;
            }

            // Preferir costo combinado menor; ante empate, menor overflow de tiempo.
            if (candidateCost < bestCost - 1e-6 || (Math.abs(candidateCost - bestCost) <= 1e-6 && overflow < bestOverflow)) {
                bestCost = candidateCost;
                bestGroups = nextGroups;
                bestOverflow = overflow;
            }
        });

        if (!bestGroups) {
            return currentRoutes;
        }

        stopGroups = bestGroups;
    }

    return stopGroups.map((group, idx) => createRouteFromStops(group, idx, startPoint, routeParams));
}

/**
 * Costo combinado por ruta: desbalance de tiempo vs objetivo + penalizacion
 * de distancia geografica total (ponderada). Un costo menor indica rutas
 * mas "pegadas" al objetivo temporal y mas compactas geograficamente.
 */
function totalCompactTimeCost(routes, targetMinutes, startPoint, routeParams) {
    return routes.reduce((acc, route) => {
        const timeDelta = Math.abs(route.totalMinutes - targetMinutes);
        const distancePenalty = route.totalKm * COMPACTNESS_WEIGHT;
        return acc + timeDelta + distancePenalty;
    }, 0);
}

/**
 * Post-proceso de compactitud geografica entre rutas.
 *
 * Objetivo: agrupar puntos cercanos y eliminar los "saltos largos" (puntos
 * pocos y lejanos dentro de una ruta). Para cada punto de cada ruta evalúa
 * moverlo a otra ruta si:
 *   1. Reduce la distancia total del sistema (costo combinado menor).
 *   2. La ruta receptora NO excede el objetivo de tiempo (con margen duro).
 *   3. La ruta donante sigue teniendo al menos 1 parada.
 *
 * Se repite hasta agotar mejoras o alcanzar un máximo de pasadas.
 */
function compactRoutesGeographically(routes, startPoint, routeParams) {
    if (!Array.isArray(routes) || routes.length < 2) {
        return routes;
    }

    const target = routeParams.targetRouteMinutes;

    // Trabajamos con grupos de paradas "base" (sin metricas calculadas).
    let stopGroups = routes.map((route) => route.paradas.map((stop) => toBaseStop(stop)));

    const maxPasses = 25;
    for (let pass = 0; pass < maxPasses; pass += 1) {
        const currentRoutes = stopGroups.map((group, idx) => createRouteFromStops(group, idx, startPoint, routeParams));
        const currentCost = totalCompactTimeCost(currentRoutes, target, startPoint, routeParams);

        let bestCost = currentCost;
        let bestMove = null; // { fromRoute, toRoute, stopIndex }

        // Evaluar mover cada punto de cada ruta hacia cualquier otra ruta.
        for (let fromIdx = 0; fromIdx < stopGroups.length; fromIdx += 1) {
            // Nunca vaciar una ruta por completo.
            if (stopGroups[fromIdx].length <= 1) continue;

            for (let stopIdx = 0; stopIdx < stopGroups[fromIdx].length; stopIdx += 1) {
                const candidateStop = stopGroups[fromIdx][stopIdx];

                for (let toIdx = 0; toIdx < stopGroups.length; toIdx += 1) {
                    if (toIdx === fromIdx) continue;

                    const nextGroups = stopGroups.map((group) => group.slice());
                    nextGroups[fromIdx].splice(stopIdx, 1);
                    nextGroups[toIdx].push(candidateStop);

                    const candidateRoutes = nextGroups.map((group, idx) =>
                        createRouteFromStops(group, idx, startPoint, routeParams)
                    );

                    // La ruta receptora no debe reventar el objetivo de tiempo.
                    if (candidateRoutes[toIdx].totalMinutes > target + HARD_TIME_OVERFLOW_MIN) {
                        continue;
                    }

                    const candidateCost = totalCompactTimeCost(candidateRoutes, target, startPoint, routeParams);

                    // Solo aceptar si mejora el costo global de forma significativa
                    // (evita oscilaciones y movimientos triviales).
                    if (candidateCost < bestCost - 1e-3) {
                        bestCost = candidateCost;
                        bestMove = { fromIdx, toIdx, stopIdx };
                    }
                }
            }
        }

        if (!bestMove) {
            break;
        }

        // Aplicar la mejor mejora encontrada y continuar.
        const movedStop = stopGroups[bestMove.fromIdx].splice(bestMove.stopIdx, 1)[0];
        stopGroups[bestMove.toIdx].push(movedStop);
    }

        return stopGroups.map((group, idx) => createRouteFromStops(group, idx, startPoint, routeParams));
}

/**
 * Reasigna puntos "atipicos" a la ruta geograficamente correcta.
 *
 * Un punto es atipico dentro de su ruta si esta claramente mas cerca de otra
 * ruta que de la suya. Esto resuelve casos como "unas pocas paradas de un
 * municipio quedaron dentro del grupo de otro municipio".
 *
 * Reglas:
 *   1. Solo se evalua mover un punto si su vecino mas cercano en OTRA ruta
 *      esta a menor distancia que su vecino mas cercano en SU propia ruta,
 *      superando el ratio OUTLIER_DISTANCE_RATIO.
 *   2. La ruta receptora NO debe superar el objetivo de tiempo (margen duro).
 *   3. La ruta donante conserva al menos 1 parada.
 *   4. Se mueve solo al destino geograficamente mas cercano.
 *
 * Cada pasada mueve el "mejor" atipico (mayor reduccion de distancia) y se
 * repite para reacomodar. Converge cuando no hay mas atipicos movibles.
 */
function reassignOutlierPoints(routes, startPoint, routeParams) {
    if (!Array.isArray(routes) || routes.length < 2) {
        return routes;
    }

    const target = routeParams.targetRouteMinutes;
    const feasibleOverflow = target + HARD_TIME_OVERFLOW_MIN;

    for (let pass = 0; pass < OUTLIER_MAX_PASSES; pass += 1) {
        const stopGroups = routes.map((route) => route.paradas.map((stop) => toBaseStop(stop)));
        let bestMove = null;
        let bestGain = 0; // ganancia de distancia (km) al mover

        for (let fromIdx = 0; fromIdx < stopGroups.length; fromIdx += 1) {
            const fromGroup = stopGroups[fromIdx];
            if (fromGroup.length <= 1) continue;

            for (let stopIdx = 0; stopIdx < fromGroup.length; stopIdx += 1) {
                const point = fromGroup[stopIdx];

                // Distancia al vecino mas cercano DENTRO de su propia ruta.
                let nearestOwn = Number.POSITIVE_INFINITY;
                for (let k = 0; k < fromGroup.length; k += 1) {
                    if (k === stopIdx) continue;
                    const d = haversineKm(point, fromGroup[k]);
                    if (d < nearestOwn) nearestOwn = d;
                }

                // Buscar la ruta con el vecino mas cercano fuera de su ruta.
                let bestToIdx = -1;
                let nearestOther = Number.POSITIVE_INFINITY;
                for (let toIdx = 0; toIdx < stopGroups.length; toIdx += 1) {
                    if (toIdx === fromIdx) continue;
                    const group = stopGroups[toIdx];
                    for (let k = 0; k < group.length; k += 1) {
                        const d = haversineKm(point, group[k]);
                        if (d < nearestOther) {
                            nearestOther = d;
                            bestToIdx = toIdx;
                        }
                    }
                }

                if (bestToIdx === -1) continue;

                // ¿Es realmente atipico? Solo si esta mas cerca de otra ruta.
                if (!(nearestOther * OUTLIER_DISTANCE_RATIO < nearestOwn)) {
                    continue;
                }

                // Construir candidato y validar el tiempo de la ruta receptora.
                const nextGroups = stopGroups.map((group) => group.slice());
                nextGroups[fromIdx].splice(stopIdx, 1);
                nextGroups[bestToIdx].push(point);

                const receiver = createRouteFromStops(nextGroups[bestToIdx], bestToIdx, startPoint, routeParams);
                if (receiver.totalMinutes > feasibleOverflow) {
                    continue;
                }

                // Ganancia aproximada: cuanto "salto" se elimina.
                const gain = nearestOwn - nearestOther;
                if (gain > bestGain) {
                    bestGain = gain;
                    bestMove = { fromIdx, toIdx: bestToIdx, stopIdx };
                }
            }
        }

        if (!bestMove) {
            break;
        }

        // Aplicar el movimiento sobre las rutas reales y continuar.
        const movedStop = routes[bestMove.fromIdx].paradas.splice(bestMove.stopIdx, 1)[0];
        routes[bestMove.toIdx].paradas.push(movedStop);

        // Recalcular metricas y orden de las rutas afectadas.
        routes[bestMove.fromIdx] = createRouteFromStops(
            routes[bestMove.fromIdx].paradas.map((s) => toBaseStop(s)),
            bestMove.fromIdx,
            startPoint,
            routeParams
        );
        routes[bestMove.toIdx] = createRouteFromStops(
            routes[bestMove.toIdx].paradas.map((s) => toBaseStop(s)),
            bestMove.toIdx,
            startPoint,
            routeParams
        );
    }

        return routes;
}

/**
 * Sugiere rutas ADICIONALES para grupos de puntos que quedan muy alejados
 * del resto de su ruta.
 *
 * Idea: dentro de una ruta ya ordenada por cercania, se buscan "puentes
 * lejanos": saltos entre paradas consecutivas mucho mayores que lo normal.
 * Lo que queda del otro lado de ese puente se trata como un sub-grupo
 * aislado y, si esta suficientemente lejos y admite su propia ruta sin
 * desbordar el objetivo de tiempo, se separa como una nueva "Persona".
 *
 * Asi evitamos que una persona acumule pocas paradas a distancias muy
 * prolongadas: en su lugar se PROPONE una ruta extra para ese grupo.
 *
 * Devuelve un arreglo de rutas posiblemente mayor que el de entrada.
 */
function suggestSplitRoutes(routes, startPoint, routeParams) {
    if (!Array.isArray(routes) || !routes.length) {
        return routes;
    }

    const target = routeParams.targetRouteMinutes;
    const feasibleOverflow = target + HARD_TIME_OVERFLOW_MIN;

    const result = [];
    let newRoutesCount = 0;

    routes.forEach((route) => {
        const stops = route.paradas.map((stop) => toBaseStop(stop));

        if (stops.length < SPLIT_MIN_GROUP_STOPS + 1 || newRoutesCount >= SPLIT_MAX_NEW_ROUTES) {
            result.push(route);
            return;
        }

        // Distancias entre paradas consecutivas del orden actual.
        const gaps = [];
        for (let i = 1; i < stops.length; i += 1) {
            gaps.push(haversineKm(stops[i - 1], stops[i]));
        }

        const sortedGaps = gaps.slice().sort((a, b) => a - b);
        const median = sortedGaps.length
            ? sortedGaps[Math.floor(sortedGaps.length / 2)]
            : 0;
        const gapThreshold = Math.max(median * SPLIT_GAP_MEDIAN_FACTOR, SPLIT_GAP_MIN_KM);

        // Buscar el puente mas largo que supere el umbral.
        let splitIndex = -1;
        let maxGap = 0;
        for (let i = 0; i < gaps.length; i += 1) {
            if (gaps[i] >= gapThreshold && gaps[i] > maxGap) {
                maxGap = gaps[i];
                splitIndex = i + 1; // el sub-grupo aislado empieza aqui
            }
        }

        if (splitIndex <= 0) {
            result.push(route);
            return;
        }

        const coreStops = stops.slice(0, splitIndex);
        const isolatedStops = stops.slice(splitIndex);

        // Reglas de seguridad: ambos lados deben quedar con paradas.
        if (!coreStops.length || isolatedStops.length < SPLIT_MIN_GROUP_STOPS) {
            result.push(route);
            return;
        }

        // El grupo aislado debe estar realmente lejos del nucleo.
        const isolationDistance = minDistanceBetweenGroups(coreStops, isolatedStops);
        if (isolationDistance < SPLIT_MIN_ISOLATION_KM) {
            result.push(route);
            return;
        }

        // El grupo aislado debe poder ser su propia ruta sin desbordar tiempo.
        const isolatedRoute = createRouteFromStops(
            isolatedStops,
            routes.length + newRoutesCount,
            startPoint,
            routeParams
        );
        if (isolatedRoute.totalMinutes > feasibleOverflow) {
            // Si el aislado es demasiado grande para una ruta propia, no separar.
            result.push(route);
            return;
        }

        // La ruta original (nucleo) tambien debe seguir siendo valida.
        const coreRoute = createRouteFromStops(coreStops, result.length, startPoint, routeParams);
        if (coreRoute.totalMinutes > feasibleOverflow) {
            result.push(route);
            return;
        }

                // Aplicar la separacion: nucleo + nueva ruta sugerida.
        result.push(coreRoute);
        isolatedRoute.suggested = true;
        result.push(isolatedRoute);
        newRoutesCount += 1;
    });

    // Renumerar personas respetando la marca de "sugerida".
    result.forEach((route, idx) => {
        route.persona = route.suggested
            ? `Persona ${idx + 1} (sugerida)`
            : `Persona ${idx + 1}`;
    });

    return result;
}

/**
 * Distancia minima entre cualquier punto de dos grupos (km).
 */
function minDistanceBetweenGroups(groupA, groupB) {
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < groupA.length; i += 1) {
        for (let j = 0; j < groupB.length; j += 1) {
            const d = haversineKm(groupA[i], groupB[j]);
            if (d < min) min = d;
        }
    }
    return min;
}

/**
 * Marca una ruta como sugerida (proveniente de separar puntos dispersos).
 */
function isolateRouteSuggested(route) {
    if (route) {
        route.suggested = true;
    }
    return route;
}

function totalTargetPenalty(routes, targetMinutes) {
    return routes.reduce((acc, route) => {
        const delta = Math.abs(route.totalMinutes - targetMinutes);
        return acc + delta;
    }, 0);
}

function toBaseStop(stop) {
    return {
        direccion: stop.direccion,
        lat: stop.lat,
        lng: stop.lng,
        coordenada: stop.coordenada || `${stop.lat} ${stop.lng}`,
        count: stop.count || 1,
        // Preservar las direcciones originales (apendices con misma coord).
        direcciones: Array.isArray(stop.direcciones) && stop.direcciones.length
            ? stop.direcciones.slice()
            : [stop.direccion || '(Sin direccion)']
    };
}

function buildRouteMetrics(stops, startPoint, speedKmh, serviceMinutes) {
    let previousPoint = startPoint ? { lat: startPoint.lat, lng: startPoint.lng } : null;
    let accumulatedMinutes = 0;
    let totalDistanceKm = 0;
    let totalTravelMinutes = 0;

    const enrichedStops = stops.map((stop, idx) => {
        let segmentDistanceKm = 0;

        if (previousPoint) {
            segmentDistanceKm = haversineKm(previousPoint, stop);
        } else if (idx > 0) {
            segmentDistanceKm = haversineKm(stops[idx - 1], stop);
        }

        const travelMinutes = speedKmh > 0 ? (segmentDistanceKm / speedKmh) * 60 : 0;
        const roundedSegmentKm = Number(segmentDistanceKm.toFixed(2));
        const roundedTravelMinutes = Number(travelMinutes.toFixed(1));
        const stopCount = stop.count || 1;
        const stopServiceMinutes = stopCount * serviceMinutes;

        accumulatedMinutes += roundedTravelMinutes + stopServiceMinutes;
        totalDistanceKm += roundedSegmentKm;
        totalTravelMinutes += roundedTravelMinutes;

        previousPoint = stop;

        return {
            ...stop,
            segmentDistanceKm: roundedSegmentKm,
            travelMinutes: roundedTravelMinutes,
            serviceMinutes: stopServiceMinutes,
            accumulatedMinutes: Number(accumulatedMinutes.toFixed(1))
        };
    });

    const roundedTotalTravelMinutes = Number(totalTravelMinutes.toFixed(1));
    const totalServiceMinutes = enrichedStops.reduce((sum, s) => sum + s.serviceMinutes, 0);

    return {
        stops: enrichedStops,
        totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
        totalTravelMinutes: roundedTotalTravelMinutes,
        totalServiceMinutes,
        totalMinutes: Number((roundedTotalTravelMinutes + totalServiceMinutes).toFixed(1))
    };
}

function parseStartPoint() {
    const latRaw = document.getElementById('inicio-lat').value.trim();
    const lngRaw = document.getElementById('inicio-lng').value.trim();
    if (!latRaw || !lngRaw) return null;

    const lat = Number.parseFloat(latRaw);
    const lng = Number.parseFloat(lngRaw);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        showMessage('Punto de inicio invalido, se ignora para el calculo.', 'info');
        return null;
    }

    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        showMessage('Punto de inicio fuera de rango, se ignora.', 'info');
        return null;
    }

    return { lat, lng };
}

function clusterBalanced(points, k) {
    if (k <= 1) return [points.slice()];

    const centroids = initializeCentroids(points, k);
    let assignments = new Array(points.length).fill(0);

    for (let iteration = 0; iteration < 12; iteration += 1) {
        assignments = assignByNearestCentroid(points, centroids);
        rebalanceAssignments(assignments, points, centroids, k);

        for (let i = 0; i < k; i += 1) {
            const clusterPoints = points.filter((_, idx) => assignments[idx] === i);
            if (!clusterPoints.length) continue;
            centroids[i] = computeCentroid(clusterPoints);
        }
    }

    const clusters = Array.from({ length: k }, () => []);
    points.forEach((point, idx) => {
        const clusterId = assignments[idx] || 0;
        clusters[clusterId].push(point);
    });

    return clusters;
}

function initializeCentroids(points, k) {
    const centroids = [];
    if (!points.length) return centroids;

    centroids.push({ lat: points[0].lat, lng: points[0].lng });

    while (centroids.length < k) {
        let farthestPoint = points[0];
        let maxDistance = -1;

        points.forEach((point) => {
            const nearest = centroids.reduce((minDist, centroid) => {
                const dist = haversineKm(point, centroid);
                return Math.min(minDist, dist);
            }, Number.POSITIVE_INFINITY);

            if (nearest > maxDistance) {
                maxDistance = nearest;
                farthestPoint = point;
            }
        });

        centroids.push({ lat: farthestPoint.lat, lng: farthestPoint.lng });
    }

    return centroids;
}

function assignByNearestCentroid(points, centroids) {
    return points.map((point) => {
        let bestCluster = 0;
        let bestDistance = Number.POSITIVE_INFINITY;

        centroids.forEach((centroid, idx) => {
            const dist = haversineKm(point, centroid);
            if (dist < bestDistance) {
                bestDistance = dist;
                bestCluster = idx;
            }
        });

        return bestCluster;
    });
}

function rebalanceAssignments(assignments, points, centroids, k) {
    const total = points.length;
    const maxSize = Math.ceil(total / k);
    const minSize = Math.floor(total / k);

    const countByCluster = new Array(k).fill(0);
    assignments.forEach((clusterId) => {
        countByCluster[clusterId] += 1;
    });

    const oversized = [];
    const undersized = [];

    countByCluster.forEach((count, clusterId) => {
        if (count > maxSize) oversized.push(clusterId);
        if (count < minSize) undersized.push(clusterId);
    });

    oversized.forEach((clusterId) => {
        while (countByCluster[clusterId] > maxSize && undersized.length) {
            const targetCluster = undersized[0];
            const candidateIndex = findBestTransferPoint(assignments, points, centroids, clusterId, targetCluster);
            if (candidateIndex === -1) break;

            assignments[candidateIndex] = targetCluster;
            countByCluster[clusterId] -= 1;
            countByCluster[targetCluster] += 1;

            if (countByCluster[targetCluster] >= minSize) {
                undersized.shift();
            }
        }
    });
}

function findBestTransferPoint(assignments, points, centroids, sourceCluster, targetCluster) {
    let bestIndex = -1;
    let bestPenalty = Number.POSITIVE_INFINITY;

    // Puntos ya asignados al cluster destino, para medir cercania real
    // (al vecino mas proximo) en lugar de solo al centroide.
    const targetMembers = points.filter((_, idx) => assignments[idx] === targetCluster);

    assignments.forEach((assignedCluster, idx) => {
        if (assignedCluster !== sourceCluster) return;

        const point = points[idx];
        const distToSource = haversineKm(point, centroids[sourceCluster]);

        // Distancia al vecino mas cercano dentro del cluster destino.
        // Si el cluster destino esta vacio, se usa el centroide.
        let distToTarget;
        if (targetMembers.length) {
            distToTarget = targetMembers.reduce((minDist, member) => {
                return Math.min(minDist, haversineKm(point, member));
            }, Number.POSITIVE_INFINITY);
        } else {
            distToTarget = haversineKm(point, centroids[targetCluster]);
        }

        // Penalizacion: cuanto mas cerca quede del destino y cuanto menos se
        // aleje del origen, mejor. Se prioriza compacidad geografica.
        const penalty = distToTarget - distToSource;

        if (penalty < bestPenalty) {
            bestPenalty = penalty;
            bestIndex = idx;
        }
    });

    return bestIndex;
}

function computeCentroid(points) {
    const totals = points.reduce(
        (acc, point) => {
            acc.lat += point.lat;
            acc.lng += point.lng;
            return acc;
        },
        { lat: 0, lng: 0 }
    );

    return {
        lat: totals.lat / points.length,
        lng: totals.lng / points.length
    };
}

function orderRouteNearestNeighbor(points, startPoint = null) {
    if (!points.length) return [];

    const pending = points.slice();
    const ordered = [];

    let current = startPoint
        ? { lat: startPoint.lat, lng: startPoint.lng }
        : { lat: pending[0].lat, lng: pending[0].lng };

    while (pending.length) {
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;

        for (let i = 0; i < pending.length; i += 1) {
            const distance = haversineKm(current, pending[i]);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = i;
            }
        }

        const [nextStop] = pending.splice(nearestIndex, 1);
        ordered.push(nextStop);
        current = nextStop;
    }

    // Refinamiento 2-opt: elimina cruces y saltos largos internos de la ruta,
    // reduciendo la distancia total sin cambiar el conjunto de puntos.
    return improveOrderTwoOpt(ordered, startPoint);
}

/**
 * Mejora el orden de la ruta con 2-opt: intenta invertir segmentos para
 * reducir la distancia total. Respeta el punto de inicio fijo (si existe).
 * Se limita el numero de pasadas para mantener el rendimiento en rutas grandes.
 */
function improveOrderTwoOpt(ordered, startPoint = null) {
    if (ordered.length < 3) return ordered;

    const route = ordered.slice();
    const maxPasses = 8;
    let improved = true;
    let passes = 0;

    // Distancia entre puntos con soporte para el punto de inicio virtual.
    const dist = (a, b) => haversineKm(a, b);

    // Punto previo a la posicion i del arreglo (o el inicio si i=0).
    const pointBefore = (i) => (i === 0 ? startPoint : route[i - 1]);

    while (improved && passes < maxPasses) {
        improved = false;
        passes += 1;

        // i empieza en 0; el segmento comienza en route[i]. El "antes" del
        // segmento depende del startPoint.
        for (let i = 0; i < route.length - 1; i += 1) {
            const before = pointBefore(i);
            for (let j = i + 2; j < route.length; j += 1) {
                const a = route[i];
                const b = route[i + 1];
                const c = route[j];
                const d = j + 1 < route.length ? route[j + 1] : null;

                // Distancia actual: (before->a) + (b->c) + (c->d si existe)
                // Distancia tras invertir segmento [i+1 .. j]: (before->a) + (a->c) + (b->d si existe)
                const currentLeg = (before ? dist(before, a) : 0) + dist(b, c) + (d ? dist(c, d) : 0);
                const swappedLeg = (before ? dist(before, a) : 0) + dist(a, c) + (d ? dist(b, d) : 0);

                if (swappedLeg + 1e-9 < currentLeg) {
                    // Invertir el sub-arreglo (i+1 .. j) inclusive.
                    let left = i + 1;
                    let right = j;
                    while (left < right) {
                        const tmp = route[left];
                        route[left] = route[right];
                        route[right] = tmp;
                        left += 1;
                        right -= 1;
                    }
                    improved = true;
                    break;
                }
            }
            if (improved) break;
        }
    }

    return route;
}

function calcRouteDistanceKm(stops, startPoint = null) {
    if (!stops.length) return 0;

    let total = 0;
    let lastPoint = startPoint ? { lat: startPoint.lat, lng: startPoint.lng } : stops[0];

    stops.forEach((stop, idx) => {
        if (idx === 0 && !startPoint) return;
        total += haversineKm(lastPoint, stop);
        lastPoint = stop;
    });

    return Number(total.toFixed(2));
}

function haversineKm(a, b) {
    const toRad = (value) => (value * Math.PI) / 180;

    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const dLat = lat2 - lat1;
    const dLng = toRad(b.lng - a.lng);

    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);

    const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
    return 6371 * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function renderInputTable() {
    const tableContainer = document.getElementById('tableContainer');
    const total = puntosBase.length;
    const totalActas = puntosBase.reduce((sum, p) => sum + (p.count || 1), 0);
    document.getElementById('total-registros').textContent =
        totalActas !== total
            ? `Registros: ${total} puntos / ${totalActas} actas`
            : `Registros: ${total}`;

    if (!total) {
        tableContainer.innerHTML = '<div style="padding: 1rem; color: #94a3b8;">No hay puntos cargados.</div>';
        return;
    }

    const preview = puntosBase.slice(0, MAX_ROWS_PREVIEW);

    let html = '<table class="data-table results-table"><thead><tr>';
    html += '<th>#</th><th>Direccion</th><th>Coordenada</th><th>Actas</th><th>Google Maps</th>';
    html += '</tr></thead><tbody>';

    preview.forEach((point, index) => {
        const coords = `${point.lat},${point.lng}`;
        const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(coords)}`;
        const count = point.count || 1;

        html += '<tr>';
        html += `<td>${index + 1}</td>`;
        html += `<td class="wrap">${escapeHtml(point.direccion)}</td>`;
        html += `<td>${point.lat} ${point.lng}</td>`;
        html += `<td>${count}</td>`;
        html += `<td><a href="${mapUrl}" target="_blank" rel="noopener noreferrer">Abrir</a></td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';

    if (total > MAX_ROWS_PREVIEW) {
        html += `<div style="padding: 0.85rem; color: #94a3b8;">Mostrando ${MAX_ROWS_PREVIEW} de ${total} registros.</div>`;
    }

    tableContainer.innerHTML = html;
}

function renderSummary() {
    const summaryContainer = document.getElementById('summaryContainer');

    if (!rutasGeneradas.length) {
        summaryContainer.innerHTML = '<p class="hint" style="margin: 0.5rem 0;">Aun no hay rutas generadas.</p>';
        return;
    }

    let html = '';
    rutasGeneradas.forEach((ruta, routeIndex) => {
        html += `
            <article class="route-card">
                <h4>${escapeHtml(ruta.persona)}</h4>
                <p>Paradas: <strong>${ruta.totalParadas}</strong></p>
                <p>Distancia aprox: <strong>${ruta.totalKm.toFixed(2)} km</strong></p>
                <p>Traslado (moto): <strong>${formatDuration(ruta.totalTravelMinutes)}</strong></p>
                <p>Gestion en puntos: <strong>${formatDuration(ruta.totalServiceMinutes)}</strong></p>
                <p>Tiempo total estimado: <strong>${formatDuration(ruta.totalMinutes)}</strong></p>
                <p>Objetivo: <strong>${formatDuration(ruta.targetRouteMinutes || 0)}</strong></p>
                <p>Diferencia vs objetivo: <strong>${formatSignedDuration(ruta.deviationMinutes || 0)}</strong></p>
                <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    data-open-maps-route="1"
                    data-route-index="${routeIndex}"
                    style="margin-top: 0.5rem;"
                >🗺️ Abrir ruta en Google Maps</button>
            </article>
        `;
    });

    summaryContainer.innerHTML = html;
}

function renderRoutesTable() {
    const resultContainer = document.getElementById('resultContainer');

    if (!rutasGeneradas.length) {
        resultContainer.innerHTML = '<div style="padding: 1rem; color: #94a3b8;">Genera rutas para ver el detalle por persona.</div>';
        return;
    }

    let html = '<table class="data-table results-table"><thead><tr>';
    html += '<th>Persona</th><th>Orden</th><th>Direccion</th><th>Coordenada</th><th>Km tramo</th><th>Traslado (min)</th><th>Gestion (min)</th><th>Acumulado</th><th>Google Maps</th>';
    html += '</tr></thead><tbody>';

    rutasGeneradas.forEach((ruta) => {
        ruta.paradas.forEach((parada, idx) => {
            const coords = `${parada.lat},${parada.lng}`;
            const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(coords)}`;

            html += '<tr>';
            html += `<td>${escapeHtml(ruta.persona)}</td>`;
            html += `<td>${idx + 1}</td>`;
            html += `<td class="wrap">${escapeHtml(parada.direccion)}</td>`;
            html += `<td>${parada.lat} ${parada.lng}</td>`;
            html += `<td>${parada.segmentDistanceKm.toFixed(2)}</td>`;
            html += `<td>${parada.travelMinutes.toFixed(1)}</td>`;
            html += `<td>${parada.serviceMinutes}</td>`;
            html += `<td>${formatDuration(parada.accumulatedMinutes)}</td>`;
            html += `<td><a href="${mapUrl}" target="_blank" rel="noopener noreferrer">Abrir</a></td>`;
            html += '</tr>';
        });
    });

    html += '</tbody></table>';
    resultContainer.innerHTML = html;
}

function initializeRoutesMap() {
    const mapContainer = document.getElementById('routesMap');
    if (!mapContainer) return;

    if (typeof L === 'undefined') {
        mapContainer.innerHTML = '<div style="padding: 1rem; color: #94a3b8;">No se pudo cargar el mapa.</div>';
        return;
    }

    routesMap = L.map('routesMap', {
        zoomControl: true,
        attributionControl: true
    });

        // Se usan tiles libres SIN API key. El tile server estandar de OSM
        // (tile.openstreetmap.org) y CARTO basemaps responden 403 / "api key
        // required" en algunos contextos (sobre todo al abrir desde file://).
        // Se usa el servidor raster de Esri World Street Map, que es publico,
        // no requiere key y permite uso directo en navegador.
        const primaryTiles = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
            {
                maxZoom: 19,
                crossOrigin: true,
                attribution:
                    'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, ' +
                    'iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom'
            }
        );
        primaryTiles.addTo(routesMap);

        // Fallback: si el proveedor principal falla, se intenta un espejo libre de
        // OSM para que el mapa no quede en blanco.
        primaryTiles.on('tileerror', () => {
            if (routesMap.__fallbackApplied) return;
            routesMap.__fallbackApplied = true;
            routesMap.removeLayer(primaryTiles);
            L.tileLayer('https://tile.openstreetmap.bzh/br/{z}/{x}/{y}.png', {
                maxZoom: 19,
                crossOrigin: true,
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(routesMap);
        });

    routesMapLayerGroup = L.layerGroup().addTo(routesMap);
    routesMap.setView([6.25184, -75.56359], 12);
    setTimeout(() => routesMap.invalidateSize(), 50);
}

function renderRoutesMap() {
    const legend = document.getElementById('mapLegend');
    if (legend) {
        legend.innerHTML = '';
    }

    if (!routesMap || !routesMapLayerGroup) {
        return;
    }

    routesMapLayerGroup.clearLayers();

    if (!rutasGeneradas.length) {
        selectedRouteFilterIndex = null;
        if (legend) {
            legend.innerHTML = '<span class="hint">Genera rutas para visualizar el mapa.</span>';
        }
        routesMap.setView([6.25184, -75.56359], 12);
        setTimeout(() => routesMap.invalidateSize(), 50);
        return;
    }

    if (selectedRouteFilterIndex !== null && (selectedRouteFilterIndex < 0 || selectedRouteFilterIndex >= rutasGeneradas.length)) {
        selectedRouteFilterIndex = null;
    }

    const boundsPoints = [];
    const showStartPoint = lastRouteStartPoint && (selectedRouteFilterIndex !== null || rutasGeneradas.length > 0);

    if (showStartPoint) {
        const startMarker = L.marker([lastRouteStartPoint.lat, lastRouteStartPoint.lng], {
            title: 'Punto de inicio'
        }).addTo(routesMapLayerGroup);
        startMarker.bindPopup('<strong>Punto de inicio</strong>');
        boundsPoints.push([lastRouteStartPoint.lat, lastRouteStartPoint.lng]);
    }

    rutasGeneradas.forEach((ruta, routeIdx) => {
        const isVisibleRoute = selectedRouteFilterIndex === null || selectedRouteFilterIndex === routeIdx;
        const color = ROUTE_COLORS[routeIdx % ROUTE_COLORS.length];
        const latLngs = ruta.paradas.map((parada) => [parada.lat, parada.lng]);

        if (legend) {
            const activeClass = selectedRouteFilterIndex === null
                ? ''
                : selectedRouteFilterIndex === routeIdx
                    ? 'is-active'
                    : 'is-muted';

            legend.innerHTML += `
                <button type="button" class="legend-item ${activeClass}" data-map-route-index="${routeIdx}">
                    <span class="legend-dot" style="background:${color};"></span>
                    ${escapeHtml(ruta.persona)}
                </button>
            `;
        }

        if (!isVisibleRoute) {
            return;
        }

        if (latLngs.length > 1) {
            L.polyline(latLngs, {
                color,
                weight: 4,
                opacity: 0.9
            }).addTo(routesMapLayerGroup);
        }

        ruta.paradas.forEach((parada, stopIdx) => {
            const latLng = [parada.lat, parada.lng];
            const marker = L.circleMarker(latLng, {
                radius: 8,
                fillColor: color,
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.95
            }).addTo(routesMapLayerGroup);

            marker.bindTooltip(String(stopIdx + 1), {
                permanent: true,
                direction: 'center',
                className: 'route-order-tooltip'
            });

            marker.bindPopup(
                `<strong>${escapeHtml(ruta.persona)}</strong><br>` +
                `Orden: ${stopIdx + 1}<br>` +
                `${escapeHtml(parada.direccion)}<br>` +
                `Traslado: ${parada.travelMinutes.toFixed(1)} min`
            );

            boundsPoints.push(latLng);
        });
    });

    if (boundsPoints.length === 1) {
        routesMap.setView(boundsPoints[0], 15);
    } else if (boundsPoints.length > 1) {
        routesMap.fitBounds(boundsPoints, { padding: [25, 25] });
    }

    setTimeout(() => routesMap.invalidateSize(), 50);
}

function toggleMapRouteFilter(routeIndex) {
    selectedRouteFilterIndex = selectedRouteFilterIndex === routeIndex ? null : routeIndex;
    renderRoutesMap();
}

function exportRoutesCsv() {
    if (!rutasGeneradas.length) {
        showMessage('No hay rutas para exportar.', 'error');
        return;
    }

    const header = [
        'persona',
        'orden',
        'acta',
        'actas_en_punto',
        'direccion',
        'latitud',
        'longitud',
        'km_tramo',
        'tiempo_traslado_min',
        'tiempo_gestion_min',
        'tiempo_acumulado_min',
        'google_maps'
    ];
    const rows = [header.join(';')];

    rutasGeneradas.forEach((ruta) => {
        ruta.paradas.forEach((parada, idx) => {
            const maps = `https://www.google.com/maps?q=${encodeURIComponent(`${parada.lat},${parada.lng}`)}`;

            // Emitir UNA fila por cada direccion original. Cuando varias
            // direcciones comparten la misma coordenada (p.ej. apendices
            // 201, 301, 401), se exportan todas, no solo una.
                        const direcciones = Array.isArray(parada.direcciones) && parada.direcciones.length
                ? parada.direcciones
                : [parada.direccion || '(Sin direccion)'];
            const actasEnPunto = direcciones.length;

            direcciones.forEach((direccion, direccionIdx) => {
                rows.push([
                    csvSafe(ruta.persona),
                    idx + 1,
                    direccionIdx + 1,
                    actasEnPunto,
                    csvSafe(direccion),
                    parada.lat,
                    parada.lng,
                    parada.segmentDistanceKm,
                    parada.travelMinutes,
                    parada.serviceMinutes,
                    parada.accumulatedMinutes,
                    maps
                ].join(';'));
            });
        });
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'rutas_generadas.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showMessage('CSV exportado correctamente.', 'success');
}

function csvSafe(value) {
    const text = String(value ?? '').replace(/"/g, '""');
    return `"${text}"`;
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeText(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function formatDuration(minutes) {
    const safeMinutes = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
    const rounded = Math.round(safeMinutes);
    const hours = Math.floor(rounded / 60);
    const restMinutes = rounded % 60;

    if (hours <= 0) {
        return `${restMinutes} min`;
    }

    if (restMinutes === 0) {
        return `${hours} h`;
    }

    return `${hours} h ${restMinutes} min`;
}

function formatSignedDuration(minutes) {
    const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
    if (safeMinutes === 0) return '0 min';
    const sign = safeMinutes > 0 ? '+' : '-';
    return `${sign}${formatDuration(Math.abs(safeMinutes))}`;
}

function openRouteInGoogleMaps(routeIndex) {
    const route = rutasGeneradas[routeIndex];
    if (!route || !Array.isArray(route.paradas) || !route.paradas.length) {
        showMessage('No hay paradas disponibles para abrir en Google Maps.', 'error');
        return;
    }

    const url = buildGoogleMapsRouteUrl(route.paradas, lastRouteStartPoint);
    if (!url) {
        showMessage('No se pudo construir la ruta para Google Maps.', 'error');
        return;
    }

    window.open(url, '_blank', 'noopener');
}

function buildGoogleMapsRouteUrl(stops, startPoint = null) {
    if (!stops.length) return null;

    // Para una sola parada, abrir ubicacion directa.
    if (stops.length === 1 && !startPoint) {
        const single = formatLatLng(stops[0]);
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(single)}`;
    }

    let origin;
    let destination;
    let waypoints = [];

    if (startPoint) {
        origin = formatLatLng(startPoint);
        destination = formatLatLng(stops[stops.length - 1]);
        waypoints = stops.slice(0, -1).map((stop) => formatLatLng(stop));
    } else {
        origin = formatLatLng(stops[0]);
        destination = formatLatLng(stops[stops.length - 1]);
        waypoints = stops.slice(1, -1).map((stop) => formatLatLng(stop));
    }

    if (waypoints.length > MAX_GOOGLE_MAPS_WAYPOINTS) {
        waypoints = waypoints.slice(0, MAX_GOOGLE_MAPS_WAYPOINTS);
        showMessage(`Google Maps admite un maximo de ${MAX_GOOGLE_MAPS_WAYPOINTS} waypoints. Se abrira un tramo parcial.`, 'info');
    }

    const params = new URLSearchParams({
        api: '1',
        origin,
        destination,
        travelmode: 'driving'
    });

    if (waypoints.length) {
        params.set('waypoints', waypoints.join('|'));
    }

    return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function formatLatLng(point) {
    const lat = Number.parseFloat(point.lat);
    const lng = Number.parseFloat(point.lng);
    return `${lat},${lng}`;
}

function refreshAllViews() {
    renderInputTable();
    renderSummary();
    renderRoutesMap();
    renderRoutesTable();
    document.getElementById('btn-exportar').disabled = rutasGeneradas.length === 0;
}
