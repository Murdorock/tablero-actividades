// Logica especifica para Resumen Repartida
const PRIMARY_KEY = 'sup';
// TABLE_NAME y TABLE_TITLE se definen en el HTML

let supervisoresData = [];
let detalleRepartidaData = [];
let detalleSearchTerm = '';
let isLoading = false;
const summaryChartInstances = {};

function toNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    const normalized = String(value).replace(/,/g, '.').trim();
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
}

function formatNumber(value, decimals = 0) {
    return Number(value || 0).toLocaleString('es-ES', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function normalizeKey(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim().toUpperCase();
}

function hasTextValue(value) {
    if (value === null || value === undefined) return false;
    return String(value).trim() !== '';
}

async function loadData() {
    console.log('Cargando datos de supervisores desde', TABLE_NAME);
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');

    if (!loadingIndicator || !tableContainer) {
        console.error('Elementos DOM no encontrados');
        return;
    }

    if (isLoading) {
        console.log('Ya hay una carga en proceso');
        return;
    }

    try {
        isLoading = true;
        loadingIndicator.style.display = 'block';
        tableContainer.innerHTML = '';
        clearSummaryDashboard();

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('sup, codigo, id_correria, controles, certificaciones, entrega')
            .limit(10000);

        if (error) {
            throw error;
        }

        const { data: certificacionesData, error: certificacionesError } = await supabase
            .from('certificaciones_reparto')
            .select('numero_correria, nombre_correria, certificacion_nombre_del_cliente')
            .limit(50000);

        if (certificacionesError) {
            throw certificacionesError;
        }

        const controlEntregaByCorreria = {};
        const certificacionesByCorreria = {};
        const paqueteEntregaByCorreria = {};

        (certificacionesData || []).forEach(row => {
            const nombreCorreria = String(row?.nombre_correria || '').toUpperCase();
            const correriaKey = normalizeKey(row?.numero_correria);
            if (!correriaKey) return;

            if (nombreCorreria.includes('CONTROL ENTREGA')) {
                if (!controlEntregaByCorreria[correriaKey]) {
                    controlEntregaByCorreria[correriaKey] = { total: 0, realizados: 0 };
                }

                controlEntregaByCorreria[correriaKey].total += 1;
                if (hasTextValue(row?.certificacion_nombre_del_cliente)) {
                    controlEntregaByCorreria[correriaKey].realizados += 1;
                }
            }

            if (nombreCorreria.includes('CERTIFICACIONES')) {
                if (!certificacionesByCorreria[correriaKey]) {
                    certificacionesByCorreria[correriaKey] = { total: 0, realizados: 0 };
                }

                certificacionesByCorreria[correriaKey].total += 1;
                if (hasTextValue(row?.certificacion_nombre_del_cliente)) {
                    certificacionesByCorreria[correriaKey].realizados += 1;
                }
            }

            if (nombreCorreria.includes('PAQUETE ENTREGA')) {
                if (!paqueteEntregaByCorreria[correriaKey]) {
                    paqueteEntregaByCorreria[correriaKey] = { total: 0, realizados: 0 };
                }

                paqueteEntregaByCorreria[correriaKey].total += 1;
                if (hasTextValue(row?.certificacion_nombre_del_cliente)) {
                    paqueteEntregaByCorreria[correriaKey].realizados += 1;
                }
            }
        });

        const aggregateBySup = {};
        detalleRepartidaData = [];

        (data || []).forEach(row => {
            const supRaw = row?.sup;
            if (!supRaw || String(supRaw).trim() === '') return;

            const sup = String(supRaw).trim();
            if (!aggregateBySup[sup]) {
                aggregateBySup[sup] = {
                    supervisor: sup,
                    cantidad: 0,
                    controles: 0,
                    certificaciones: 0,
                    entrega: 0
                };
            }

            const controlesValor = Math.round(toNumber(row?.controles));
            const certificacionesValor = Math.round(toNumber(row?.certificaciones));
            const entregaValor = Math.round(toNumber(row?.entrega));

            aggregateBySup[sup].cantidad += 1;
            aggregateBySup[sup].controles += controlesValor;
            aggregateBySup[sup].certificaciones += certificacionesValor;
            aggregateBySup[sup].entrega += entregaValor;

            const idCorreria = row?.id_correria ?? '-';
            const correriaKey = normalizeKey(idCorreria);
            const statsControl = controlEntregaByCorreria[correriaKey] || { total: 0, realizados: 0 };
            const statsCertificaciones = certificacionesByCorreria[correriaKey] || { total: 0, realizados: 0 };
            const statsPaqueteEntrega = paqueteEntregaByCorreria[correriaKey] || { total: 0, realizados: 0 };
            const realizadosControlEntrega = Math.round(statsControl.realizados || 0);
            const realizadosCertificaciones = Math.round(statsCertificaciones.realizados || 0);
            const realizadosEntrega = Math.round(statsPaqueteEntrega.realizados || 0);
            const pendientesControles = Math.max(controlesValor - realizadosControlEntrega, 0);
            const pendientesCertificaciones = Math.max(certificacionesValor - realizadosCertificaciones, 0);
            const pendientesEntrega = Math.max(entregaValor - realizadosEntrega, 0);

            detalleRepartidaData.push({
                sup,
                codigo: row?.codigo ?? '-',
                id_correria: idCorreria,
                controles: controlesValor,
                certificaciones: certificacionesValor,
                entrega: entregaValor,
                realizados_control_entrega: realizadosControlEntrega,
                realizados_certificaciones: realizadosCertificaciones,
                realizados_entrega: realizadosEntrega,
                pendientes_controles: pendientesControles,
                pendientes_certificaciones: pendientesCertificaciones,
                pendientes_entrega: pendientesEntrega
            });
        });

        supervisoresData = Object.values(aggregateBySup).map(item => ({
            ...item,
            promedioEntrega: item.cantidad > 0 ? item.entrega / item.cantidad : 0
        }));

        supervisoresData.sort((a, b) => a.supervisor.localeCompare(b.supervisor));
        renderTable();
    } catch (error) {
        console.error('Error al cargar datos:', error);

        const errorMessage = error?.message || 'Error desconocido';
        clearSummaryDashboard();

        tableContainer.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 2rem; color: #dc3545;">
                <h3>Error al cargar los datos</h3>
                <p><strong>Mensaje:</strong> ${errorMessage}</p>
                <p><strong>Tabla:</strong> ${TABLE_NAME}</p>
                <button onclick="loadData()" class="btn btn-primary" style="margin-top: 1rem;">Reintentar</button>
            </div>
        `;
    } finally {
        isLoading = false;
        loadingIndicator.style.display = 'none';
    }
}

function destroySummaryChart(chartId) {
    if (summaryChartInstances[chartId]) {
        summaryChartInstances[chartId].destroy();
        delete summaryChartInstances[chartId];
    }
}

function clearSummaryDashboard() {
    const dashboard = document.getElementById('summaryDashboard');
    const summaryKpis = document.getElementById('summaryKpis');

    destroySummaryChart('chart-registro-supervisores');
    destroySummaryChart('chart-descargas-supervisores');

    if (summaryKpis) {
        summaryKpis.innerHTML = '';
    }

    if (dashboard) {
        dashboard.style.display = 'none';
    }
}

function renderSummaryDashboard(data) {
    const dashboard = document.getElementById('summaryDashboard');
    const summaryKpis = document.getElementById('summaryKpis');

    if (!dashboard || !summaryKpis || !data || data.length === 0) {
        clearSummaryDashboard();
        return;
    }

    const totalSupervisores = data.length;
    const totalCantidad = data.reduce((sum, item) => sum + item.cantidad, 0);
    const totalControles = data.reduce((sum, item) => sum + item.controles, 0);
    const totalCertificaciones = data.reduce((sum, item) => sum + item.certificaciones, 0);
    const totalEntrega = data.reduce((sum, item) => sum + item.entrega, 0);
    const promedioEntregaGlobal = totalCantidad > 0 ? totalEntrega / totalCantidad : 0;

    summaryKpis.innerHTML = `
        <div class="resumen-kpi-card">
            <div class="resumen-kpi-label">Supervisores</div>
            <div class="resumen-kpi-value">${formatNumber(totalSupervisores)}</div>
            <div class="resumen-kpi-sub">Con dato en ${PRIMARY_KEY}</div>
        </div>
        <div class="resumen-kpi-card">
            <div class="resumen-kpi-label">Correrias asignadas</div>
            <div class="resumen-kpi-value">${formatNumber(totalCantidad)}</div>
            <div class="resumen-kpi-sub">Conteo de filas por supervisor</div>
        </div>
        <div class="resumen-kpi-card">
            <div class="resumen-kpi-label">Controles (suma)</div>
            <div class="resumen-kpi-value">${formatNumber(totalControles)}</div>
            <div class="resumen-kpi-sub">Sumatoria de columna controles</div>
        </div>
        <div class="resumen-kpi-card">
            <div class="resumen-kpi-label">Certificaciones (suma)</div>
            <div class="resumen-kpi-value">${formatNumber(totalCertificaciones)}</div>
            <div class="resumen-kpi-sub">Sumatoria de columna certificaciones</div>
        </div>
        <div class="resumen-kpi-card">
            <div class="resumen-kpi-label">Entrega (suma)</div>
            <div class="resumen-kpi-value">${formatNumber(totalEntrega)}</div>
            <div class="resumen-kpi-sub">Sumatoria de columna entrega</div>
        </div>
        <div class="resumen-kpi-card">
            <div class="resumen-kpi-label">Entrega promedio por correria</div>
            <div class="resumen-kpi-value">${formatNumber(promedioEntregaGlobal, 2)}</div>
            <div class="resumen-kpi-sub">Total entrega / total correrias</div>
        </div>
    `;

    renderAsignacionChart(data);
    renderEntregaChart(data);
    dashboard.style.display = 'block';
}

function getSummaryChartOptions(titleText) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false
        },
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
                grid: { color: 'rgba(148, 163, 184, 0.12)' },
                title: {
                    display: true,
                    text: 'Valor',
                    color: '#cbd5e1'
                }
            }
        }
    };
}

function renderAsignacionChart(data) {
    const chartId = 'chart-registro-supervisores';
    const canvas = document.getElementById(chartId);
    if (!canvas) return;

    const labels = data.map(item => item.supervisor);

    destroySummaryChart(chartId);
    summaryChartInstances[chartId] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Correrias asignadas',
                    data: data.map(item => item.cantidad),
                    backgroundColor: 'rgba(59, 130, 246, 0.72)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Controles',
                    data: data.map(item => item.controles),
                    backgroundColor: 'rgba(34, 197, 94, 0.72)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Certificaciones',
                    data: data.map(item => item.certificaciones),
                    backgroundColor: 'rgba(234, 179, 8, 0.72)',
                    borderColor: 'rgba(234, 179, 8, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: getSummaryChartOptions('Correrias, controles y certificaciones por supervisor')
    });
}

function renderEntregaChart(data) {
    const chartId = 'chart-descargas-supervisores';
    const canvas = document.getElementById(chartId);
    if (!canvas) return;

    const labels = data.map(item => item.supervisor);

    destroySummaryChart(chartId);
    summaryChartInstances[chartId] = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Entrega (suma)',
                    data: data.map(item => item.entrega),
                    backgroundColor: 'rgba(236, 72, 153, 0.72)',
                    borderColor: 'rgba(236, 72, 153, 1)',
                    borderWidth: 1
                },
                {
                    type: 'line',
                    label: 'Entrega promedio por correria',
                    data: data.map(item => item.promedioEntrega),
                    borderColor: 'rgba(56, 189, 248, 1)',
                    backgroundColor: 'rgba(56, 189, 248, 0.2)',
                    tension: 0.25,
                    fill: false
                }
            ]
        },
        options: getSummaryChartOptions('Entrega total y promedio por supervisor')
    });
}

function renderTable() {
    const tableContainer = document.getElementById('tableContainer');

    if (supervisoresData.length === 0) {
        clearSummaryDashboard();
        detalleRepartidaData = [];
        tableContainer.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 3rem;">
                <h3>No hay datos</h3>
                <p>No se encontraron supervisores con valor en ${PRIMARY_KEY}</p>
                <button onclick="loadData()" class="btn btn-primary">Actualizar</button>
            </div>
        `;
        return;
    }

    const totalCantidad = supervisoresData.reduce((sum, item) => sum + item.cantidad, 0);
    const totalControles = supervisoresData.reduce((sum, item) => sum + item.controles, 0);
    const totalCertificaciones = supervisoresData.reduce((sum, item) => sum + item.certificaciones, 0);
    const totalEntrega = supervisoresData.reduce((sum, item) => sum + item.entrega, 0);
    const promedioEntregaGlobal = totalCantidad > 0 ? totalEntrega / totalCantidad : 0;

    renderSummaryDashboard(supervisoresData);

    let tableHTML = `
        <div class="table-info" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <span class="record-count">Supervisores: ${formatNumber(supervisoresData.length)}</span>
            <span class="record-count">Correrias: ${formatNumber(totalCantidad)}</span>
        </div>
        <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #475569;">
                        <th style="padding: 0.75rem; border: 1px solid #475569; text-align: left; color: #f1f5f9; font-weight: bold;">Supervisor</th>
                        <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">Correrias asignadas</th>
                        <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">Controles (suma)</th>
                        <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">Certificaciones (suma)</th>
                        <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">Entrega (suma)</th>
                        <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">Entrega promedio</th>
                    </tr>
                </thead>
                <tbody>
    `;

    supervisoresData.forEach((item, index) => {
        tableHTML += `
            <tr style="background: ${index % 2 === 0 ? '#1e293b' : '#334155'};">
                <td style="padding: 0.75rem; border: 1px solid #475569; font-weight: bold; color: #e2e8f0;">${item.supervisor}</td>
                <td style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #cbd5e1; font-weight: bold;">${formatNumber(item.cantidad)}</td>
                <td style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #22c55e; font-weight: bold;">${formatNumber(item.controles)}</td>
                <td style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f59e0b; font-weight: bold;">${formatNumber(item.certificaciones)}</td>
                <td style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #ec4899; font-weight: bold;">${formatNumber(item.entrega)}</td>
                <td style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #38bdf8; font-weight: bold;">${formatNumber(item.promedioEntrega, 2)}</td>
            </tr>
        `;
    });

    tableHTML += `
                </tbody>
            </table>
        </div>

        <div style="margin-top: 2rem; padding: 1rem; background: #334155; border-radius: 0.5rem; border-left: 4px solid #3b82f6;">
            <h5 style="margin: 0 0 1rem 0; color: #f1f5f9;">Resumen estadistico</h5>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; color: #e2e8f0;">
                <div><strong style="color: #f1f5f9;">Supervisores:</strong> ${formatNumber(supervisoresData.length)}</div>
                <div><strong style="color: #f1f5f9;">Correrias:</strong> ${formatNumber(totalCantidad)}</div>
                <div><strong style="color: #f1f5f9;">Controles:</strong> ${formatNumber(totalControles)}</div>
                <div><strong style="color: #f1f5f9;">Certificaciones:</strong> ${formatNumber(totalCertificaciones)}</div>
                <div><strong style="color: #f1f5f9;">Entrega:</strong> ${formatNumber(totalEntrega)}</div>
                <div><strong style="color: #f1f5f9;">Entrega promedio:</strong> ${formatNumber(promedioEntregaGlobal, 2)}</div>
            </div>
        </div>
    `;

    if (detalleRepartidaData.length > 0) {
        const detalleOrdenado = [...detalleRepartidaData].sort((a, b) => {
            const bySup = a.sup.localeCompare(b.sup);
            if (bySup !== 0) return bySup;
            const byCodigo = String(a.codigo).localeCompare(String(b.codigo));
            if (byCodigo !== 0) return byCodigo;
            return String(a.id_correria).localeCompare(String(b.id_correria));
        });

        const filtro = detalleSearchTerm.trim().toLowerCase();
        const detalleFiltrado = filtro
            ? detalleOrdenado.filter(item => {
                return [item.sup, item.codigo, item.id_correria]
                    .map(v => String(v || '').toLowerCase())
                    .some(v => v.includes(filtro));
            })
            : detalleOrdenado;

        tableHTML += `
            <div style="margin-top: 2rem;">
                <div class="table-info" style="margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                    <span class="record-count">Detalle Repartida</span>
                    <span class="record-count">Filas: ${formatNumber(detalleFiltrado.length)} / ${formatNumber(detalleOrdenado.length)}</span>
                </div>
                <div style="margin-bottom: 0.75rem; display: flex; gap: 0.5rem; align-items: center;">
                    <input
                        type="text"
                        value="${detalleSearchTerm.replace(/"/g, '&quot;')}"
                        oninput="actualizarFiltroDetalle(this)"
                        placeholder="Buscar por SUP, CODIGO o ID_CORRERIA"
                        style="width: 100%; max-width: 420px; padding: 0.5rem 0.65rem; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #e2e8f0;"
                    />
                    ${detalleSearchTerm ? '<button class="btn btn-secondary" onclick="actualizarFiltroDetalle(\'\')">Limpiar</button>' : ''}
                </div>
                <div style="overflow-x: auto;">
                    <table class="data-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background-color: #475569;">
                                <th style="padding: 0.75rem; border: 1px solid #475569; text-align: left; color: #f1f5f9; font-weight: bold;">SUP</th>
                                <th style="padding: 0.75rem; border: 1px solid #475569; text-align: left; color: #f1f5f9; font-weight: bold;">CODIGO</th>
                                <th style="padding: 0.75rem; border: 1px solid #475569; text-align: left; color: #f1f5f9; font-weight: bold;">ID_CORRERIA</th>
                                <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">REALIZADOS CONTROL ENTREGA</th>
                                <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">CONTROLES</th>
                                <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">PEND. CONTROLES</th>
                                <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">CERTIFICACIONES</th>
                                <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">REALIZADOS CERTIFICACIONES</th>
                                <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">PEND. CERTIFICACIONES</th>
                                <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">ENTREGA</th>
                                <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">REALIZADOS ENTREGA</th>
                                <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">PEND. ENTREGA</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        detalleFiltrado.forEach((item, index) => {
            tableHTML += `
                <tr style="background: ${index % 2 === 0 ? '#1e293b' : '#334155'};">
                    <td style="padding: 0.65rem; border: 1px solid #475569; color: #e2e8f0; font-weight: 600;">${item.sup}</td>
                    <td style="padding: 0.65rem; border: 1px solid #475569; color: #cbd5e1;">${item.codigo}</td>
                    <td style="padding: 0.65rem; border: 1px solid #475569; color: #cbd5e1;">${item.id_correria}</td>
                    <td style="padding: 0.65rem; border: 1px solid #475569; text-align: center; color: #38bdf8; font-weight: 700;">${formatNumber(item.realizados_control_entrega)}</td>
                    <td style="padding: 0.65rem; border: 1px solid #475569; text-align: center; color: #22c55e; font-weight: 700;">${formatNumber(item.controles)}</td>
                    <td style="padding: 0.65rem; border: 1px solid #475569; text-align: center; color: #f87171; font-weight: 700;">${formatNumber(item.pendientes_controles)}</td>
                    <td style="padding: 0.65rem; border: 1px solid #475569; text-align: center; color: #f59e0b; font-weight: 700;">${formatNumber(item.certificaciones)}</td>
                    <td style="padding: 0.65rem; border: 1px solid #475569; text-align: center; color: #38bdf8; font-weight: 700;">${formatNumber(item.realizados_certificaciones)}</td>
                    <td style="padding: 0.65rem; border: 1px solid #475569; text-align: center; color: #f87171; font-weight: 700;">${formatNumber(item.pendientes_certificaciones)}</td>
                    <td style="padding: 0.65rem; border: 1px solid #475569; text-align: center; color: #ec4899; font-weight: 700;">${formatNumber(item.entrega)}</td>
                    <td style="padding: 0.65rem; border: 1px solid #475569; text-align: center; color: #38bdf8; font-weight: 700;">${formatNumber(item.realizados_entrega)}</td>
                    <td style="padding: 0.65rem; border: 1px solid #475569; text-align: center; color: #f87171; font-weight: 700;">${formatNumber(item.pendientes_entrega)}</td>
                </tr>
            `;
        });

        tableHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    tableContainer.innerHTML = tableHTML;
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando aplicacion de Resumen Repartida');

    if (!window.supabase) {
        const tableContainer = document.getElementById('tableContainer');
        if (tableContainer) {
            tableContainer.innerHTML = '<div style="color: red; text-align: center; padding: 2rem;">Error: Supabase no esta disponible</div>';
        }
        return;
    }

    setTimeout(() => {
        loadData();
    }, 100);
});

async function exportarTablas() {
    try {
        const loadingMsg = document.createElement('div');
        loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px 40px; border-radius: 10px; z-index: 10000; font-size: 1.1rem;';
        loadingMsg.innerHTML = 'Generando archivo Excel...';
        document.body.appendChild(loadingMsg);

        const wb = XLSX.utils.book_new();

        const { data, error } = await supabase
            .from('programacion_reparto')
            .select('*');

        if (error) {
            throw error;
        }

        if (data && data.length > 0) {
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, 'Programacion Reparto');
        }

        if (supervisoresData && supervisoresData.length > 0) {
            const wsResumen = XLSX.utils.json_to_sheet(supervisoresData);
            XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Repartida');
        }

        const fecha = new Date();
        const fechaStr = `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`;
        XLSX.writeFile(wb, `Resumen_Repartida_INMEL_${fechaStr}.xlsx`);

        document.body.removeChild(loadingMsg);
    } catch (error) {
        console.error('Error al exportar tablas:', error);
        const loadingMsg = document.querySelector('div[style*="Generando archivo"]');
        if (loadingMsg && loadingMsg.parentNode) {
            document.body.removeChild(loadingMsg);
        }
        alert('Error al exportar tablas: ' + (error?.message || 'Error desconocido'));
    }
}

function abrirModalCompacto() {
    const modal = document.getElementById('modalCompacto');
    const modalBody = document.getElementById('modalCompactoBody');

    if (detalleRepartidaData.length === 0) {
        alert('No hay datos para mostrar. Actualiza primero.');
        return;
    }

    const detalleOrdenado = [...detalleRepartidaData].sort((a, b) => {
        const bySup = a.sup.localeCompare(b.sup);
        if (bySup !== 0) return bySup;
        const byCodigo = String(a.codigo).localeCompare(String(b.codigo));
        if (byCodigo !== 0) return byCodigo;
        return String(a.id_correria).localeCompare(String(b.id_correria));
    });

    const filtro = detalleSearchTerm.trim().toLowerCase();
    const detalleFiltrado = filtro
        ? detalleOrdenado.filter(item => {
            return [item.sup, item.codigo, item.id_correria]
                .map(v => String(v || '').toLowerCase())
                .some(v => v.includes(filtro));
        })
        : detalleOrdenado;

    const totalControles = detalleFiltrado.reduce((sum, item) => sum + item.controles, 0);
    const totalPendControles = detalleFiltrado.reduce((sum, item) => sum + item.pendientes_controles, 0);
    const totalCertificaciones = detalleFiltrado.reduce((sum, item) => sum + item.certificaciones, 0);
    const totalPendCertificaciones = detalleFiltrado.reduce((sum, item) => sum + item.pendientes_certificaciones, 0);
    const totalEntrega = detalleFiltrado.reduce((sum, item) => sum + item.entrega, 0);
    const totalPendEntrega = detalleFiltrado.reduce((sum, item) => sum + item.pendientes_entrega, 0);

    let html = `
        <div id="compactShareCard" style="font-size: 0.62rem; background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 0.6rem; width: fit-content; margin: 0 auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; color: #e2e8f0;">
                <strong style="font-size: 0.75rem;">Resumen Repartida - Detalle</strong>
                <span style="font-size: 0.65rem; color: #94a3b8;">Filas: ${formatNumber(detalleFiltrado.length)} / ${formatNumber(detalleOrdenado.length)}</span>
            </div>
            <table style="width: auto; border-collapse: collapse; border: 2px solid #475569; margin: 0 auto; background: #1e293b;">
                <thead>
                    <tr style="background: #475569; color: white;">
                        <th style="padding: 0.2rem; border: 1px solid #475569; text-align: center; width: 50px;">SUP</th>
                        <th style="padding: 0.2rem; border: 1px solid #475569; text-align: center; width: 60px;">CODIGO</th>
                        <th style="padding: 0.2rem; border: 1px solid #475569; text-align: center; width: 70px;">ID_CORRERIA</th>
                        <th style="padding: 0.2rem; border: 1px solid #475569; text-align: center; width: 35px;">CTRL</th>
                        <th style="padding: 0.2rem; border: 1px solid #475569; text-align: center; width: 40px;">P_CTRL</th>
                        <th style="padding: 0.2rem; border: 1px solid #475569; text-align: center; width: 40px;">CERT</th>
                        <th style="padding: 0.2rem; border: 1px solid #475569; text-align: center; width: 40px;">P_CERT</th>
                        <th style="padding: 0.2rem; border: 1px solid #475569; text-align: center; width: 40px;">ENT</th>
                        <th style="padding: 0.2rem; border: 1px solid #475569; text-align: center; width: 40px;">P_ENT</th>
                    </tr>
                </thead>
                <tbody>
    `;

    detalleFiltrado.slice(0, 120).forEach((item, index) => {
        html += `
            <tr style="background: ${index % 2 === 0 ? '#1e293b' : '#334155'}; color: #e2e8f0;">
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569; font-weight: bold;">${item.sup}</td>
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569;">${item.codigo}</td>
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569;">${item.id_correria}</td>
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569; text-align: center;">${formatNumber(item.controles)}</td>
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569; text-align: center; color: #f87171;">${formatNumber(item.pendientes_controles)}</td>
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569; text-align: center;">${formatNumber(item.certificaciones)}</td>
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569; text-align: center; color: #f87171;">${formatNumber(item.pendientes_certificaciones)}</td>
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569; text-align: center;">${formatNumber(item.entrega)}</td>
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569; text-align: center; color: #f87171;">${formatNumber(item.pendientes_entrega)}</td>
            </tr>
        `;
    });

    html += `
                <tr style="background: #475569; color: white; font-weight: bold;">
                    <td style="padding: 0.2rem; border: 2px solid #475569; text-align: center;" colspan="3">TOTALES</td>
                    <td style="padding: 0.2rem; border: 2px solid #475569; text-align: center;">${formatNumber(totalControles)}</td>
                    <td style="padding: 0.2rem; border: 2px solid #475569; text-align: center;">${formatNumber(totalPendControles)}</td>
                    <td style="padding: 0.2rem; border: 2px solid #475569; text-align: center;">${formatNumber(totalCertificaciones)}</td>
                    <td style="padding: 0.2rem; border: 2px solid #475569; text-align: center;">${formatNumber(totalPendCertificaciones)}</td>
                    <td style="padding: 0.2rem; border: 2px solid #475569; text-align: center;">${formatNumber(totalEntrega)}</td>
                    <td style="padding: 0.2rem; border: 2px solid #475569; text-align: center;">${formatNumber(totalPendEntrega)}</td>
                </tr>
            </tbody>
        </table>
            <div style="margin-top: 0.35rem; text-align: right; color: #94a3b8; font-size: 0.62rem;">* Compacto muestra maximo 120 filas para compartir</div>
        </div>
        <div style="margin-top: 0.8rem; display: flex; gap: 0.5rem; justify-content: center;">
            <button class="btn btn-success" onclick="descargarCompactoImagen()">Descargar PNG</button>
        </div>
    </div>
    `;

    modalBody.innerHTML = html;
    modal.style.display = 'flex';
}

function actualizarFiltroDetalle(inputOrValue) {
    const value = typeof inputOrValue === 'string' ? inputOrValue : (inputOrValue?.value || '');
    const cursorPos = typeof inputOrValue === 'object' && inputOrValue ? inputOrValue.selectionStart : null;

    detalleSearchTerm = value;
    renderTable();

    if (cursorPos !== null) {
        requestAnimationFrame(() => {
            const input = document.querySelector('input[placeholder="Buscar por SUP, CODIGO o ID_CORRERIA"]');
            if (!input) return;
            input.focus();
            const safePos = Math.min(cursorPos, input.value.length);
            input.setSelectionRange(safePos, safePos);
        });
    }
}

function cerrarModalCompacto() {
    const modal = document.getElementById('modalCompacto');
    modal.style.display = 'none';
}

async function descargarCompactoImagen() {
    const target = document.getElementById('compactShareCard');
    if (!target) {
        alert('No se encontro la tabla compacta para exportar.');
        return;
    }

    if (!window.html2canvas) {
        alert('No se pudo cargar la libreria para exportar imagen.');
        return;
    }

    try {
        const canvas = await window.html2canvas(target, {
            backgroundColor: '#0f172a',
            scale: 2,
            useCORS: true
        });

        const link = document.createElement('a');
        const fecha = new Date();
        const fechaStr = `${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}`;
        link.download = `detalle_repartida_compacto_${fechaStr}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (error) {
        console.error('Error al exportar imagen compacta:', error);
        alert('No se pudo exportar la imagen.');
    }
}
