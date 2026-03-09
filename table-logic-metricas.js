// Lógica para métricas de Supabase
let metricsData = {
    historicos: [],
    coordenadas: [],
    consulta: []
};

let filteredMetricsData = {
    historicos: [],
    coordenadas: [],
    consulta: []
};

let activeTabKey = 'historicos';
const chartInstances = {};

const filters = {
    year: 'all',
    month: 'all',
    day: 'all',
    hour: 'all',
    code: 'all'
};

const SUCCESS_ACTION_DEFAULT = 'ingreso_detalle_historico';
const successActionByTab = {
    historicos: 'ingreso_detalle_historico',
    coordenadas: 'abrir_google_maps',
    consulta: 'ingreso_detalle_historico'
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

const tableColumns = ['codigo_sup_aux', 'accion', 'criterio', 'tipo_consumo', 'valor', 'fecha_evento'];

document.addEventListener('DOMContentLoaded', function() {
    loadAllMetrics();
});

async function loadAllMetrics() {
    try {
        for (const key of Object.keys(metricsTableNames)) {
            await loadMetricsTable(key);
        }
        refreshActiveTabView();
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
            .order('fecha_evento', { ascending: false });
        
        if (error) throw error;
        
        metricsData[tableKey] = data || [];

        filteredMetricsData[tableKey] = [...metricsData[tableKey]];

        if (tableKey === activeTabKey) {
            refreshActiveTabView();
        }
        
        loadingIndicator.style.display = 'none';
    } catch (error) {
        loadingIndicator.style.display = 'none';
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">Error: ' + error.message + '</div>';
        console.error(error);
    }
}

function refreshActiveTabView() {
    populateFilterOptions();
    filteredMetricsData[activeTabKey] = getFilteredData(activeTabKey);
    renderTabDashboard(activeTabKey);
}

function renderTabDashboard(tableKey) {
    const statsContainer = document.getElementById(`stats-${tableKey}`);
    const tableContainer = document.getElementById(`tableContainer-${tableKey}`);
    const filteredData = filteredMetricsData[tableKey] || [];

    renderStats(tableKey, statsContainer, filteredData);
    renderRanking(tableKey, filteredData);
    renderCharts(tableKey, filteredData);

    if (filteredData.length > 0) {
        renderMetricsTable(filteredData, tableContainer);
    } else {
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #94a3b8;">No hay registros para los filtros seleccionados</div>';
    }
}

function renderStats(tableKey, statsContainer) {
    const data = filteredMetricsData[tableKey] || [];
    const totalRegistros = data.length;
    const successText = getSuccessText(tableKey);
    const successRows = getSuccessRows(tableKey, data);
    const ingresosExitosos = successRows.length;
    const codigosConIngreso = new Set(successRows.map(r => r.codigo_sup_aux).filter(Boolean)).size;
    const usuariosUnicos = new Set(data.map(r => r.usuario_id).filter(Boolean)).size;
    const porcentajeIngreso = totalRegistros > 0 ? ((ingresosExitosos / totalRegistros) * 100).toFixed(1) : '0.0';
    
    let fechaMasReciente = 'N/A';
    if (data.length > 0) {
        const fechaOrdenada = [...data].sort((a, b) => String(b.fecha_evento || '').localeCompare(String(a.fecha_evento || '')));
        if (fechaOrdenada[0] && fechaOrdenada[0].fecha_evento) {
            fechaMasReciente = formatMetricsDate(fechaOrdenada[0].fecha_evento);
        }
    }
    
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">📊 Registros filtrados</div>
            <div class="stat-value">${totalRegistros}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">✅ ${escapeHtml(successText.labelPlural)}</div>
            <div class="stat-value">${ingresosExitosos}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">📌 Códigos con ${escapeHtml(successText.labelSingular)}</div>
            <div class="stat-value">${codigosConIngreso}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">📈 Tasa de ${escapeHtml(successText.labelSingular)}</div>
            <div class="stat-value">${porcentajeIngreso}%</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">👤 Usuarios únicos</div>
            <div class="stat-value">${usuariosUnicos}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">🕒 Evento más reciente</div>
            <div class="stat-value" style="font-size: 14px;">${fechaMasReciente}</div>
        </div>
    `;
}

function renderMetricsTable(data, tableContainer) {
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
    tableContainer.innerHTML = tableHtml;
}

function renderRanking(tableKey, data) {
    const rankingContainer = document.getElementById(`ranking-${tableKey}`);
    const successText = getSuccessText(tableKey);
    const successRows = getTopCodesSourceRows(tableKey, data);
    const resumenPorCodigo = new Map();

    successRows.forEach(row => {
        const codigo = row.codigo_sup_aux || 'SIN CÓDIGO';
        if (!resumenPorCodigo.has(codigo)) {
            resumenPorCodigo.set(codigo, {
                consultas: 0,
                valoresUnicos: new Set()
            });
        }

        const resumen = resumenPorCodigo.get(codigo);
        resumen.consultas += 1;

        const valor = row.valor;
        if (valor !== null && valor !== undefined && String(valor).trim() !== '') {
            resumen.valoresUnicos.add(String(valor).trim());
        }
    });

    const topEntries = Array.from(resumenPorCodigo.entries())
        .map(([codigo, resumen]) => ({
            codigo,
            consultas: resumen.consultas,
            ingresosUnicos: resumen.valoresUnicos.size
        }))
        .sort((a, b) => b.consultas - a.consultas)
        .slice(0, 10);

    if (!rankingContainer) {
        return;
    }

    if (topEntries.length === 0) {
        rankingContainer.innerHTML = `<div class="empty-note">No hay ${escapeHtml(successText.labelPluralLower)} para los filtros seleccionados.</div>`;
        return;
    }

    rankingContainer.innerHTML = `
        <ul class="ranking-list">
            ${topEntries.map((item, index) => `
                <li class="ranking-item">
                    <span>#${index + 1} · ${escapeHtml(item.codigo)}</span>
                    <span class="ranking-badge">${item.ingresosUnicos} ${item.ingresosUnicos === 1 ? successText.badgeSingular : successText.badgePlural} con ${item.consultas} ${item.consultas === 1 ? 'consulta' : 'consultas'}</span>
                </li>
            `).join('')}
        </ul>
    `;
}

function renderCharts(tableKey, data) {
    const successText = getSuccessText(tableKey);
    const successRows = getSuccessRows(tableKey, data);
    const topCodesSourceRows = getTopCodesSourceRows(tableKey, data);
    const topCodes = Object.entries(countByCode(topCodesSourceRows))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const hoursMap = {};
    for (let hour = 0; hour < 24; hour++) {
        const label = String(hour).padStart(2, '0');
        hoursMap[label] = 0;
    }

    successRows.forEach(row => {
        const parts = getDateParts(row.fecha_evento);
        if (parts) {
            const key = String(parts.hour).padStart(2, '0');
            hoursMap[key] += 1;
        }
    });

    const topChartId = `chart-top-${tableKey}`;
    const hourChartId = `chart-hour-${tableKey}`;

    destroyChart(topChartId);
    destroyChart(hourChartId);

    const topCanvas = document.getElementById(topChartId);
    const hourCanvas = document.getElementById(hourChartId);

    if (topCanvas) {
        chartInstances[topChartId] = new Chart(topCanvas, {
            type: 'bar',
            data: {
                labels: topCodes.map(([codigo]) => codigo),
                datasets: [{
                    label: successText.chartTopLabel,
                    data: topCodes.map(([, count]) => count),
                    backgroundColor: 'rgba(56, 189, 248, 0.7)',
                    borderColor: 'rgba(56, 189, 248, 1)',
                    borderWidth: 1
                }]
            },
            options: getChartOptions('Top códigos')
        });
    }

    if (hourCanvas) {
        chartInstances[hourChartId] = new Chart(hourCanvas, {
            type: 'line',
            data: {
                labels: Object.keys(hoursMap),
                datasets: [{
                    label: successText.chartHourLabel,
                    data: Object.values(hoursMap),
                    borderColor: 'rgba(16, 185, 129, 1)',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    fill: true,
                    tension: 0.25
                }]
            },
            options: getChartOptions('Frecuencia por hora')
        });
    }
}

function getTopCodesSourceRows(tableKey, data) {
    // El top siempre se arma por codigo_sup_aux sobre los ingresos exitosos de la pestaña activa.
    return getSuccessRows(tableKey, data).filter(row => {
            const code = row.codigo_sup_aux;
            return code !== null && code !== undefined && String(code).trim() !== '';
        });
}

function getSuccessActionForTab(tableKey) {
    return successActionByTab[tableKey] || SUCCESS_ACTION_DEFAULT;
}

function getSuccessText(tableKey) {
    if (tableKey === 'consulta') {
        return {
            labelSingular: 'criterio válido',
            labelPlural: 'Criterios válidos',
            labelPluralLower: 'criterios válidos',
            badgeSingular: 'criterio válido',
            badgePlural: 'criterios válidos',
            chartTopLabel: 'Criterios válidos',
            chartHourLabel: 'Criterios válidos por hora'
        };
    }

    return {
        labelSingular: 'ingreso',
        labelPlural: 'Ingresos exitosos',
        labelPluralLower: 'ingresos exitosos',
        badgeSingular: 'ingreso',
        badgePlural: 'ingresos',
        chartTopLabel: 'Ingresos exitosos',
        chartHourLabel: 'Ingresos por hora'
    };
}

function normalizeText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function isSuccessRow(tableKey, row) {
    if (tableKey === 'consulta') {
        const criterio = normalizeText(row.criterio);
        return criterio === 'instalacion' || criterio === 'contrato';
    }

    const successAction = getSuccessActionForTab(tableKey);
    return row.accion === successAction;
}

function getSuccessRows(tableKey, data) {
    return (data || []).filter(row => isSuccessRow(tableKey, row));
}

function getChartOptions(titleText) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: '#e2e8f0' }
            },
            title: {
                display: true,
                text: titleText,
                color: '#e2e8f0'
            }
        },
        scales: {
            x: {
                ticks: { color: '#cbd5e1' },
                grid: { color: 'rgba(148, 163, 184, 0.12)' }
            },
            y: {
                beginAtZero: true,
                ticks: { color: '#cbd5e1' },
                grid: { color: 'rgba(148, 163, 184, 0.12)' }
            }
        }
    };
}

function destroyChart(chartId) {
    if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
        delete chartInstances[chartId];
    }
}

function countByCode(data) {
    const map = {};
    data.forEach(row => {
        const code = row.codigo_sup_aux || 'SIN CÓDIGO';
        map[code] = (map[code] || 0) + 1;
    });
    return map;
}

function populateFilterOptions() {
    const data = metricsData[activeTabKey] || [];
    const years = new Set();
    const months = new Set();
    const days = new Set();
    const hours = new Set();
    const codes = new Set();
    const successCountByCode = {};

    data.forEach(row => {
        const code = row.codigo_sup_aux !== null && row.codigo_sup_aux !== undefined
            ? String(row.codigo_sup_aux).trim()
            : '';

        if (code !== '') {
            codes.add(code);
            if (isSuccessRow(activeTabKey, row)) {
                successCountByCode[code] = (successCountByCode[code] || 0) + 1;
            }
        }

        const parts = getDateParts(row.fecha_evento);
        if (!parts) return;
        years.add(parts.year);
        months.add(parts.month);
        days.add(parts.day);
        hours.add(parts.hour);
    });

    fillSelect('filter-year', years, filters.year, 'Todos', { numeric: true, pad2: false });
    fillSelect('filter-month', months, filters.month, 'Todos', { numeric: true, pad2: true });
    fillSelect('filter-day', days, filters.day, 'Todos', { numeric: true, pad2: true });
    fillSelect('filter-hour', hours, filters.hour, 'Todas', { numeric: true, pad2: true });
    fillSelect('filter-code', codes, filters.code, 'Todos', {
        numeric: false,
        pad2: false,
        customSort: (a, b) => {
            const countA = successCountByCode[String(a)] || 0;
            const countB = successCountByCode[String(b)] || 0;
            if (countB !== countA) {
                return countB - countA;
            }
            return String(a).localeCompare(String(b), 'es', { sensitivity: 'base' });
        }
    });
}

function fillSelect(selectId, valuesSet, selectedValue, allLabel, options = {}) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const { numeric = true, pad2 = false, customSort = null } = options;

    const values = Array.from(valuesSet);
    if (typeof customSort === 'function') {
        values.sort(customSort);
    } else if (numeric) {
        values.sort((a, b) => Number(a) - Number(b));
    } else {
        values.sort((a, b) => String(a).localeCompare(String(b), 'es', { sensitivity: 'base' }));
    }

    select.innerHTML = `<option value="all">${allLabel}</option>`;
    values.forEach(value => {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = pad2 ? String(value).padStart(2, '0') : String(value);
        select.appendChild(option);
    });

    if (values.length === 0) {
        select.value = 'all';
        return;
    }

    const valueStrings = values.map(value => String(value));
    const hasCurrent = selectedValue !== 'all' && valueStrings.includes(String(selectedValue));
    select.value = hasCurrent ? String(selectedValue) : 'all';
}

function getFilteredData(tabKey) {
    const data = metricsData[tabKey] || [];
    const normalizedCodeFilter = filters.code === 'all' ? '' : String(filters.code || '').trim().toLowerCase();

    return data.filter(row => {
        const parts = getDateParts(row.fecha_evento);
        if (!parts) return false;

        const yearOk = filters.year === 'all' || parts.year === Number(filters.year);
        const monthOk = filters.month === 'all' || parts.month === Number(filters.month);
        const dayOk = filters.day === 'all' || parts.day === Number(filters.day);
        const hourOk = filters.hour === 'all' || parts.hour === Number(filters.hour);
        const codeValue = String(row.codigo_sup_aux || '').toLowerCase();
        const codeOk = normalizedCodeFilter === '' || codeValue === normalizedCodeFilter;

        return yearOk && monthOk && dayOk && hourOk && codeOk;
    });
}

function getDateParts(value) {
    if (!value) return null;
    const text = String(value);
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2})/);
    if (match) {
        return {
            year: Number(match[1]),
            month: Number(match[2]),
            day: Number(match[3]),
            hour: Number(match[4])
        };
    }

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;

    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        hour: date.getHours()
    };
}

function applyFilters() {
    filters.year = document.getElementById('filter-year')?.value || 'all';
    filters.month = document.getElementById('filter-month')?.value || 'all';
    filters.day = document.getElementById('filter-day')?.value || 'all';
    filters.hour = document.getElementById('filter-hour')?.value || 'all';
    filters.code = document.getElementById('filter-code')?.value || 'all';

    filteredMetricsData[activeTabKey] = getFilteredData(activeTabKey);
    renderTabDashboard(activeTabKey);
}

function resetFilters() {
    filters.year = 'all';
    filters.month = 'all';
    filters.day = 'all';
    filters.hour = 'all';
    filters.code = 'all';
    refreshActiveTabView();
}

function formatMetricsColumnName(col) {
    const names = {
        'codigo_sup_aux': '📌 Código Sup. Aux',
        'accion': '⚙️ Acción',
        'criterio': '✓ Criterio',
        'tipo_consumo': '🧩 Tipo consumo',
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
        return formatMetricsDate(value);
    }
    
    if (typeof value === 'string' && value.length > 50) {
        return `<span title="${value}">${value.substring(0, 47)}...</span>`;
    }
    
    return escapeHtml(String(value));
}

function formatMetricsDate(value) {
    try {
        return String(value).replace('T', ' ').replace('Z', '').split('.')[0];
    } catch (e) {
        return value;
    }
}

function escapeHtml(text) {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function switchTab(tabName, buttonEl) {
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
    if (buttonEl) buttonEl.classList.add('active');

    activeTabKey = tabName;
    refreshActiveTabView();
}

function reloadAllTables() {
    resetFilters();
    loadAllMetrics();
}

function exportFilteredMetrics(format) {
    const tabKey = activeTabKey;
    const data = filteredMetricsData[tabKey] || [];
    
    if (data.length === 0) {
        alert('No hay datos filtrados para exportar');
        return;
    }

    if (format === 'csv') {
        exportToCsv(data, tabKey);
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
                    formattedRow[header] = formatMetricsDate(value);
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

function exportToCsv(data, tabKey) {
    try {
        const headers = tableColumns.map(col => formatMetricsColumnName(col).replace(/[^a-zA-Z0-9\s]/g, '').trim());
        const rows = data.map(row => tableColumns.map(col => {
            let value = row[col];
            if (value === null || value === undefined) return '';
            if (col === 'fecha_evento') value = formatMetricsDate(value);
            if (typeof value === 'object') value = JSON.stringify(value);
            const text = String(value).replaceAll('"', '""');
            return `"${text}"`;
        }).join(','));

        const csv = `${headers.join(',')}\n${rows.join('\n')}`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `metricas_${tabKey}_filtrado_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        alert('Error al exportar CSV: ' + error.message);
        console.error('Error en exportación CSV:', error);
    }
}

function handleError(error, context) {
    console.error(`Error ${context}:`, error);
}