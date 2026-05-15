// Table logic especializado para generar inconsistencias
const TABLE_NAME = 'generar_inconsistencias';
const TABLE_TITLE = '🔍 Generar Inconsistencias';
const PRIMARY_KEY = 'id';

// Variables globales
let fullData = [];
let tableData = [];
let currentPage = 1;
let currentDataSource = [];
const VIEW_LIMIT = 20;
let archivosCargados = {};
let dataframes = {};

// Función para abrir selector de archivos
function abrirSelectorArchivos() {
    document.getElementById('excelFileInput').click();
}

// Procesar archivos Excel cargados
async function procesarArchivosExcel(event) {
    const files = event.target.files;
    if (!files.length) return;

    const filesList = document.getElementById('filesList');
    filesList.innerHTML = '';
    archivosCargados = {};
    dataframes = {};

    const mesNombres = {
        'Mes Actual': 'mes_actual',
        'Mes Anterior': 'mes_anterior',
        'Tres Meses': 'tres_meses',
        'Cuatro Meses': 'cuatro_meses',
        'Cinco Meses': 'cinco_meses',
        'Seis Meses': 'seis_meses'
    };

    for (let file of files) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                // Detectar tipo de archivo por nombre o contenido
                let tipoArchivo = null;
                const nombreLower = file.name.toLowerCase();
                
                if (nombreLower.includes('mayo') || nombreLower.includes('5') || nombreLower.includes('actual')) {
                    tipoArchivo = 'mes_actual';
                } else if (nombreLower.includes('abril') || nombreLower.includes('4') || nombreLower.includes('anterior')) {
                    tipoArchivo = 'mes_anterior';
                } else if (nombreLower.includes('marzo') || nombreLower.includes('3') || nombreLower.includes('tres')) {
                    tipoArchivo = 'tres_meses';
                } else if (nombreLower.includes('febrero') || nombreLower.includes('2') || nombreLower.includes('cuatro')) {
                    tipoArchivo = 'cuatro_meses';
                } else if (nombreLower.includes('enero') || nombreLower.includes('1') || nombreLower.includes('cinco')) {
                    tipoArchivo = 'cinco_meses';
                } else if (nombreLower.includes('diciembre') || nombreLower.includes('12') || nombreLower.includes('seis')) {
                    tipoArchivo = 'seis_meses';
                }

                if (tipoArchivo) {
                    archivosCargados[tipoArchivo] = file.name;
                    dataframes[tipoArchivo] = jsonData;
                    
                    const li = document.createElement('div');
                    li.style.cssText = 'padding: 0.5rem; background: white; margin: 0.5rem 0; border-radius: 0.25rem; border-left: 3px solid #4caf50;';
                    li.innerHTML = `
                        <strong>${tipoArchivo.toUpperCase().replace(/_/g, ' ')}</strong>: ${file.name}
                        <span style="color: #28a745; margin-left: 0.5rem;">✓ ${jsonData.length} registros</span>
                    `;
                    filesList.appendChild(li);
                } else {
                    alert(`No se pudo detectar el tipo de archivo: ${file.name}\nUse nombres que contengan: Actual, Anterior, Tres, Cuatro, Cinco, o Seis`);
                }

            } catch (error) {
                console.error('Error al procesar archivo:', error);
                alert(`Error al procesar ${file.name}: ${error.message}`);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    const filesInfo = document.getElementById('filesInfo');
    filesInfo.style.display = 'block';
}

// Función principal de análisis
async function generarInconsistencias() {
    if (Object.keys(dataframes).length === 0) {
        alert('Por favor carga archivos Excel primero');
        return;
    }

    mostrarProgreso(true);
    actualizarProgreso(0, 'Iniciando análisis...');

    try {
        // Paso 1: Consolidación de datos
        actualizarProgreso(10, 'Consolidando datos de múltiples meses...');
        const dfConsolidado = consolidarDatos();

        // Paso 2: Filtrado inicial
        actualizarProgreso(30, 'Filtrando datos...');
        const dfFiltrado = filtrarDatos(dfConsolidado);

        // Paso 3: Análisis de Lecturas Menores
        actualizarProgreso(50, 'Analizando lecturas menores...');
        const lecturasMenuores = analizarLecturasMenuores(dfFiltrado);

        // Paso 4: Análisis de Causas Históricas
        actualizarProgreso(65, 'Analizando causas históricas...');
        const causasHistoricas = analizarCausasHistoricas(dfFiltrado);

        // Paso 5: Análisis de Lecturas Vacías
        actualizarProgreso(80, 'Analizando lecturas vacías...');
        const lecturasVacias = analizarLecturasVacias(dfFiltrado);

        // Paso 6: TOP 150 Errores Avanzado
        actualizarProgreso(90, 'Generando TOP 150 errores...');
        const top150 = generarTOP150Errores(dfConsolidado);

        // Paso 7: Consolidar resultados
        actualizarProgreso(95, 'Consolidando resultados...');
        fullData = [
            ...lecturasMenuores.map(r => ({ ...r, categoria: 'ERROR LECTURA MENOR' })),
            ...causasHistoricas.map(r => ({ ...r, categoria: 'ERROR LEIDA' })),
            ...lecturasVacias.map(r => ({ ...r, categoria: 'ERROR CAUSA' })),
            ...top150.map(r => ({ ...r, categoria: 'ERROR PROBABLE' }))
        ];

        currentDataSource = fullData;
        currentPage = 1;
        updateTableSlice();
        renderTable();

        // Mostrar información de análisis
        mostrarInfoAnalisis(lecturasMenuores, causasHistoricas, lecturasVacias, top150);

        actualizarProgreso(100, '✅ Análisis completado');

    } catch (error) {
        console.error('Error en análisis:', error);
        alert('Error durante el análisis: ' + error.message);
    } finally {
        setTimeout(() => mostrarProgreso(false), 1000);
    }
}

// Consolidar datos de múltiples meses
function consolidarDatos() {
    const columnasBase = ["DIRECCION", "NRO_INSTALACION", "RUTA_LECTURA", "COD_CICLO", "TIPO_CONSUMO", "COD_TIPO_CONSUMO"];
    const columnasLecturas = ["LECTURA_TOMADA", "LECTURA_ANTERIOR", "CAUSANL_OBS"];

    let dfFinal = dataframes.mes_actual || [];
    dfFinal = dfFinal.map(row => ({ ...row })); // Copiar

    // Función auxiliar para renombrar columnas de cada mes
    const renombrarMes = (data, prefijo) => {
        if (!data || !data.length) return data;
        const renamed = {};
        data.forEach((row, idx) => {
            const newRow = {};
            columnasBase.forEach(col => {
                if (row[col] !== undefined) newRow[col] = row[col];
            });
            columnasLecturas.forEach(col => {
                if (row[col] !== undefined) {
                    newRow[col + '_' + prefijo] = row[col];
                }
            });
            Object.keys(row).forEach(col => {
                if (!columnasBase.includes(col) && !columnasLecturas.includes(col)) {
                    newRow[col] = row[col];
                }
            });
            dfFinal[idx] = newRow;
        });
    };

    // Procesar cada mes
    if (dataframes.mes_anterior) mergeDataFrames(dfFinal, dataframes.mes_anterior, columnasBase, 'Mes_Anterior');
    if (dataframes.tres_meses) mergeDataFrames(dfFinal, dataframes.tres_meses, columnasBase, 'Tres_Meses');
    if (dataframes.cuatro_meses) mergeDataFrames(dfFinal, dataframes.cuatro_meses, columnasBase, 'Cuatro_Meses');
    if (dataframes.cinco_meses) mergeDataFrames(dfFinal, dataframes.cinco_meses, columnasBase, 'Cinco_Meses');
    if (dataframes.seis_meses) mergeDataFrames(dfFinal, dataframes.seis_meses, columnasBase, 'Seis_Meses');

    // Asegurar NRO_INSTALACION como string
    dfFinal.forEach(row => {
        row.NRO_INSTALACION = String(row.NRO_INSTALACION || '');
    });

    return dfFinal;
}

// Merge de DataFrames
function mergeDataFrames(dfMain, dfOther, columnasBase, prefijo) {
    const columnasLecturas = ["LECTURA_TOMADA", "LECTURA_ANTERIOR", "CAUSANL_OBS"];
    
    dfOther.forEach(rowOther => {
        const matchRow = dfMain.find(row => 
            columnasBase.every(col => row[col] == rowOther[col])
        );
        
        if (matchRow) {
            columnasLecturas.forEach(col => {
                const newColName = col + '_' + prefijo;
                if (rowOther[col] !== undefined) {
                    matchRow[newColName] = rowOther[col];
                }
            });
        }
    });
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

// Generar TOP 150 Errores Avanzado
function generarTOP150Errores(df) {
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

    // TOP 150
    resultado = resultado.sort((a, b) => b.SCORE - a.SCORE).slice(0, 150);

    resultado.forEach(row => {
        row.MOTIVO = 'Venía quieto y cambió dígito(s) sospechoso(s)';
    });

    return resultado;
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

function mostrarInfoAnalisis(menores, causas, vacias, top150) {
    const info = document.getElementById('analysisInfo');
    const details = document.getElementById('analysisDetails');
    
    const html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <div style="background: white; padding: 1rem; border-radius: 0.25rem;">
                <strong>🔴 Lecturas Menores</strong><br><span style="font-size: 1.5rem; color: #d32f2f;">${menores.length}</span>
            </div>
            <div style="background: white; padding: 1rem; border-radius: 0.25rem;">
                <strong>🟡 Causas Históricas</strong><br><span style="font-size: 1.5rem; color: #f57c00;">${causas.length}</span>
            </div>
            <div style="background: white; padding: 1rem; border-radius: 0.25rem;">
                <strong>🔵 Lecturas Vacías</strong><br><span style="font-size: 1.5rem; color: #1565c0;">${vacias.length}</span>
            </div>
            <div style="background: white; padding: 1rem; border-radius: 0.25rem;">
                <strong>⚡ TOP 150 Errores</strong><br><span style="font-size: 1.5rem; color: #6a1b9a;">${top150.length}</span>
            </div>
            <div style="background: white; padding: 1rem; border-radius: 0.25rem;">
                <strong>📊 Total de Inconsistencias</strong><br><span style="font-size: 1.5rem; color: #388e3c;">${menores.length + causas.length + vacias.length + top150.length}</span>
            </div>
        </div>
    `;
    
    details.innerHTML = html;
    info.style.display = 'block';
}

function exportarResultados() {
    if (!fullData || fullData.length === 0) {
        alert('No hay resultados para exportar. Genera un análisis primero.');
        return;
    }

    const columnasExportar = [
        'NRO_INSTALACION', 'DIRECCION', 'TIPO_CONSUMO', 'RUTA_LECTURA',
        'LECTURA_ANTERIOR_Mes_Actual', 'LECTURA_TOMADA_Mes_Actual',
        'LECTURA_ANTERIOR_Mes_Anterior', 'LECTURA_ANTERIOR_Tres_Meses',
        'CAUSANL_OBS_Mes_Actual', 'CAUSANL_OBS_Mes_Anterior',
        'DIFERENCIA_LECTURAS', 'DIG_CAMBIADOS', 'POSICION_ERROR',
        'SCORE', 'MOTIVO', 'categoria'
    ];

    const dataExportar = fullData.map(row => {
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

function limpiarResultados() {
    if (confirm('¿Estás seguro de que deseas limpiar todos los resultados?')) {
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
        html += `<tr style="border-bottom: 1px solid #dee2e6; background: ${bgColor};"><td style="padding: 0.75rem;">`;
        
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
