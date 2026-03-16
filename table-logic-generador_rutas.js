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
    const seen = new Set();
    const unique = [];

    points.forEach((point) => {
        const key = `${normalizeText(point.direccion)}|${point.lat}|${point.lng}`;
        if (seen.has(key)) return;
        seen.add(key);
        unique.push(point);
    });

    return unique;
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

        if (maxDelta <= TARGET_ROUTE_TOLERANCE_MIN || mostOverIdx === mostUnderIdx) {
            return currentRoutes;
        }

        if (stopGroups[mostOverIdx].length <= 1) {
            return currentRoutes;
        }

        const currentPenalty = totalTargetPenalty(currentRoutes, target);
        let bestPenalty = currentPenalty;
        let bestGroups = null;

        stopGroups[mostOverIdx].forEach((candidateStop, stopIdx) => {
            const nextGroups = stopGroups.map((group) => group.slice());
            nextGroups[mostOverIdx].splice(stopIdx, 1);
            nextGroups[mostUnderIdx].push(candidateStop);

            const candidateRoutes = nextGroups.map((group, idx) => createRouteFromStops(group, idx, startPoint, routeParams));
            const candidatePenalty = totalTargetPenalty(candidateRoutes, target);

            if (candidatePenalty < bestPenalty) {
                bestPenalty = candidatePenalty;
                bestGroups = nextGroups;
            }
        });

        if (!bestGroups) {
            return currentRoutes;
        }

        stopGroups = bestGroups;
    }

    return stopGroups.map((group, idx) => createRouteFromStops(group, idx, startPoint, routeParams));
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
        coordenada: stop.coordenada || `${stop.lat} ${stop.lng}`
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

        accumulatedMinutes += roundedTravelMinutes + serviceMinutes;
        totalDistanceKm += roundedSegmentKm;
        totalTravelMinutes += roundedTravelMinutes;

        previousPoint = stop;

        return {
            ...stop,
            segmentDistanceKm: roundedSegmentKm,
            travelMinutes: roundedTravelMinutes,
            serviceMinutes,
            accumulatedMinutes: Number(accumulatedMinutes.toFixed(1))
        };
    });

    const roundedTotalTravelMinutes = Number(totalTravelMinutes.toFixed(1));
    const totalServiceMinutes = enrichedStops.length * serviceMinutes;

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

    assignments.forEach((assignedCluster, idx) => {
        if (assignedCluster !== sourceCluster) return;

        const distToSource = haversineKm(points[idx], centroids[sourceCluster]);
        const distToTarget = haversineKm(points[idx], centroids[targetCluster]);
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

    return ordered;
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
    document.getElementById('total-registros').textContent = `Registros: ${total}`;

    if (!total) {
        tableContainer.innerHTML = '<div style="padding: 1rem; color: #94a3b8;">No hay puntos cargados.</div>';
        return;
    }

    const preview = puntosBase.slice(0, MAX_ROWS_PREVIEW);

    let html = '<table class="data-table results-table"><thead><tr>';
    html += '<th>#</th><th>Direccion</th><th>Coordenada</th><th>Google Maps</th>';
    html += '</tr></thead><tbody>';

    preview.forEach((point, index) => {
        const coords = `${point.lat},${point.lng}`;
        const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(coords)}`;

        html += '<tr>';
        html += `<td>${index + 1}</td>`;
        html += `<td class="wrap">${escapeHtml(point.direccion)}</td>`;
        html += `<td>${point.lat} ${point.lng}</td>`;
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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(routesMap);

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
            rows.push([
                csvSafe(ruta.persona),
                idx + 1,
                csvSafe(parada.direccion),
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
