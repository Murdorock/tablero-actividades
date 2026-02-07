// Lógica para métricas de Supabase
let metricsData = {
    historicos: [],
    coordenadas: [],
    consulta: []
};

const metricsTableNames = {
    historicos: 'historicos_metricas',
    coordenadas: 'coordenadas_metricas',
    consulta: 'consulta_retenidos_metricas'
};

const metricsLabels = {
    historicos: 'Históricos Métricas',
    coordenadas: 'Coordenadas Métricas',
    consulta: 'Consulta Retenidos Métricas'
};

const tableColumns = ['codigo_sup_aux', 'accion', 'criterio', 'valor', 'fecha_evento'];

document.addEventListener('DOMContentLoaded', function() {
    loadAllMetrics();
});

async function loadAllMetrics() {
    try {
        for (const key of Object.keys(metricsTableNames)) {
            await loadMetricsTable(key);
        }
    } catch (error) {
        handleError(error, 'al cargar métricas');
    }
}

async function loadMetricsTable(tableKey) {
    const loadingIndicator = document.getElementById(`loadingIndicator-${tableKey}`);
    const tableContainer = document.getElementById(`tableContainer-${tableKey}`);
    const statsContainer = document.getElementById(`stats-${tableKey}`);
    
    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';
    
    try {
        const tableName = metricsTableNames[tableKey];
        
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .order('fecha_evento', { ascending: false })
            .limit(500);
        
        if (error) throw error;
        
        metricsData[tableKey] = data || [];
        
        // Mostrar estadísticas
        renderStats(tableKey, statsContainer);
        
        if (metricsData[tableKey].length > 0) {
            renderMetricsTable(tableKey, tableContainer);
        } else {
            tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #7f8c8d;">No hay registros en esta tabla</div>';
        }
        
        loadingIndicator.style.display = 'none';
    } catch (error) {
        loadingIndicator.style.display = 'none';
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">Error: ' + error.message + '</div>';
        console.error(error);
    }
}

function renderStats(tableKey, statsContainer) {
    const data = metricsData[tableKey];
    
    // Calcular estadísticas
    const totalRegistros = data.length;
    const usuariosUnicos = new Set(data.map(r => r.usuario_id)).size;
    const accionesUnicos = new Set(data.map(r => r.accion)).size;
    const codigosUnicos = new Set(data.map(r => r.codigo_sup_aux)).size;
    
    // Fecha más reciente
    let fechaMasReciente = 'N/A';
    if (data.length > 0) {
        const fecha = data[0].fecha_evento.replace('T', ' ').replace('Z', '').split('.')[0];
        fechaMasReciente = fecha;
    }
    
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">📊 Total Registros</div>
            <div class="stat-value">${totalRegistros}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">👤 Usuarios Únicos</div>
            <div class="stat-value">${usuariosUnicos}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">⚙️ Acciones Únicas</div>
            <div class="stat-value">${accionesUnicos}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">📌 Códigos Sup. Aux</div>
            <div class="stat-value">${codigosUnicos}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">📅 Más Reciente</div>
            <div class="stat-value" style="font-size: 14px;">${fechaMasReciente}</div>
        </div>
    `;
}

function renderMetricsTable(tableKey, tableContainer) {
    const data = metricsData[tableKey];
    
    // Primero renderizar análisis agrupado
    const analysisHtml = renderGroupedAnalysis(data);
    
    // Luego renderizar tabla
    let tableHtml = '<table class="data-table"><thead><tr>';
    
    tableColumns.forEach(col => {
        tableHtml += `<th>${formatMetricsColumnName(col)}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';
    
    data.forEach(row => {
        tableHtml += '<tr>';
        tableColumns.forEach(col => {
            const cellValue = formatMetricsValue(row[col], col);
            tableHtml += `<td>${cellValue}</td>`;
        });
        tableHtml += '</tr>';
    });
    
    tableHtml += '</tbody></table>';
    tableContainer.innerHTML = analysisHtml + tableHtml;
}

function renderGroupedAnalysis(data) {
    if (data.length === 0) return '';
    
    const accionesMap = {};
    
    data.forEach(row => {
        const accion = row.accion || 'SIN ACCIÓN';
        
        // Contar acciones
        if (!accionesMap[accion]) {
            accionesMap[accion] = 0;
        }
        accionesMap[accion]++;
    });
    
    let html = '<div style="margin-bottom: 25px;">';
    
    // Sección: Resumen de acciones
    html += '<div style="background: #ecf0f1; padding: 15px; border-radius: 4px;">';
    html += '<h3 style="margin-top: 0; color: #2c3e50;">⚙️ Resumen de Acciones</h3>';
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">';
    
    Object.entries(accionesMap)
        .sort((a, b) => b[1] - a[1])
        .forEach(([accion, count]) => {
            html += `<div style="background: white; padding: 12px; border-radius: 3px; text-align: center; border-top: 3px solid #e74c3c;">
                <div style="font-weight: bold; color: #2c3e50;">${accion}</div>
                <div style="font-size: 20px; font-weight: bold; color: #e74c3c;">${count}</div>
            </div>`;
        });
    
    html += '</div></div>';
    html += '</div>';
    
    return html;
}

function formatMetricsColumnName(col) {
    const names = {
        'codigo_sup_aux': '📌 Código Sup. Aux',
        'accion': '⚙️ Acción',
        'criterio': '✓ Criterio',
        'valor': '💾 Valor',
        'fecha_evento': '📅 Fecha Evento'
    };
    return names[col] || col;
}

function formatMetricsValue(value, col) {
    if (value === null || value === undefined) {
        return '<span style="color: #95a5a6;">NULL</span>';
    }
    
    if (col === 'fecha_evento') {
        try {
            // Mantener la fecha tal como viene de Supabase, solo formatear visualmente
            const dateStr = value.replace('T', ' ').replace('Z', '').split('.')[0];
            return dateStr;
        } catch (e) {
            return value;
        }
    }
    
    if (typeof value === 'string' && value.length > 50) {
        return `<span title="${value}">${value.substring(0, 47)}...</span>`;
    }
    
    return value;
}

function switchTab(tabName) {
    // Ocultar todos los tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Desactivar todos los botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar el tab seleccionado
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Activar el botón correspondiente
    event.target.classList.add('active');
    
    // Recargar datos si es necesario
    if (metricsData[tabName].length === 0) {
        loadMetricsTable(tabName);
    }
}

function reloadAllTables() {
    loadAllMetrics();
}

function exportAllMetrics() {
    const activeTab = document.querySelector('.tab-content.active');
    const tabKey = activeTab.id;
    const data = metricsData[tabKey];
    
    if (data.length === 0) {
        alert('No hay datos para exportar');
        return;
    }
    
    exportToExcel(data, metricsLabels[tabKey], tabKey);
}

function exportToExcel(data, tableName, tabKey) {
    try {
        // Preparar los datos para el Excel
        const exportData = data.map(row => {
            const formattedRow = {};
            tableColumns.forEach(col => {
                const header = formatMetricsColumnName(col).replace(/[^a-zA-Z0-9\s]/g, '').trim();
                let value = row[col];
                
                // Formatear valores
                if (value === null || value === undefined) {
                    formattedRow[header] = '';
                } else if (col === 'fecha_evento') {
                    // Mantener la fecha tal como viene de Supabase sin conversión de zona horaria
                    formattedRow[header] = value;
                } else if (typeof value === 'object') {
                    formattedRow[header] = JSON.stringify(value);
                } else {
                    formattedRow[header] = value;
                }
            });
            return formattedRow;
        });
        
        // Crear el libro de trabajo
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, tableName.substring(0, 31));
        
        // Generar el archivo y descargarlo
        const fileName = `metricas_${tabKey}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        
    } catch (error) {
        alert('Error al exportar: ' + error.message);
        console.error('Error en exportación:', error);
    }
}

function handleError(error, context) {
    console.error(`Error ${context}:`, error);
}