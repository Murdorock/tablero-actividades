// Resumen Repartida - logica limpia
let allT0Data = [];
let allT1Data = [];
const DETAIL_TYPES = ['CERTIFICACION', 'CONTROL ENTREGA', 'PAQUETE ENTREGA'];

function emptyTypeCounts() {
    return {
        CERTIFICACION: { total: 0, real: 0 },
        'CONTROL ENTREGA': { total: 0, real: 0 },
        'PAQUETE ENTREGA': { total: 0, real: 0 }
    };
}

async function fetchCertificationRows(ids) {
    if (!ids || ids.length === 0) return [];

    const PAGE = 1000;
    let allCert = [];
    let pg = 0;

    while (true) {
        const { data: certPage, error: certErr } = await supabase
            .from('certificaciones_reparto')
            .select('numero_correria, nombre_correria, certificacion_nombre_del_cliente')
            .in('numero_correria', ids)
            .range(pg * PAGE, (pg + 1) * PAGE - 1);

        if (certErr) throw certErr;
        if (!certPage || certPage.length === 0) break;

        allCert = allCert.concat(certPage);
        if (certPage.length < PAGE) break;
        pg++;
    }

    return allCert;
}

function buildCountsByCorreria(ids, certRows) {
    const counts = {};

    ids.forEach(id => {
        counts[id] = emptyTypeCounts();
    });

    (certRows || []).forEach(row => {
        const id = row.numero_correria;
        const tipo = String(row.nombre_correria || '').trim().toUpperCase();
        if (!counts[id] || !DETAIL_TYPES.includes(tipo)) return;

        counts[id][tipo].total++;

        const nombre = row.certificacion_nombre_del_cliente;
        if (nombre !== null && nombre !== undefined && String(nombre).trim() !== '') {
            counts[id][tipo].real++;
        }
    });

    return counts;
}

function fmtDetailValue(obj) {
    const txt = obj.real + '/' + obj.total;
    if (obj.total > 0 && obj.real < obj.total) {
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
        const c = row.counts || emptyTypeCounts();

        pendingTotals.CERTIFICACION += Math.max(0, c['CERTIFICACION'].total - c['CERTIFICACION'].real);
        pendingTotals['CONTROL ENTREGA'] += Math.max(0, c['CONTROL ENTREGA'].total - c['CONTROL ENTREGA'].real);
        pendingTotals['PAQUETE ENTREGA'] += Math.max(0, c['PAQUETE ENTREGA'].total - c['PAQUETE ENTREGA'].real);

        html += '<tr>';
        html += '<td>' + (row.id_correria ?? '-') + '</td>';
        html += '<td>' + (row.codigo ?? '-') + '</td>';
        html += '<td>' + (row.totales ?? '-') + '</td>';
        html += '<td class="c-cert">' + fmtDetailValue(c['CERTIFICACION']) + '</td>';
        html += '<td class="c-ctrl">' + fmtDetailValue(c['CONTROL ENTREGA']) + '</td>';
        html += '<td class="c-paq">' + fmtDetailValue(c['PAQUETE ENTREGA']) + '</td>';
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
        const sup = row.sup || '-';
        if (!grouped[sup]) {
            grouped[sup] = {
                sup,
                correrias: 0,
                totales: 0,
                counts: emptyTypeCounts()
            };
        }

        grouped[sup].correrias += 1;
        grouped[sup].totales += Number(row.totales || 0);

        DETAIL_TYPES.forEach((tipo) => {
            grouped[sup].counts[tipo].total += row.counts?.[tipo]?.total || 0;
            grouped[sup].counts[tipo].real += row.counts?.[tipo]?.real || 0;
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
        const c = row.counts || emptyTypeCounts();

        pendingTotals.CERTIFICACION += Math.max(0, c['CERTIFICACION'].total - c['CERTIFICACION'].real);
        pendingTotals['CONTROL ENTREGA'] += Math.max(0, c['CONTROL ENTREGA'].total - c['CONTROL ENTREGA'].real);
        pendingTotals['PAQUETE ENTREGA'] += Math.max(0, c['PAQUETE ENTREGA'].total - c['PAQUETE ENTREGA'].real);

        html += '<tr>';
        html += '<td>' + (row.sup ?? '-') + '</td>';
        html += '<td>' + (row.correrias ?? 0) + '</td>';
        html += '<td>' + (row.totales ?? 0) + '</td>';
        html += '<td class="c-cert">' + fmtDetailValue(c['CERTIFICACION']) + '</td>';
        html += '<td class="c-ctrl">' + fmtDetailValue(c['CONTROL ENTREGA']) + '</td>';
        html += '<td class="c-paq">' + fmtDetailValue(c['PAQUETE ENTREGA']) + '</td>';
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
        const { data, error } = await supabase
            .from('programacion_reparto')
            .select('sup, id_correria, codigo, totales')
            .order('codigo', { ascending: true });
        if (error) throw error;

        const baseRows = data || [];
        const ids = baseRows.map(row => row.id_correria);
        const certRows = await fetchCertificationRows(ids);
        const countsByCorreria = buildCountsByCorreria(ids, certRows);

        allT1Data = baseRows.map(row => ({
            ...row,
            counts: countsByCorreria[row.id_correria] || emptyTypeCounts()
        }));
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
        ['id_correria', 'codigo'].some(c => {
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
// Filtro: supervisor unico.
// Cruz: programacion_reparto (id_correria) <-> certificaciones_reparto (numero_correria)
// Conteos de nombre_correria: CERTIFICACION | CONTROL ENTREGA | PAQUETE ENTREGA

async function loadSupOptions() {
    const sel = document.getElementById('supSelect');
    try {
        const { data, error } = await supabase
            .from('programacion_reparto')
            .select('sup')
            .order('sup', { ascending: true });
        if (error) throw error;
        const unique = [...new Set((data || []).map(r => r.sup).filter(v => v !== null && String(v).trim() !== ''))];
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
        // 1. Correrias del supervisor
        const { data: prog, error: progErr } = await supabase
            .from('programacion_reparto')
            .select('id_correria, codigo, totales')
            .eq('sup', sup)
            .order('codigo', { ascending: true });
        if (progErr) throw progErr;
        if (!prog || prog.length === 0) {
            container.innerHTML = '<div class="rr-empty">No hay correrias para este supervisor.</div>';
            return;
        }

        const ids = prog.map(r => r.id_correria);
        const certRows = await fetchCertificationRows(ids);
        const countsByCorreria = buildCountsByCorreria(ids, certRows);
        const detailRows = prog.map(row => ({
            ...row,
            counts: countsByCorreria[row.id_correria] || emptyTypeCounts()
        }));

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
