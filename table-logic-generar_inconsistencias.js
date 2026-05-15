// Table logic especializado para generar inconsistencias
const TABLE_NAME = 'generar_inconsistencias';
const TABLE_TITLE = '🔍 Generar Inconsistencias';
const PRIMARY_KEY = 'id';
const VIEW_LIMIT = 20;
const CHUNK_SIZE = 10000;
const PREVIEW_LIMIT = 3000;

const MONTH_KEYS = ['mes_actual', 'mes_anterior', 'tres_meses', 'cuatro_meses', 'cinco_meses', 'seis_meses'];
const BASE_COLUMNS = ['DIRECCION', 'NRO_INSTALACION', 'RUTA_LECTURA', 'COD_CICLO', 'TIPO_CONSUMO', 'COD_TIPO_CONSUMO'];
const LECTURAS_COLUMNS = ['LECTURA_TOMADA', 'LECTURA_ANTERIOR', 'CAUSANL_OBS'];
const EXTRA_CURRENT_COLUMNS = [
    'OBS_ADIC', 'OBSERV_ALFANUM', 'PERIODO_FACTURACION', 'CATEGORIA_SERVICIO',
    'ORDEN_LECTURA', 'SERVICIO_SUSCRITO', 'MUNICIPIO', 'COD_LECTOR', 'SERIE_MEDIDOR',
    'CALIFICACION_CONSUMO', 'FECHA_LECTURA_ACTUAL', 'FECHA_LECTURA_ANTERIOR', 'CONSUMO_PROMEDIO'
];
const REQUIRED_COLUMNS = new Set([...BASE_COLUMNS, ...LECTURAS_COLUMNS, ...EXTRA_CURRENT_COLUMNS]);

// Variables globales
let fullData = [];
let tableData = [];
let currentPage = 1;
let currentDataSource = [];
let archivosCargados = {};
let dataframes = {};
let isProcessingChunks = false;
let processingState = {
    processedRows: 0,
    totalRows: 0,
    counts: {
        menores: 0,
        causas: 0,
        vacias: 0,
        probables: 0
    }
};
let partialExportStore = {
    columns: [
        'NRO_INSTALACION', 'DIRECCION', 'TIPO_CONSUMO', 'RUTA_LECTURA',
        'LECTURA_ANTERIOR_Mes_Actual', 'LECTURA_TOMADA_Mes_Actual',
        'LECTURA_ANTERIOR_Mes_Anterior', 'LECTURA_ANTERIOR_Tres_Meses',
        'CAUSANL_OBS_Mes_Actual', 'CAUSANL_OBS_Mes_Anterior',
        'DIFERENCIA_LECTURAS', 'DIG_CAMBIADOS', 'POSICION_ERROR',
        'SCORE', 'MOTIVO', 'categoria'
    ],
    rowsByCategory: {
        menores: [],
        causas: [],
        vacias: [],
        probables: []
    }
};

syncPaginationState();

// Función para abrir selector de archivos
function abrirSelectorArchivos() {
    document.getElementById('excelFileInput').click();
}

function syncPaginationState() {
    window.currentPage = currentPage;
    window.getTotalPages = getTotalPages;
}

function sleepFrame() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

function extraerFechaArchivo(fileName) {
    const match = fileName.match(/(\d{2})(\d{2})(\d{4})/);
    if (!match) return null;
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(year)) return null;
    return new Date(year, month - 1, day);
}

function asignarMesesPorFecha(filesArray) {
    const enriched = filesArray.map(file => ({ file, date: extraerFechaArchivo(file.name) }));
    enriched.sort((a, b) => {
        if (a.date && b.date) return b.date - a.date;
        if (a.date) return -1;
        if (b.date) return 1;
        return a.file.name.localeCompare(b.file.name);
    });

    return enriched.slice(0, MONTH_KEYS.length).map((item, index) => ({
        file: item.file,
        monthKey: MONTH_KEYS[index]
    }));
}

function proyectarFila(row) {
    const projected = {};
    REQUIRED_COLUMNS.forEach(col => {
        if (row[col] !== undefined) {
            projected[col] = row[col];
        }
    });
    return projected;
}

async function parseCsvFile(file) {
    if (typeof Papa === 'undefined') {
        throw new Error('PapaParse no está disponible para leer CSV grandes.');
    }

    return new Promise((resolve, reject) => {
        const rows = [];
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            worker: true,
            chunkSize: 1024 * 1024,
            chunk(results) {
                const chunkRows = results.data || [];
                for (const row of chunkRows) {
                    rows.push(proyectarFila(row));
                }
            },
            complete() {
                resolve(rows);
            },
            error(err) {
                reject(err);
            }
        });
    });
}

async function parseExcelFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, {
        type: 'array',
        dense: true,
        raw: true,
        cellFormula: false,
        cellHTML: false,
        cellStyles: false
    });

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: null });
    return rows.map(proyectarFila);
}

async function parseArchivo(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext === 'csv') {
        return parseCsvFile(file);
    }
    if (ext === 'xlsx' || ext === 'xls') {
        return parseExcelFile(file);
    }
    throw new Error(`Formato no soportado: ${file.name}`);
}

function renderArchivoCargado(filesList, tipoArchivo, fileName, rowCount) {
    const li = document.createElement('div');
    li.style.cssText = 'padding: 0.5rem; background: white; margin: 0.5rem 0; border-radius: 0.25rem; border-left: 3px solid #4caf50;';
    li.innerHTML = `
        <strong>${tipoArchivo.toUpperCase().replace(/_/g, ' ')}</strong>: ${fileName}
        <span style="color: #28a745; margin-left: 0.5rem;">✓ ${rowCount.toLocaleString('es-CO')} registros</span>
    `;
    filesList.appendChild(li);
}

// Procesar archivos cargados con estrategia secuencial para no bloquear el navegador
async function procesarArchivosExcel(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const filesList = document.getElementById('filesList');
    filesList.innerHTML = '';
    archivosCargados = {};
    dataframes = {};

    const asignaciones = asignarMesesPorFecha(files);
    if (!asignaciones.length) {
        alert('No se pudieron identificar archivos válidos.');
        return;
    }

    mostrarProgreso(true);

    try {
        for (let i = 0; i < asignaciones.length; i++) {
            const { file, monthKey } = asignaciones[i];
            const porcentaje = Math.round(((i + 1) / asignaciones.length) * 100);
            actualizarProgreso(
                porcentaje,
                `Leyendo ${i + 1}/${asignaciones.length}: ${file.name} (${monthKey.replace(/_/g, ' ')})`
            );

            const jsonData = await parseArchivo(file);
            archivosCargados[monthKey] = file.name;
            dataframes[monthKey] = jsonData;
            renderArchivoCargado(filesList, monthKey, file.name, jsonData.length);
            await sleepFrame();
        }

        document.getElementById('filesInfo').style.display = 'block';
        actualizarProgreso(100, 'Carga completada');
    } catch (error) {
        console.error('Error al procesar archivos:', error);
        alert(`Error al procesar archivos: ${error.message}`);
    } finally {
        setTimeout(() => mostrarProgreso(false), 600);
    }
}

// Función principal de análisis
async function generarInconsistencias() {
    if (Object.keys(dataframes).length === 0) {
        alert('Por favor carga archivos Excel primero');
        return;
    }

    if (!Array.isArray(dataframes.mes_actual) || dataframes.mes_actual.length === 0) {
        alert('Falta el archivo de Mes Actual para ejecutar el análisis.');
        return;
    }

    mostrarProgreso(true);
    actualizarProgreso(0, 'Iniciando análisis...');
    isProcessingChunks = true;
    resetPartialStores();

    try {
        const mesActualRows = dataframes.mes_actual || [];
        const totalRows = mesActualRows.length;
        processingState.totalRows = totalRows;

        actualizarProgreso(5, 'Indexando meses históricos...');
        const monthIndexes = {
            Mes_Anterior: buildMonthIndex(dataframes.mes_anterior || []),
            Tres_Meses: buildMonthIndex(dataframes.tres_meses || []),
            Cuatro_Meses: buildMonthIndex(dataframes.cuatro_meses || []),
            Cinco_Meses: buildMonthIndex(dataframes.cinco_meses || []),
            Seis_Meses: buildMonthIndex(dataframes.seis_meses || [])
        };

        const previewRows = [];
        let topCandidates = [];

        for (let start = 0; start < totalRows; start += CHUNK_SIZE) {
            const end = Math.min(start + CHUNK_SIZE, totalRows);
            const avance = 10 + Math.round((end / totalRows) * 80);

            actualizarProgreso(avance, `Procesando lote ${start + 1}-${end} de ${totalRows}...`);

            const chunkBase = mesActualRows.slice(start, end);
            const chunkConsolidado = prepararMesActual(chunkBase);

            anexarMesConIndex(chunkConsolidado, monthIndexes.Mes_Anterior, 'Mes_Anterior');
            anexarMesConIndex(chunkConsolidado, monthIndexes.Tres_Meses, 'Tres_Meses');
            anexarMesConIndex(chunkConsolidado, monthIndexes.Cuatro_Meses, 'Cuatro_Meses');
            anexarMesConIndex(chunkConsolidado, monthIndexes.Cinco_Meses, 'Cinco_Meses');
            anexarMesConIndex(chunkConsolidado, monthIndexes.Seis_Meses, 'Seis_Meses');

            const chunkFiltrado = filtrarDatos(chunkConsolidado);

            const lecturasMenores = analizarLecturasMenuores(chunkFiltrado).map(r => ({ ...r, categoria: 'ERROR LECTURA MENOR' }));
            const causasHistoricas = analizarCausasHistoricas(chunkFiltrado).map(r => ({ ...r, categoria: 'ERROR LEIDA' }));
            const lecturasVacias = analizarLecturasVacias(chunkFiltrado).map(r => ({ ...r, categoria: 'ERROR CAUSA' }));
            const candidatosProbables = generarCandidatosErrores(chunkConsolidado).map(r => ({ ...r, categoria: 'ERROR PROBABLE' }));

            topCandidates = mergeTopCandidates(topCandidates, candidatosProbables, 150);

            processingState.processedRows = end;
            processingState.counts.menores += lecturasMenores.length;
            processingState.counts.causas += causasHistoricas.length;
            processingState.counts.vacias += lecturasVacias.length;

            // Guardar incrementalmente para exportaciones parciales.
            appendPartialRows('menores', lecturasMenores);
            appendPartialRows('causas', causasHistoricas);
            appendPartialRows('vacias', lecturasVacias);
            updatePartialTopProbables(candidatosProbables);

            // Mantener solo una muestra para la UI y no crecer en memoria.
            pushPreviewRows(previewRows, lecturasMenores);
            pushPreviewRows(previewRows, causasHistoricas);
            pushPreviewRows(previewRows, lecturasVacias);
            pushPreviewRows(previewRows, candidatosProbables);

            await sleepFrame();
        }

        processingState.counts.probables = topCandidates.length;
        fullData = previewRows.slice(0, PREVIEW_LIMIT);

        currentDataSource = fullData;
        currentPage = 1;
        updateTableSlice();
        renderTable();

        mostrarInfoAnalisis(
            processingState.counts.menores,
            processingState.counts.causas,
            processingState.counts.vacias,
            processingState.counts.probables,
            processingState.processedRows,
            processingState.totalRows
        );

        actualizarProgreso(100, '✅ Análisis completado');

    } catch (error) {
        console.error('Error en análisis:', error);
        alert('Error durante el análisis: ' + error.message);
    } finally {
        isProcessingChunks = false;
        setTimeout(() => mostrarProgreso(false), 1000);
    }
}

function buildJoinKey(row) {
    return BASE_COLUMNS.map(col => String(row[col] ?? '').trim().toUpperCase()).join('|');
}

function buildMonthIndex(rows) {
    const index = new Map();
    for (const row of rows || []) {
        const key = buildJoinKey(row);
        if (!index.has(key)) {
            index.set(key, row);
        }
    }
    return index;
}

function anexarMesConIndex(mainRows, monthIndex, suffix) {
    if (!Array.isArray(mainRows) || !monthIndex || monthIndex.size === 0) return;

    for (const row of mainRows) {
        const key = buildJoinKey(row);
        const source = monthIndex.get(key);
        if (!source) continue;

        LECTURAS_COLUMNS.forEach(col => {
            row[`${col}_${suffix}`] = source[col] ?? null;
        });
    }
}

function resetPartialStores() {
    fullData = [];
    tableData = [];
    currentDataSource = [];
    currentPage = 1;
    processingState = {
        processedRows: 0,
        totalRows: 0,
        counts: {
            menores: 0,
            causas: 0,
            vacias: 0,
            probables: 0
        }
    };

    partialExportStore.rowsByCategory = {
        menores: [],
        causas: [],
        vacias: [],
        probables: []
    };
}

function appendPartialRows(categoryKey, rows) {
    if (!Array.isArray(rows) || rows.length === 0) return;
    partialExportStore.rowsByCategory[categoryKey].push(...rows);
}

function updatePartialTopProbables(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return;
    partialExportStore.rowsByCategory.probables = mergeTopCandidates(
        partialExportStore.rowsByCategory.probables,
        rows,
        150
    );
}

function pushPreviewRows(previewRows, incomingRows) {
    if (!Array.isArray(incomingRows) || incomingRows.length === 0) return;
    if (previewRows.length >= PREVIEW_LIMIT) return;
    const remaining = PREVIEW_LIMIT - previewRows.length;
    previewRows.push(...incomingRows.slice(0, remaining));
}

function prepararMesActual(rows) {
    return (rows || []).map(row => {
        const normalized = {};

        BASE_COLUMNS.forEach(col => {
            normalized[col] = row[col] ?? null;
        });

        LECTURAS_COLUMNS.forEach(col => {
            normalized[`${col}_Mes_Actual`] = row[col] ?? null;
        });

        EXTRA_CURRENT_COLUMNS.forEach(col => {
            normalized[col] = row[col] ?? null;
        });

        normalized.NRO_INSTALACION = String(normalized.NRO_INSTALACION ?? '');
        return normalized;
    });
}

function anexarMes(mainRows, otherRows, suffix) {
    if (!Array.isArray(mainRows) || !Array.isArray(otherRows) || !otherRows.length) return;

    const index = new Map();
    for (const row of otherRows) {
        const key = buildJoinKey(row);
        if (!index.has(key)) {
            index.set(key, row);
        }
    }

    for (const row of mainRows) {
        const key = buildJoinKey(row);
        const source = index.get(key);
        if (!source) continue;

        LECTURAS_COLUMNS.forEach(col => {
            row[`${col}_${suffix}`] = source[col] ?? null;
        });
    }
}

// Consolidar datos de múltiples meses
function consolidarDatos() {
    const dfFinal = prepararMesActual(dataframes.mes_actual || []);

    anexarMes(dfFinal, dataframes.mes_anterior || [], 'Mes_Anterior');
    anexarMes(dfFinal, dataframes.tres_meses || [], 'Tres_Meses');
    anexarMes(dfFinal, dataframes.cuatro_meses || [], 'Cuatro_Meses');
    anexarMes(dfFinal, dataframes.cinco_meses || [], 'Cinco_Meses');
    anexarMes(dfFinal, dataframes.seis_meses || [], 'Seis_Meses');

    return dfFinal;
}

// Filtrar datos (eliminar causas/observaciones específicas)
function filtrarDatos(df) {
    const valores_causanl = [
        "MEDIDOR CAMBIADO", "MEDIDOR PARADO O DAÑADO", "MEDIDORES TROCADOS",
        "POSIBLE IRREGULARIDAD (EGA)", "REGISTRO DEVOLVIENDO", "CORRECCIÓN LECTURA"
    ];

    const valores_obs_adic = [
        "MEDIDOR MAL PARAMETRIZADO (E)", "MEDIDOR PARADO O DAÑADO (EGA)",
        "DISPLAY DESCONFIGURADO (E)", "DISPLAY REINICIADO (E)", "POSIBLE IRREGULARIDAD", "VER ALFANUMÉRICA (EGA)"
    ];

    return df.filter(row => {
        const causaActual = String(row.CAUSANL_OBS_Mes_Actual || '').trim();
        const obsAdic = String(row.OBS_ADIC || '').trim();
        
        return !valores_causanl.includes(causaActual) && !valores_obs_adic.includes(obsAdic);
    });
}

// Análisis de Lecturas Menores (Paso 2)
function analizarLecturasMenuores(df) {
    let resultado = df.map(r => ({ ...r })); // Copiar

    // Limpiar LECTURA_ANTERIOR_Mes_Actual
    resultado = resultado.filter(row => row.LECTURA_ANTERIOR_Mes_Actual != null && row.LECTURA_ANTERIOR_Mes_Actual !== '');

    resultado.forEach(row => {
        row.LECTURA_ANTERIOR_Mes_Actual = String(row.LECTURA_ANTERIOR_Mes_Actual).trim();
        
        // Filtrar valores que comienzan con 90-99 y tienen más de 3 dígitos
        const valor = row.LECTURA_ANTERIOR_Mes_Actual;
        const primeraParte = valor.split('.')[0];
        
        if (primeraParte.length > 3 && ['90', '91', '92', '93', '94', '95', '96', '97', '98', '99'].includes(valor.substring(0, 2))) {
            row._skip = true;
        }
    });

    resultado = resultado.filter(r => !r._skip);

    // Limpiar LECTURA_TOMADA_Mes_Actual
    resultado = resultado.filter(row => row.LECTURA_TOMADA_Mes_Actual != null && row.LECTURA_TOMADA_Mes_Actual !== '');
    resultado.forEach(row => {
        row.LECTURA_ANTERIOR_Mes_Actual = parseInt(row.LECTURA_ANTERIOR_Mes_Actual) || 0;
        row.LECTURA_TOMADA_Mes_Actual = parseInt(row.LECTURA_TOMADA_Mes_Actual) || 0;
    });

    // Paso 2: Limpiar filas de CAUSANL_OBS_Mes_Anterior
    resultado = resultado.filter(row => {
        const causa = String(row.CAUSANL_OBS_Mes_Anterior || '').trim();
        return causa !== '' && causa !== 'MEDIDOR CAMBIADO' && causa !== 'nan';
    });

    // Crear columna de diferencia
    resultado.forEach(row => {
        row.DIFERENCIA_LECTURAS = row.LECTURA_TOMADA_Mes_Actual - row.LECTURA_ANTERIOR_Mes_Actual;
    });

    // Mantener solo negativos (excepto -1)
    resultado = resultado.filter(row => row.DIFERENCIA_LECTURAS < 0 && row.DIFERENCIA_LECTURAS !== -1);

    resultado.forEach(row => {
        row.TIPO_ERROR = 'ERROR LECTURA MENOR';
    });

    return resultado;
}

// Análisis de Causas Históricas (Paso A)
function analizarCausasHistoricas(df) {
    let resultado = df.map(r => ({ ...r })); // Copiar

    // Eliminar LECTURA_TOMADA_Mes_Actual vacía
    resultado = resultado.filter(row => row.LECTURA_TOMADA_Mes_Actual != null && String(row.LECTURA_TOMADA_Mes_Actual).trim() !== '');

    const causasValidas = [
        "DEMOLIDA",
        "DESTRUÍDO/DAÑADO",
        "MDOR CON DISPLAY DESENERGIZADO",
        "MEDIDOR PREPAGO",
        "NO EXISTE GEOGRAFICAMENTE",
        "NO PERTENECE A LA CORRERIA",
        "PROFUNDO O MUY ALTO",
        "SERVICIO DIRECTO",
        "SIN SERVICIO SIN MEDIDOR",
        "TAPADO INTERIORMENTE"
    ];

    // Limpiar espacios
    resultado.forEach(row => {
        row.CAUSANL_OBS_Mes_Anterior = String(row.CAUSANL_OBS_Mes_Anterior || '').trim();
        row.CAUSANL_OBS_Tres_Meses = String(row.CAUSANL_OBS_Tres_Meses || '').trim();
    });

    // Filtrar filas con causas válidas
    resultado = resultado.filter(row =>
        causasValidas.includes(row.CAUSANL_OBS_Mes_Anterior) ||
        causasValidas.includes(row.CAUSANL_OBS_Tres_Meses)
    );

    // Filtrar LECTURA_ANTERIOR_Mes_Actual (solo 0 o vacío)
    resultado = resultado.filter(row => {
        const valor = row.LECTURA_ANTERIOR_Mes_Actual;
        return valor == null || valor === '' || valor === 0;
    });

    // Filtrar LECTURA_ANTERIOR_Mes_Anterior (solo 0 o vacío)
    resultado = resultado.filter(row => {
        const valor = row.LECTURA_ANTERIOR_Mes_Anterior;
        return valor == null || valor === '' || valor === 0;
    });

    resultado.forEach(row => {
        row.TIPO_ERROR = 'ERROR LEIDA';
    });

    return resultado;
}

// Análisis de Lecturas Vacías (Paso B)
function analizarLecturasVacias(df) {
    let resultado = df.map(r => ({ ...r })); // Copiar

    // Conservar solo filas donde LECTURA_TOMADA_Mes_Actual esté vacía
    resultado = resultado.filter(row => 
        row.LECTURA_TOMADA_Mes_Actual == null || String(row.LECTURA_TOMADA_Mes_Actual).trim() === ''
    );

    const columnasAnteriores = [
        'LECTURA_ANTERIOR_Mes_Actual',
        'LECTURA_ANTERIOR_Mes_Anterior',
        'LECTURA_ANTERIOR_Tres_Meses',
        'LECTURA_ANTERIOR_Cuatro_Meses',
        'LECTURA_ANTERIOR_Cinco_Meses',
        'LECTURA_ANTERIOR_Seis_Meses'
    ];

    // Conservar solo filas donde cada columna NO esté vacía
    columnasAnteriores.forEach(col => {
        resultado = resultado.filter(row => row[col] != null && String(row[col]).trim() !== '');
    });

    // Eliminar filas con "IMPOSIBILIDAD DE ACCESO"
    resultado = resultado.filter(row =>
        !String(row.CAUSANL_OBS_Mes_Actual || '').includes('IMPOSIBILIDAD DE ACCESO')
    );

    // Eliminar filas con "aval" o "avala"
    resultado = resultado.filter(row =>
        !String(row.OBSERV_ALFANUM || '').toLowerCase().match(/aval|avala/)
    );

    resultado.forEach(row => {
        row.TIPO_ERROR = 'ERROR CAUSA';
    });

    return resultado;
}

// Generar candidatos de errores probables (sin cortar para poder usar por lotes)
function generarCandidatosErrores(df) {
    let resultado = df.map(r => ({ ...r })); // Copiar

    // Convertir columnas a numéricas
    const cols = [
        "LECTURA_TOMADA_Mes_Actual",
        "LECTURA_ANTERIOR_Mes_Actual",
        "LECTURA_ANTERIOR_Mes_Anterior",
        "LECTURA_ANTERIOR_Tres_Meses",
        "LECTURA_ANTERIOR_Cuatro_Meses"
    ];

    resultado.forEach(row => {
        cols.forEach(col => {
            row[col] = parseInt(row[col]) || 0;
        });
    });

    // Histórico quieto
    resultado.forEach(row => {
        row.HIST_CERO = (
            row.LECTURA_ANTERIOR_Mes_Actual === row.LECTURA_ANTERIOR_Mes_Anterior &&
            row.LECTURA_ANTERIOR_Mes_Anterior === row.LECTURA_ANTERIOR_Tres_Meses &&
            row.LECTURA_ANTERIOR_Tres_Meses === row.LECTURA_ANTERIOR_Cuatro_Meses
        );
    });

    // Diferencia actual
    resultado.forEach(row => {
        row.DIF_ACTUAL = row.LECTURA_TOMADA_Mes_Actual - row.LECTURA_ANTERIOR_Mes_Actual;
    });

    resultado = resultado.filter(row => row.DIF_ACTUAL > 5);

    // Analizar cambio de dígitos
    resultado.forEach(row => {
        const { digitos, posiciones } = analizarCambioDigitos(
            String(row.LECTURA_ANTERIOR_Mes_Actual),
            String(row.LECTURA_TOMADA_Mes_Actual)
        );
        row.DIG_CAMBIADOS = digitos;
        row.POSICION_ERROR = posiciones;
    });

    // Solo cambios pequeños (1 a 3 dígitos)
    resultado = resultado.filter(row =>
        row.HIST_CERO === true &&
        row.DIG_CAMBIADOS >= 1 &&
        row.DIG_CAMBIADOS <= 3
    );

    // Score inteligente
    resultado.forEach(row => {
        row.SCORE = calcularScore(row);
    });

    resultado.forEach(row => {
        row.MOTIVO = 'Venía quieto y cambió dígito(s) sospechoso(s)';
    });

    return resultado;
}

function mergeTopCandidates(currentTop, newCandidates, maxItems) {
    const merged = [...(currentTop || []), ...(newCandidates || [])];
    merged.sort((a, b) => (b.SCORE || 0) - (a.SCORE || 0));
    return merged.slice(0, maxItems);
}

// Generar TOP 150 Errores Avanzado
function generarTOP150Errores(df) {
    return mergeTopCandidates([], generarCandidatosErrores(df), 150);
}

// Analizar cambio de dígitos
function analizarCambioDigitos(a, b) {
    a = String(a).padStart(Math.max(a.length, b.length), '0');
    b = String(b).padStart(Math.max(a.length, b.length), '0');

    const posiciones = [];
    const largo = Math.max(a.length, b.length);

    for (let i = 0; i < largo; i++) {
        if (a[i] !== b[i]) {
            posiciones.push(i);
        }
    }

    const cantidad = posiciones.length;
    const etiquetas = [];

    posiciones.forEach(p => {
        const desdeDerechа = largo - p;
        if (desdeDerechа === 1) etiquetas.push("Última");
        else if (desdeDerechа === 2) etiquetas.push("Penúltima");
        else if (desdeDerechа === 3) etiquetas.push("Antepenúltima");
        else if (desdeDerechа === 4) etiquetas.push("4ta");
        else etiquetas.push("Alta");
    });

    return {
        digitos: cantidad,
        posiciones: etiquetas.join(", ")
    };
}

// Calcular score
function calcularScore(row) {
    let s = 100;

    if (row.DIG_CAMBIADOS === 1) s += 50;
    else if (row.DIG_CAMBIADOS === 2) s += 30;
    else s += 15;

    const txt = row.POSICION_ERROR;
    if (txt.includes("Última")) s += 20;
    if (txt.includes("Penúltima")) s += 25;
    if (txt.includes("Antepenúltima")) s += 25;

    if (row.DIF_ACTUAL <= 15) s += 30;
    else if (row.DIF_ACTUAL <= 30) s += 15;

    if ((row.CONSUMO_PROMEDIO || 0) > 10) s += 15;

    return s;
}

// Utilidades UI
function mostrarProgreso(mostrar) {
    document.getElementById('progressArea').style.display = mostrar ? 'block' : 'none';
}

function actualizarProgreso(porcentaje, texto) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    if (progressBar) progressBar.style.width = porcentaje + '%';
    if (progressText) progressText.textContent = texto;
}

function mostrarInfoAnalisis(menores, causas, vacias, top150, processedRows, totalRows) {
    const info = document.getElementById('analysisInfo');
    const details = document.getElementById('analysisDetails');
    const total = menores + causas + vacias + top150;
    const progresoTexto = totalRows > 0
        ? `Registros procesados: ${processedRows.toLocaleString('es-CO')} / ${totalRows.toLocaleString('es-CO')}`
        : '';
    
    const html = `
        <p style="margin: 0 0 1rem 0; color: #2e7d32;"><strong>${progresoTexto}</strong></p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <div style="background: white; padding: 1rem; border-radius: 0.25rem;">
                <strong>🔴 Lecturas Menores</strong><br><span style="font-size: 1.5rem; color: #d32f2f;">${menores}</span>
            </div>
            <div style="background: white; padding: 1rem; border-radius: 0.25rem;">
                <strong>🟡 Causas Históricas</strong><br><span style="font-size: 1.5rem; color: #f57c00;">${causas}</span>
            </div>
            <div style="background: white; padding: 1rem; border-radius: 0.25rem;">
                <strong>🔵 Lecturas Vacías</strong><br><span style="font-size: 1.5rem; color: #1565c0;">${vacias}</span>
            </div>
            <div style="background: white; padding: 1rem; border-radius: 0.25rem;">
                <strong>⚡ TOP 150 Errores</strong><br><span style="font-size: 1.5rem; color: #6a1b9a;">${top150}</span>
            </div>
            <div style="background: white; padding: 1rem; border-radius: 0.25rem;">
                <strong>📊 Total de Inconsistencias</strong><br><span style="font-size: 1.5rem; color: #388e3c;">${total}</span>
            </div>
        </div>
    `;
    
    details.innerHTML = html;
    info.style.display = 'block';
}

function exportarResultados() {
    const categories = partialExportStore.rowsByCategory;
    const top150 = mergeTopCandidates([], categories.probables, 150);
    const allRows = [
        ...categories.menores,
        ...categories.causas,
        ...categories.vacias,
        ...top150
    ];

    if (!allRows.length) {
        alert('No hay resultados para exportar. Genera un análisis primero.');
        return;
    }

    const columnasExportar = partialExportStore.columns;

    const dataExportar = allRows.map(row => {
        const newRow = {};
        columnasExportar.forEach(col => {
            if (row[col] !== undefined) newRow[col] = row[col];
        });
        return newRow;
    });

    const ws = XLSX.utils.json_to_sheet(dataExportar);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inconsistencias');
    XLSX.writeFile(wb, 'Inconsistencias_' + new Date().toISOString().split('T')[0] + '.xlsx');
}

function toCsvValue(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function descargarCsv(nombre, rows) {
    const cols = partialExportStore.columns;
    const header = cols.join(',');
    const body = rows.map(row => cols.map(c => toCsvValue(row[c])).join(',')).join('\n');
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nombre;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportarParcialResultados() {
    const hoy = new Date().toISOString().split('T')[0];
    const categories = partialExportStore.rowsByCategory;
    let exported = 0;

    if (categories.menores.length) {
        descargarCsv(`inconsistencias_parcial_lectura_menor_${hoy}.csv`, categories.menores);
        exported++;
    }
    if (categories.causas.length) {
        descargarCsv(`inconsistencias_parcial_error_leida_${hoy}.csv`, categories.causas);
        exported++;
    }
    if (categories.vacias.length) {
        descargarCsv(`inconsistencias_parcial_error_causa_${hoy}.csv`, categories.vacias);
        exported++;
    }
    if (categories.probables.length) {
        const top = mergeTopCandidates([], categories.probables, 150);
        descargarCsv(`inconsistencias_parcial_top150_${hoy}.csv`, top);
        exported++;
    }

    if (!exported) {
        alert('Aún no hay resultados parciales para exportar.');
        return;
    }

    if (isProcessingChunks) {
        alert('Se exportaron los parciales disponibles hasta este momento.');
    }
}

function limpiarResultados() {
    if (confirm('¿Estás seguro de que deseas limpiar todos los resultados?')) {
        resetPartialStores();
        fullData = [];
        tableData = [];
        currentPage = 1;
        currentDataSource = [];
        archivosCargados = {};
        dataframes = {};
        document.getElementById('filesList').innerHTML = '';
        document.getElementById('filesInfo').style.display = 'none';
        document.getElementById('analysisInfo').style.display = 'none';
        document.getElementById('tableContainer').innerHTML = '';
        document.getElementById('tableInfoContainer').style.display = 'none';
        document.getElementById('paginationContainer').style.display = 'none';
    }
}

// Funciones de renderización
function getTotalPages() {
    return Math.max(1, Math.ceil((currentDataSource?.length || 0) / VIEW_LIMIT));
}

function updateTableSlice() {
    const start = (currentPage - 1) * VIEW_LIMIT;
    tableData = (currentDataSource || []).slice(start, start + VIEW_LIMIT);
    syncPaginationState();
}

window.goToPage = function(page) {
    const total = getTotalPages();
    currentPage = Math.min(Math.max(1, page), total);
    updateTableSlice();
    renderTable();
};

function renderTable() {
    const tableContainer = document.getElementById('tableContainer');
    const tableInfoContainer = document.getElementById('tableInfoContainer');
    const paginationContainer = document.getElementById('paginationContainer');

    if (!tableData || tableData.length === 0) {
        tableContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: #999;">No hay datos para mostrar</p>';
        tableInfoContainer.style.display = 'none';
        paginationContainer.style.display = 'none';
        return;
    }

    // Información de tabla
    const totalPages = getTotalPages();
    const start = (currentPage - 1) * VIEW_LIMIT + 1;
    const end = Math.min(currentPage * VIEW_LIMIT, currentDataSource.length);
    
    tableInfoContainer.innerHTML = `
        <strong>Mostrando ${start}-${end} de ${currentDataSource.length} registros (Página ${currentPage} de ${totalPages})</strong>
    `;
    tableInfoContainer.style.display = 'block';
    paginationContainer.style.display = 'block';
    document.getElementById('pageInfo').textContent = `Página ${currentPage} de ${totalPages}`;

    // Crear tabla
    const columns = Object.keys(tableData[0]).filter(col => !['id', '_skip'].includes(col));
    
    let html = '<table style="width: 100%; border-collapse: collapse; background: white; font-size: 0.875rem;">';
    html += '<thead style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;"><tr>';
    
    columns.forEach(col => {
        html += `<th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #495057;">${col}</th>`;
    });
    
    html += '</tr></thead><tbody>';

    tableData.forEach((row, idx) => {
        const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8f9fa';
        html += `<tr style="border-bottom: 1px solid #dee2e6; background: ${bgColor};">`;
        
        columns.forEach(col => {
            const valor = row[col];
            let displayValue = valor;
            
            if (valor === null || valor === undefined) displayValue = '-';
            else if (typeof valor === 'number') displayValue = valor.toLocaleString('es-ES');
            
            html += `<td style="padding: 0.75rem; color: #495057;">${displayValue}</td>`;
        });
        
        html += '</tr>';
    });

    html += '</tbody></table>';
    tableContainer.innerHTML = html;
}
