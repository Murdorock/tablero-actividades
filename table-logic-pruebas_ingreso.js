// Lógica específica para "Pruebas de Ingreso"
// Consulta la tabla resultados_prueba y presenta de forma entendible los
// resultados de las 3 pruebas: Textos (P1), TPL (P2) y Medellín (P3).
// TABLE_NAME se define en el HTML ('resultados_prueba').

const PI_CHART_INSTANCES = {};

// Datos crudos y filtrados
let piAllData = [];
let piFilteredData = [];
let piLoadedCount = 0;
let piLoading = false;
let piFilterTimer = null;

// Token de sesión inyectado por index.html (postMessage).
// Necesario porque la vista vive en un iframe con su propia sesión vacía.
let piAccessToken = null;
let piLoadRetries = 0;

window.addEventListener('message', function (event) {
    const payload = event && event.data ? event.data : null;
    if (!payload || payload.type !== 'SUPABASE_ACCESS_TOKEN') return;
    const token = payload.accessToken || null;
    if (!token || token === piAccessToken) return;
    piAccessToken = token;
    // Al recibir la sesión, recargar los datos autenticados.
    piLoadRetries = 0;
    loadData();
});

// --- Utilidades ---
function piNum(value) {
    if (value === null || value === undefined) return null;
    const n = Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function piFormatNumber(value, decimals = 1, suffix = '') {
    const n = piNum(value);
    if (n === null) return '-';
    return n.toFixed(decimals) + suffix;
}

function piFormatSeconds(value) {
    const n = piNum(value);
    if (n === null) return '-';
    const total = Math.max(0, Math.round(n));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function piFormatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('es-ES', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

function piToIsoDateOnly(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Color según un porcentaje 0-100
function piColorForPercent(pct) {
    if (pct === null || pct === undefined) return '#64748b';
    if (pct >= 80) return '#22c55e';
    if (pct >= 60) return '#eab308';
    return '#ef4444';
}

function piEsc(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Barra horizontal con color según porcentaje
function piPercentBar(pct) {
    if (pct === null || pct === undefined) {
        return '<span style="color:#64748b;">-</span>';
    }
    const clamped = Math.max(0, Math.min(100, pct));
    const color = piColorForPercent(pct);
    return `
        <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
            <span class="pi-bar"><span style="width:${clamped}%;background:${color};"></span></span>
            <span style="font-weight:700;color:${color};min-width:42px;">${pct.toFixed(1)}%</span>
        </div>
    `;
}

// --- Carga de datos (paginada) ---
async function piFetchAll() {
    const PAGE = 1000;
    let allRows = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .range(from, from + PAGE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allRows = allRows.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
    }

    return allRows;
}

async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');

    if (piLoading) return;
    piLoading = true;

    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (tableContainer) tableContainer.innerHTML = '';

    try {
        const rows = await piFetchAll();
        piAllData = rows || [];
        piLoadedCount = piAllData.length;

        if (piAllData.length === 0) {
            clearPiDashboard();
            tableContainer.innerHTML = '<div class="pi-empty">📭 No hay resultados en la tabla resultados_prueba.</div>';
            return;
        }

        applyFilter();
    } catch (error) {
        clearPiDashboard();
        console.error('Error al cargar resultados_prueba:', error);
        tableContainer.innerHTML = `<div class="pi-empty" style="color:#ef4444;">❌ Error al cargar los resultados: ${piEsc(error.message)}</div>`;
    } finally {
        piLoading = false;
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

// --- Filtros ---
function scheduleApplyFilter() {
    if (piFilterTimer) clearTimeout(piFilterTimer);
    piFilterTimer = setTimeout(applyFilter, 250);
}

function readFilters() {
    const search = (document.getElementById('piSearch')?.value || '').trim().toLowerCase();
    const desde = document.getElementById('piDesde')?.value || '';
    const hasta = document.getElementById('piHasta')?.value || '';
    const orden = document.getElementById('piOrden')?.value || 'fecha_desc';
    return { search, desde, hasta, orden };
}

function filterRows(rows, { search, desde, hasta }) {
    return rows.filter((row) => {
        if (search) {
            const nombre = String(row.nombre || '').toLowerCase();
            const cedula = String(row.cedula || '').toLowerCase();
            if (!nombre.includes(search) && !cedula.includes(search)) return false;
        }
        if (desde || hasta) {
            const iso = piToIsoDateOnly(row.created_at || row.fecha);
            if (!iso) return false;
            if (desde && iso < desde) return false;
            if (hasta && iso > hasta) return false;
        }
        return true;
    });
}

function sortRows(rows, orden) {
    const copy = [...rows];
    switch (orden) {
        case 'fecha_asc':
            copy.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            break;
        case 'nombre_asc':
            copy.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
            break;
        case 'p3_desc':
            copy.sort((a, b) => (piNum(b.p3_puntuacion) || 0) - (piNum(a.p3_puntuacion) || 0));
            break;
        case 'p1_desc':
            copy.sort((a, b) => (piNum(b.p1_precision) || 0) - (piNum(a.p1_precision) || 0));
            break;
        case 'p2_asc':
            copy.sort((a, b) => (piNum(a.p2_errores) || 0) - (piNum(b.p2_errores) || 0));
            break;
        case 'fecha_desc':
        default:
            copy.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            break;
    }
    return copy;
}

function applyFilter() {
    if (!piAllData.length) return;
    const filters = readFilters();
    piFilteredData = sortRows(filterRows(piAllData, filters), filters.orden);
    renderAll(piFilteredData, filters);
}

function clearFilters() {
    const s = document.getElementById('piSearch');
    const d = document.getElementById('piDesde');
    const h = document.getElementById('piHasta');
    const o = document.getElementById('piOrden');
    if (s) s.value = '';
    if (d) d.value = '';
    if (h) h.value = '';
    if (o) o.value = 'fecha_desc';
    applyFilter();
}

// --- Cálculo de métricas por fila (presentación entendible) ---
function computeRowMetrics(row) {
    // Prueba 1 - Textos
    const p1Precision = piNum(row.p1_precision);
    const p1Exactos = piNum(row.p1_textos_exactos);
    const p1Vel = piNum(row.p1_velocidad_cpm);
    const p1Tiempo = piNum(row.p1_tiempo_segundos);
    const p1Errores = piNum(row.p1_errores);

    // Prueba 2 - TPL
    const p2Correctas = piNum(row.p2_lecturas_correctas);
    const p2Errores = piNum(row.p2_errores);
    const p2Tiempo = piNum(row.p2_tiempo_segundos);
    const p2Precision = (p2Correctas !== null && (p2Correctas + (p2Errores || 0)) > 0)
        ? (p2Correctas / (p2Correctas + (p2Errores || 0))) * 100
        : null;

    // Prueba 3 - Medellín
    const p3Puntuacion = piNum(row.p3_puntuacion);
    const p3Correctas = piNum(row.p3_correctas);
    const p3Incorrectas = piNum(row.p3_incorrectas);
    const p3Tiempo = piNum(row.p3_tiempo_segundos);

    // Puntaje global (promedio de las 3 pruebas cuando existan)
    const componentes = [p1Precision, p2Precision, p3Puntuacion].filter(v => v !== null);
    const global = componentes.length ? componentes.reduce((a, b) => a + b, 0) / componentes.length : null;

    return {
        p1Precision, p1Exactos, p1Vel, p1Tiempo, p1Errores,
        p2Correctas, p2Errores, p2Tiempo, p2Precision,
        p3Puntuacion, p3Correctas, p3Incorrectas, p3Tiempo,
        global
    };
}

// --- KPIs y gráficos ---
function clearPiDashboard() {
    const summary = document.getElementById('piSummary');
    const kpis = document.getElementById('piKpis');
    Object.keys(PI_CHART_INSTANCES).forEach((id) => {
        PI_CHART_INSTANCES[id].destroy();
        delete PI_CHART_INSTANCES[id];
    });
    if (kpis) kpis.innerHTML = '';
    if (summary) summary.style.display = 'none';
}

function piAverage(values) {
    const valid = values.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
    if (!valid.length) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function renderSummary(rows) {
    const summary = document.getElementById('piSummary');
    const kpis = document.getElementById('piKpis');
    if (!summary || !kpis) return;

    if (!rows.length) {
        clearPiDashboard();
        return;
    }

    const metrics = rows.map(computeRowMetrics);

    const total = rows.length;
    const completadas = rows.filter(r => r.prueba_completada === true).length;
    const promPrecisionTextos = piAverage(metrics.map(m => m.p1Precision));
    const promErroresTpl = piAverage(metrics.map(m => m.p2Errores));
    const promPuntuacion = piAverage(metrics.map(m => m.p3Puntuacion));
    const promGlobal = piAverage(metrics.map(m => m.global));

    const fmt = (v, d = 1, s = '') => (v === null ? '-' : v.toFixed(d) + s);

    kpis.innerHTML = `
        <div class="pi-kpi-card" style="border-left-color:#3b82f6;">
            <div class="pi-kpi-label">👥 Participantes</div>
            <div class="pi-kpi-value">${total.toLocaleString()}</div>
            <div class="pi-kpi-sub">${completadas} con prueba completada</div>
        </div>
        <div class="pi-kpi-card" style="border-left-color:#22c55e;">
            <div class="pi-kpi-label">📝 Precisión media · Textos</div>
            <div class="pi-kpi-value">${fmt(promPrecisionTextos, 1, '%')}</div>
            <div class="pi-kpi-sub">Prueba 1</div>
        </div>
        <div class="pi-kpi-card" style="border-left-color:#eab308;">
            <div class="pi-kpi-label">🔢 Errores medios · TPL</div>
            <div class="pi-kpi-value">${fmt(promErroresTpl, 1)}</div>
            <div class="pi-kpi-sub">Prueba 2 (menor es mejor)</div>
        </div>
        <div class="pi-kpi-card" style="border-left-color:#a855f7;">
            <div class="pi-kpi-label">🗺️ Puntuación media · Medellín</div>
            <div class="pi-kpi-value">${fmt(promPuntuacion, 1, '%')}</div>
            <div class="pi-kpi-sub">Prueba 3</div>
        </div>
        <div class="pi-kpi-card" style="border-left-color:#38bdf8;">
            <div class="pi-kpi-label">🏆 Desempeño global</div>
            <div class="pi-kpi-value" style="color:${piColorForPercent(promGlobal)};">${fmt(promGlobal, 1, '%')}</div>
            <div class="pi-kpi-sub">Promedio de las 3 pruebas</div>
        </div>
    `;

    renderPromediosChart({
        precisionTextos: promPrecisionTextos,
        precisionTpl: piAverage(metrics.map(m => m.p2Precision)),
        puntuacion: promPuntuacion
    });

    renderPuntuacionChart(metrics.map(m => m.p3Puntuacion).filter(v => v !== null));

    summary.style.display = 'block';
}

function renderPromediosChart(vals) {
    const canvas = document.getElementById('chart-pi-promedios');
    if (!canvas || typeof Chart === 'undefined') return;

    const labels = ['Textos (precisión)', 'TPL (precisión)', 'Medellín'];
    const data = [
        vals.precisionTextos === null ? 0 : Number(vals.precisionTextos.toFixed(1)),
        vals.precisionTpl === null ? 0 : Number(vals.precisionTpl.toFixed(1)),
        vals.puntuacion === null ? 0 : Number(vals.puntuacion.toFixed(1))
    ];

    if (PI_CHART_INSTANCES[canvas.id]) {
        PI_CHART_INSTANCES[canvas.id].destroy();
    }

    PI_CHART_INSTANCES[canvas.id] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Promedio (%)',
                data,
                backgroundColor: [
                    'rgba(59, 130, 246, 0.75)',
                    'rgba(234, 179, 8, 0.75)',
                    'rgba(168, 85, 247, 0.75)'
                ],
                borderColor: ['#3b82f6', '#eab308', '#a855f7'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            scales: {
                x: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(148,163,184,0.12)' } },
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { color: '#cbd5e1', callback: (v) => v + '%' },
                    grid: { color: 'rgba(148,163,184,0.12)' }
                }
            }
        }
    });
}

function renderPuntuacionChart(values) {
    const canvas = document.getElementById('chart-pi-puntuacion');
    if (!canvas || typeof Chart === 'undefined') return;

    // Distribución por rangos de puntuación
    const buckets = { '0-20%': 0, '21-40%': 0, '41-60%': 0, '61-80%': 0, '81-100%': 0 };
    values.forEach((v) => {
        if (v <= 20) buckets['0-20%']++;
        else if (v <= 40) buckets['21-40%']++;
        else if (v <= 60) buckets['41-60%']++;
        else if (v <= 80) buckets['61-80%']++;
        else buckets['81-100%']++;
    });

    if (PI_CHART_INSTANCES[canvas.id]) {
        PI_CHART_INSTANCES[canvas.id].destroy();
    }

    PI_CHART_INSTANCES[canvas.id] = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: Object.keys(buckets),
            datasets: [{
                data: Object.values(buckets),
                backgroundColor: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'],
                borderColor: '#0f172a',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#cbd5e1' } }
            }
        }
    });
}

// --- Tabla ---
function renderTable(rows) {
    const tableContainer = document.getElementById('tableContainer');

    if (!rows.length) {
        tableContainer.innerHTML = '<div class="pi-empty">🔎 No hay resultados que coincidan con el filtro.</div>';
        return;
    }

    let html = `
        <div style="margin-bottom:10px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;color:#cbd5e1;">
            <span class="record-count">👥 ${rows.length} participante(s) mostrado(s)</span>
            <span class="record-count">🗄️ ${piLoadedCount} registro(s) en total</span>
        </div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>👤 Nombre</th>
                    <th>Cédula</th>
                    <th>Edad</th>
                    <th>📝 P1 · Precisión</th>
                    <th>📝 P1 · Velocidad</th>
                    <th>🔢 P2 · Correctas</th>
                    <th>🔢 P2 · Errores</th>
                    <th>🗺️ P3 · Puntuación</th>
                    <th>🏆 Global</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>
    `;

    rows.forEach((row) => {
        const m = computeRowMetrics(row);
        const completada = row.prueba_completada === true;

        html += `<tr>
            <td style="white-space:nowrap;">${piFormatDate(row.created_at || row.fecha)}</td>
            <td style="font-weight:600;color:#e2e8f0;">${piEsc(row.nombre || '-')}</td>
            <td>${piEsc(row.cedula || '-')}</td>
            <td style="text-align:center;">${piEsc(row.edad ?? '-')}</td>
            <td>
                ${piPercentBar(m.p1Precision)}
                <div style="font-size:11px;color:#94a3b8;text-align:center;">${m.p1Exactos !== null ? m.p1Exactos + '/10 exactos' : ''}</div>
            </td>
            <td style="white-space:nowrap;">${piNum(m.p1Vel) !== null ? Math.round(m.p1Vel) + ' car/min' : '-'}</td>
            <td style="text-align:center;">${m.p2Correctas !== null ? m.p2Correctas + '/10' : '-'}</td>
            <td style="text-align:center;color:${(m.p2Errores || 0) > 0 ? '#ef4444' : '#22c55e'};font-weight:700;">${m.p2Errores ?? '-'}</td>
            <td>${piPercentBar(m.p3Puntuacion)}</td>
            <td style="text-align:center;font-weight:700;color:${piColorForPercent(m.global)};">${m.global !== null ? m.global.toFixed(1) + '%' : '-'}</td>
            <td style="text-align:center;">
                <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;${completada
                    ? 'background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid #22c55e;'
                    : 'background:rgba(234,179,8,0.15);color:#eab308;border:1px solid #eab308;'}">
                    ${completada ? 'Completada' : 'Incompleta'}
                </span>
            </td>
        </tr>`;
    });

    html += '</tbody></table>';
    tableContainer.innerHTML = html;
}

function renderAll(rows, filters) {
    renderSummary(rows);
    renderTable(rows);
}

// --- Exportación ---
function exportToExcel() {
    const rows = piFilteredData.length ? piFilteredData : piAllData;
    if (!rows.length) {
        showMessage('No hay resultados para exportar.', 'error');
        return;
    }

    try {
        const exportRows = rows.map((row) => {
            const m = computeRowMetrics(row);
            return {
                'Fecha': piFormatDate(row.created_at || row.fecha),
                'Nombre': row.nombre || '',
                'Edad': row.edad ?? '',
                'Cédula': row.cedula || '',
                'P1 Tiempo (s)': m.p1Tiempo ?? '',
                'P1 Textos exactos': m.p1Exactos ?? '',
                'P1 Precisión (%)': m.p1Precision !== null ? Number(m.p1Precision.toFixed(1)) : '',
                'P1 Velocidad (car/min)': m.p1Vel ?? '',
                'P1 Errores': m.p1Errores ?? '',
                'P2 Tiempo (s)': m.p2Tiempo ?? '',
                'P2 Correctas': m.p2Correctas ?? '',
                'P2 Errores': m.p2Errores ?? '',
                'P2 Precisión (%)': m.p2Precision !== null ? Number(m.p2Precision.toFixed(1)) : '',
                'P3 Tiempo (s)': m.p3Tiempo ?? '',
                'P3 Correctas': m.p3Correctas ?? '',
                'P3 Incorrectas': m.p3Incorrectas ?? '',
                'P3 Puntuación (%)': m.p3Puntuacion ?? '',
                'Global (%)': m.global !== null ? Number(m.global.toFixed(1)) : '',
                'Completada': row.prueba_completada === true ? 'Sí' : 'No'
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Pruebas de Ingreso');

        const fecha = new Date().toISOString().slice(0, 10);
        const fileName = `pruebas_ingreso_${fecha}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        showMessage(`Exportado: ${exportRows.length} registro(s) en ${fileName}`, 'success');
    } catch (error) {
        handleError(error, 'al exportar pruebas de ingreso');
    }
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', function () {
    if (!window.supabase) {
        const tableContainer = document.getElementById('tableContainer');
        if (tableContainer) {
            tableContainer.innerHTML = '<div class="pi-empty" style="color:#ef4444;">❌ Supabase no está disponible.</div>';
        }
        return;
    }
    loadData();
});
