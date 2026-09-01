// Resumen Repartida - logica (programacion_lectura + certificaciones_reparto)
let allT0Data = [];
let allT1Data = [];
let allCertReales = {}; // funcionario -> { CERTIFICACION: n, 'CONTROL ENTREGA': n, 'PAQUETE ENTREGA': n }
const DETAIL_TYPES = ['CERTIFICACION', 'CONTROL ENTREGA', 'PAQUETE ENTREGA'];

// Mapea el tipo mostrado a la columna en programacion_lectura (cantidad esperada)
function tipoToCol(tipo) {
    const map = {
        'CERTIFICACION': 'certificaciones',
        'CONTROL ENTREGA': 'controles',
        'PAQUETE ENTREGA': 'paquetes_entrega'
    };
    return map[tipo] || null;
}

// Cantidad esperada de un tipo para una fila de programacion_lectura
function getTipoCount(row, tipo) {
    const col = tipoToCol(tipo);
    const v = row ? row[col] : 0;
    return Number(v) || 0;
}

function emptyRealCounts() {
    return { CERTIFICACION: 0, 'CONTROL ENTREGA': 0, 'PAQUETE ENTREGA': 0 };
}

// Cantidad real (hecha) de un tipo para un codigo, según certificaciones_reparto
function getTipoReal(codigo, tipo) {
    const c = allCertReales[String(codigo ?? '')];
    return c ? (c[tipo] || 0) : 0;
}

// Carga las filas de certificaciones_reparto y cuenta las "reales" (con
// certificacion_nombre_del_cliente con dato) agrupadas por funcionario y tipo.
async function fetchCertReales() {
    const PAGE = 1000;
    const counts = {};
    let pg = 0;

    while (true) {
        const { data: page, error } = await supabase
            .from('certificaciones_reparto')
            .select('funcionario, nombre_correria, certificacion_nombre_del_cliente')
            .range(pg * PAGE, (pg + 1) * PAGE - 1);

        if (error) throw error;
        if (!page || page.length === 0) break;

        page.forEach(row => {
            const func = String(row.funcionario ?? '');
            const tipo = String(row.nombre_correria || '').trim().toUpperCase();
            if (!DETAIL_TYPES.includes(tipo)) return;

            if (!counts[func]) counts[func] = emptyRealCounts();

            const nombre = row.certificacion_nombre_del_cliente;
            if (nombre !== null && nombre !== undefined && String(nombre).trim() !== '') {
                counts[func][tipo]++;
            }
        });

        if (page.length < PAGE) break;
        pg++;
    }

    return counts;
}

// Muestra real/esperado; si hay pendiente (esperado > real), se resalta en rojo.
function fmtDetailValue(real, total) {
    const r = Number(real) || 0;
    const t = Number(total) || 0;
    const pend = Math.max(0, t - r);
    const txt = r + '/' + t;
    if (pend > 0) {
        return '<span style="color:#ef4444;font-weight:700;">' + txt + '</span>';
    }
    return txt;
}

function renderDetailedTable(containerId, countId, rows) {
    const container = document.getElementById(containerId);
    const count = document.getElementById(countId);

    if (!rows || rows.length === 0) {
        container.innerHTML = '<div class="rr-empty">Sin registros.</div>';
        count.textContent = '';
        return;
    }

    count.textContent = rows.length + ' registros';

    const pendingTotals = {
        CERTIFICACION: 0,
        'CONTROL ENTREGA': 0,
        'PAQUETE ENTREGA': 0
    };

    const hdrs = ['ID Correria','Codigo','Totales','CERTIFICACION','CONTROL ENTREGA','PAQUETE ENTREGA'];
    let html = '<table class="rr-table"><thead><tr>';
    hdrs.forEach(h => { html += '<th>' + h + '</th>'; });
    html += '</tr></thead><tbody>';

    rows.forEach(row => {
        DETAIL_TYPES.forEach(tipo => {
            const total = getTipoCount(row, tipo);
            const real = getTipoReal(row.codigo, tipo);
            pendingTotals[tipo] += Math.max(0, total - real);
        });

        html += '<tr>';
        html += '<td>' + (row.correria ?? '-') + '</td>';
        html += '<td>' + (row.codigo ?? '-') + '</td>';
        html += '<td>' + (row.facturas_individuales ?? '-') + '</td>';
        html += '<td class="c-cert">' + fmtDetailValue(getTipoReal(row.codigo, 'CERTIFICACION'), getTipoCount(row, 'CERTIFICACION')) + '</td>';
        html += '<td class="c-ctrl">' + fmtDetailValue(getTipoReal(row.codigo, 'CONTROL ENTREGA'), getTipoCount(row, 'CONTROL ENTREGA')) + '</td>';
        html += '<td class="c-paq">' + fmtDetailValue(getTipoReal(row.codigo, 'PAQUETE ENTREGA'), getTipoCount(row, 'PAQUETE ENTREGA')) + '</td>';
        html += '</tr>';
    });

    html += '</tbody><tfoot><tr>';
    html += '<td colspan="3" style="font-weight:700;color:#f1f5f9;background:#0f172a;border-top:1px solid #334155;">Pendiente total</td>';
    html += '<td style="font-weight:700;color:#ef4444;background:#0f172a;border-top:1px solid #334155;">' + pendingTotals.CERTIFICACION + '</td>';
    html += '<td style="font-weight:700;color:#ef4444;background:#0f172a;border-top:1px solid #334155;">' + pendingTotals['CONTROL ENTREGA'] + '</td>';
    html += '<td style="font-weight:700;color:#ef4444;background:#0f172a;border-top:1px solid #334155;">' + pendingTotals['PAQUETE ENTREGA'] + '</td>';
    html += '</tr></tfoot></table>';

    container.innerHTML = html;
}

function buildSupervisorSummaryRows(rows) {
    const grouped = {};

    (rows || []).forEach((row) => {
        const sup = row.realiza_zona || '-';
        if (!grouped[sup]) {
            grouped[sup] = {
                sup,
                correrias: 0,
                totales: 0,
                counts: emptyRealCounts(),
                esperados: emptyRealCounts(),
                pendientes: emptyRealCounts()
            };
        }

        grouped[sup].correrias += 1;
        grouped[sup].totales += Number(row.facturas_individuales || 0);

        DETAIL_TYPES.forEach((tipo) => {
            const total = getTipoCount(row, tipo);
            const real = getTipoReal(row.codigo, tipo);
            grouped[sup].esperados[tipo] += total;
            grouped[sup].counts[tipo] += real;
            grouped[sup].pendientes[tipo] += Math.max(0, total - real);
        });
    });

    return Object.values(grouped).sort((a, b) => String(a.sup).localeCompare(String(b.sup), 'es'));
}

function renderSupervisorSummaryTable(rows) {
    const container = document.getElementById('table0Container');
    const count = document.getElementById('countT0');

    if (!rows || rows.length === 0) {
        container.innerHTML = '<div class="rr-empty">Sin registros.</div>';
        count.textContent = '';
        return;
    }

    count.textContent = rows.length + ' supervisores';

    const pendingTotals = {
        CERTIFICACION: 0,
        'CONTROL ENTREGA': 0,
        'PAQUETE ENTREGA': 0
    };

    const hdrs = ['Supervisor','Correrias','Totales','CERTIFICACION','CONTROL ENTREGA','PAQUETE ENTREGA'];
    let html = '<table class="rr-table"><thead><tr>';
    hdrs.forEach((h) => { html += '<th>' + h + '</th>'; });
    html += '</tr></thead><tbody>';

    rows.forEach((row) => {
        DETAIL_TYPES.forEach(tipo => {
            pendingTotals[tipo] += row.pendientes[tipo] || 0;
        });

        html += '<tr>';
        html += '<td>' + (row.sup ?? '-') + '</td>';
        html += '<td>' + (row.correrias ?? 0) + '</td>';
        html += '<td>' + (row.totales ?? 0) + '</td>';
        html += '<td class="c-cert">' + fmtDetailValue(row.counts.CERTIFICACION || 0, row.esperados.CERTIFICACION || 0) + '</td>';
        html += '<td class="c-ctrl">' + fmtDetailValue(row.counts['CONTROL ENTREGA'] || 0, row.esperados['CONTROL ENTREGA'] || 0) + '</td>';
        html += '<td class="c-paq">' + fmtDetailValue(row.counts['PAQUETE ENTREGA'] || 0, row.esperados['PAQUETE ENTREGA'] || 0) + '</td>';
        html += '</tr>';
    });

    html += '</tbody><tfoot><tr>';
    html += '<td colspan="3" style="font-weight:700;color:#f1f5f9;background:#0f172a;border-top:1px solid #334155;">Pendiente total</td>';
    html += '<td style="font-weight:700;color:#ef4444;background:#0f172a;border-top:1px solid #334155;">' + pendingTotals.CERTIFICACION + '</td>';
    html += '<td style="font-weight:700;color:#ef4444;background:#0f172a;border-top:1px solid #334155;">' + pendingTotals['CONTROL ENTREGA'] + '</td>';
    html += '<td style="font-weight:700;color:#ef4444;background:#0f172a;border-top:1px solid #334155;">' + pendingTotals['PAQUETE ENTREGA'] + '</td>';
    html += '</tr></tfoot></table>';

    container.innerHTML = html;
}

async function loadTable1() {
    const container = document.getElementById('table1Container');
    const summaryContainer = document.getElementById('table0Container');
    if (summaryContainer) {
        summaryContainer.innerHTML = '<div class="rr-loading">Cargando...</div>';
    }
    container.innerHTML = '<div class="rr-loading">Cargando...</div>';
    try {
        // Cargar conteos "reales" de certificaciones_reparto (agrupados por funcionario/tipo)
        allCertReales = await fetchCertReales();

        const { data, error } = await supabase
            .from('programacion_lectura')
            .select('correria, realiza_zona, codigo, facturas_individuales, certificaciones, controles, paquetes_entrega')
            .order('codigo', { ascending: true });
        if (error) throw error;

        const baseRows = data || [];

        allT1Data = baseRows.map(row => ({ ...row }));
        allT0Data = buildSupervisorSummaryRows(allT1Data);

        renderSupervisorSummaryTable(allT0Data);
        renderTable1(allT1Data);
    } catch (err) {
        console.error(err);
        if (summaryContainer) {
            summaryContainer.innerHTML = '<div class="rr-empty" style="color:#ef4444;">Error: ' + err.message + '</div>';
        }
        container.innerHTML = '<div class="rr-empty" style="color:#ef4444;">Error: ' + err.message + '</div>';
    }
}

function renderTable1(data) {
    renderDetailedTable('table1Container', 'countT1', data);
}

function filterTable1(q) {
    const t = q.trim().toLowerCase();
    if (!t) { renderTable1(allT1Data); return; }
    renderTable1(allT1Data.filter(row =>
        ['correria', 'codigo'].some(c => {
            const v = row[c];
            return v !== null && v !== undefined && String(v).toLowerCase().includes(t);
        })
    ));
}

async function exportSummaryAsImage() {
    const section = document.getElementById('summaryExportSection');
    const tableContainer = document.getElementById('table0Container');

    if (!section || !tableContainer || !tableContainer.querySelector('table')) {
        alert('No hay resumen cargado para exportar.');
        return;
    }

    try {
        const exportWrapper = document.createElement('div');
        exportWrapper.style.position = 'fixed';
        exportWrapper.style.left = '-100000px';
        exportWrapper.style.top = '0';
        exportWrapper.style.padding = '12px';
        exportWrapper.style.background = '#0f172a';
        exportWrapper.style.zIndex = '-1';

        const clone = section.cloneNode(true);
        clone.style.width = '1080px';
        clone.style.margin = '0';
        clone.style.padding = '14px';
        clone.style.borderRadius = '10px';

        const cloneButton = clone.querySelector('#exportSummaryImageBtn');
        if (cloneButton) cloneButton.remove();

        const cloneTitle = clone.querySelector('h2');
        if (cloneTitle) {
            cloneTitle.style.fontSize = '18px';
            cloneTitle.style.marginBottom = '10px';
        }

        const cloneToolbar = clone.querySelector('.rr-toolbar');
        if (cloneToolbar) {
            cloneToolbar.remove();
        }

        const cloneCount = clone.querySelector('#countT0');
        if (cloneCount) {
            cloneCount.style.fontSize = '11px';
            cloneCount.style.marginBottom = '6px';
        }

        const cloneScroll = clone.querySelector('.rr-scroll');
        if (cloneScroll) {
            cloneScroll.style.maxHeight = 'none';
            cloneScroll.style.height = 'auto';
            cloneScroll.style.overflow = 'visible';
            cloneScroll.style.borderRadius = '6px';
        }

        clone.querySelectorAll('.rr-table th').forEach((th) => {
            th.style.position = 'static';
            th.style.fontSize = '11px';
            th.style.padding = '7px 8px';
        });

        clone.querySelectorAll('.rr-table td').forEach((td) => {
            td.style.fontSize = '11px';
            td.style.padding = '6px 8px';
        });

        clone.querySelectorAll('.rr-table').forEach((table) => {
            table.style.fontSize = '11px';
        });

        exportWrapper.appendChild(clone);
        document.body.appendChild(exportWrapper);

        const canvas = await html2canvas(clone, {
            backgroundColor: '#1e293b',
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 1080,
            windowHeight: clone.scrollHeight
        });

        document.body.removeChild(exportWrapper);

        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'resumen_supervisores.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error('Error exportando resumen:', err);
        alert('No fue posible exportar la imagen del resumen.');
    }
}

async function exportDetailAsImage() {
    const sup = document.getElementById('supSelect')?.value || '';
    const section = document.getElementById('detailExportSection');
    const tableContainer = document.getElementById('table2Container');

    if (!sup) {
        alert('Seleccione un supervisor antes de exportar.');
        return;
    }

    if (!section || !tableContainer || !tableContainer.querySelector('table')) {
        alert('No hay detalle cargado para exportar.');
        return;
    }

    try {
        const exportWrapper = document.createElement('div');
        exportWrapper.style.position = 'fixed';
        exportWrapper.style.left = '-100000px';
        exportWrapper.style.top = '0';
        exportWrapper.style.padding = '12px';
        exportWrapper.style.background = '#0f172a';
        exportWrapper.style.zIndex = '-1';

        const clone = section.cloneNode(true);
        clone.style.width = '1080px';
        clone.style.margin = '0';
        clone.style.padding = '14px';
        clone.style.borderRadius = '10px';

        const cloneButton = clone.querySelector('#exportDetailImageBtn');
        if (cloneButton) cloneButton.remove();

        const cloneTitle = clone.querySelector('h2');
        if (cloneTitle) {
            cloneTitle.style.fontSize = '18px';
            cloneTitle.style.marginBottom = '10px';
        }

        const cloneToolbar = clone.querySelector('.rr-toolbar');
        if (cloneToolbar) {
            cloneToolbar.style.marginBottom = '6px';
            cloneToolbar.style.gap = '8px';
        }

        const cloneSelect = clone.querySelector('#supSelect');
        if (cloneSelect) {
            const supBadge = document.createElement('div');
            supBadge.textContent = 'Supervisor: ' + sup;
            supBadge.style.display = 'inline-block';
            supBadge.style.padding = '6px 10px';
            supBadge.style.fontSize = '12px';
            supBadge.style.fontWeight = '700';
            supBadge.style.color = '#f1f5f9';
            supBadge.style.background = '#0f172a';
            supBadge.style.border = '1px solid #334155';
            supBadge.style.borderRadius = '6px';
            supBadge.style.minWidth = '170px';
            cloneSelect.parentNode.insertBefore(supBadge, cloneSelect);
            cloneSelect.remove();
        }

        const cloneCount = clone.querySelector('#countT2');
        if (cloneCount) {
            cloneCount.style.fontSize = '11px';
            cloneCount.style.marginBottom = '6px';
        }

        const cloneScroll = clone.querySelector('.rr-scroll');
        if (cloneScroll) {
            cloneScroll.style.maxHeight = 'none';
            cloneScroll.style.height = 'auto';
            cloneScroll.style.overflow = 'visible';
            cloneScroll.style.borderRadius = '6px';
        }

        clone.querySelectorAll('.rr-table th').forEach((th) => {
            th.style.position = 'static';
            th.style.fontSize = '11px';
            th.style.padding = '7px 8px';
        });

        clone.querySelectorAll('.rr-table td').forEach((td) => {
            td.style.fontSize = '11px';
            td.style.padding = '6px 8px';
        });

        clone.querySelectorAll('.rr-table').forEach((table) => {
            table.style.fontSize = '11px';
        });

        exportWrapper.appendChild(clone);
        document.body.appendChild(exportWrapper);

        const canvas = await html2canvas(clone, {
            backgroundColor: '#1e293b',
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 1080,
            windowHeight: clone.scrollHeight
        });

        document.body.removeChild(exportWrapper);

        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'detalle_repartida_' + sup + '.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error('Error exportando imagen:', err);
        alert('No fue posible exportar la imagen.');
    }
}

// ─── TABLA 2 ──────────────────────────────────────────────────────────────────
// Filtro: supervisor unico (columna realiza_zona de programacion_lectura).
// Conteos por tipo desde las columnas certificaciones | controles | paquetes_entrega

async function loadSupOptions() {
    const sel = document.getElementById('supSelect');
    try {
        const { data, error } = await supabase
            .from('programacion_lectura')
            .select('realiza_zona')
            .order('realiza_zona', { ascending: true });
        if (error) throw error;
        const unique = [...new Set((data || []).map(r => r.realiza_zona).filter(v => v !== null && String(v).trim() !== ''))];
        unique.forEach(sup => {
            const opt = document.createElement('option');
            opt.value = sup;
            opt.textContent = sup;
            sel.appendChild(opt);
        });
    } catch (err) { console.error('Error sup options:', err); }
}

async function loadTable2(sup) {
    const container = document.getElementById('table2Container');
    const count     = document.getElementById('countT2');
    if (!sup) {
        container.innerHTML = '<div class="rr-empty">Seleccione un supervisor para ver el detalle.</div>';
        count.textContent = '';
        return;
    }
    container.innerHTML = '<div class="rr-loading">Cargando...</div>';
    count.textContent = '';

    try {
        // Asegurar que los conteos reales de certificaciones_reparto estén cargados
        if (Object.keys(allCertReales).length === 0) {
            allCertReales = await fetchCertReales();
        }

        // 1. Correrias del supervisor
        const { data: prog, error: progErr } = await supabase
            .from('programacion_lectura')
            .select('correria, codigo, facturas_individuales, certificaciones, controles, paquetes_entrega')
            .eq('realiza_zona', sup)
            .order('codigo', { ascending: true });
        if (progErr) throw progErr;
        if (!prog || prog.length === 0) {
            container.innerHTML = '<div class="rr-empty">No hay correrias para este supervisor.</div>';
            return;
        }

        const detailRows = prog.map(row => ({ ...row }));

        renderDetailedTable('table2Container', 'countT2', detailRows);

    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="rr-empty" style="color:#ef4444;">Error: ' + err.message + '</div>';
    }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    loadTable1();
    loadSupOptions();

    document.getElementById('searchT1').addEventListener('input', function () {
        filterTable1(this.value);
    });

    document.getElementById('supSelect').addEventListener('change', function () {
        loadTable2(this.value);
    });
});
