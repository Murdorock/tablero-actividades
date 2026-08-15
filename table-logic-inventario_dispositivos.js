// Configuración específica para la Hoja de Vida de Dispositivos
const TABLE_NAME = 'dispositivos';
const PRIMARY_KEY = 'id';
const COLUMNA_RASTREO = 'codigo_utic'; // Columna que identifica a cada dispositivo

let currentData = [];
let tableColumns = [];
let currentCodigoUtic = null; // Código actualmente consultado
let currentSearchMode = null; // 'utic' (hoja de vida) o 'global'
let globalColumns = []; // Columnas de la tabla para búsqueda global

function isPhotoColumn(columnName = '') {
    const normalized = columnName.toLowerCase();
    return normalized.includes('foto') || normalized.includes('imagen') || normalized.includes('avatar')
        || normalized.includes('evidencia') || normalized.includes('firma');
}

function isImageUrl(value = '') {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    return /^https?:\/\//i.test(trimmed);
}

function looksLikePhotoValue(columnName, value) {
    if (!value || typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;

    const normalizedColumn = String(columnName || '').toLowerCase();
    const byColumnName = isPhotoColumn(columnName);
    const isHttpUrl = isImageUrl(trimmed);
    const byUrlColumn = normalizedColumn.includes('url') && isHttpUrl;
    const hasImageExt = /\.(png|jpe?g|webp|gif|bmp)(\?|#|$)/i.test(trimmed);
    const isSupabasePublicObject = /\/storage\/v1\/object\/public\//i.test(trimmed);

    return byColumnName || byUrlColumn || (isHttpUrl && (hasImageExt || isSupabasePublicObject));
}

function escapeHtmlAttr(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeJsString(value = '') {
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r?\n/g, ' ');
}

function openPhotoPreview(encodedUrl = '', altText = 'Evidencia del dispositivo') {
    const photoUrl = decodeURIComponent(encodedUrl);
    if (!isImageUrl(photoUrl)) return;

    const existing = document.getElementById('photoPreviewOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'photoPreviewOverlay';
    overlay.className = 'photo-preview-overlay';
    overlay.innerHTML = `
        <div class="photo-preview-content">
            <button type="button" class="photo-preview-close" aria-label="Cerrar vista previa">×</button>
            <img src="${escapeHtmlAttr(photoUrl)}" alt="${escapeHtmlAttr(altText)}" class="photo-preview-image">
        </div>
    `;

    const closePreview = () => {
        overlay.remove();
        document.removeEventListener('keydown', onEscClose);
    };

    const onEscClose = (event) => {
        if (event.key === 'Escape') {
            closePreview();
        }
    };

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closePreview();
        }
    });

    const closeButton = overlay.querySelector('.photo-preview-close');
    if (closeButton) {
        closeButton.addEventListener('click', closePreview);
    }

    document.addEventListener('keydown', onEscClose);
    document.body.appendChild(overlay);
}

function getPhotoCellHtml(photoUrl, altText = 'Evidencia', imageClass = 'personal-photo-thumb') {
    if (!photoUrl || !isImageUrl(photoUrl)) {
        return '<span class="photo-empty">Sin imagen</span>';
    }

    const safeUrl = escapeHtmlAttr(photoUrl);
    const safeAlt = escapeHtmlAttr(altText);
    const encodedUrl = encodeURIComponent(photoUrl);
    const safeEncodedUrl = escapeJsString(encodedUrl);
    const safeAltForJs = escapeJsString(altText);
    return `<button type="button" class="photo-thumb-btn" onclick="openPhotoPreview('${safeEncodedUrl}', '${safeAltForJs}')"><img src="${safeUrl}" alt="${safeAlt}" class="${imageClass}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'; this.parentElement.outerHTML='<span class=\'photo-empty\'>Sin imagen</span>';"/></button>`;
}

function getDisplayName(column) {
    return column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Columnas a mostrar en el grid de movimientos (hoja de vida)
function getGridColumns() {
    const prioridad = [
        'fecha', 'codigo_utic', 'codigo_soti', 'codigo_funcionario', 'estado',
        'marca', 'modelo', 'serie', 'responsable', 'soti', 'temis'
    ];
    const noMostrarGrid = ['id', 'id_inventario'];
    const evidencias = ['evidencias', 'evidencia2', 'evidencia3'];
    const columnas = tableColumns.filter(c => !noMostrarGrid.includes(c));
    columnas.sort((a, b) => {
        // Las columnas de evidencia se muestran al final
        const esEvidenciaA = evidencias.includes(a);
        const esEvidenciaB = evidencias.includes(b);
        if (esEvidenciaA && esEvidenciaB) {
            return evidencias.indexOf(a) - evidencias.indexOf(b);
        }
        if (esEvidenciaA) return 1;
        if (esEvidenciaB) return -1;
        const ia = prioridad.indexOf(a);
        const ib = prioridad.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
    });
    return columnas;
}

// Mostrar el resumen del dispositivo consultado
function renderResumen() {
    const resumenEl = document.getElementById('resumenDispositivo');
    if (!currentCodigoUtic) {
        resumenEl.style.display = 'none';
        return;
    }
    if (!currentData.length) {
        resumenEl.style.display = 'block';
        resumenEl.innerHTML = `<div class="no-data">No se encontraron movimientos para el dispositivo <strong>${escapeHtmlAttr(currentCodigoUtic)}</strong>.</div>`;
        return;
    }

    const totalMovimientos = currentData.length;
    const ultimo = currentData[0]; // ya ordenado por fecha desc
    const estadosUnicos = new Set(currentData.map(r => r['estado']).filter(Boolean));
    const modelo = ultimo['modelo'] || '-';
    const marca = ultimo['marca'] || '-';

    resumenEl.style.display = 'block';
    resumenEl.innerHTML = `
        <div class="resumen-card" style="background:#fff; border:1px solid #ddd; border-radius:8px; padding:14px; display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
            <div><span style="font-size:1.8em;">📱</span></div>
            <div>
                <strong style="font-size:1.2em;">${escapeHtmlAttr(currentCodigoUtic)}</strong>
                <div style="color:#666;">${escapeHtmlAttr(marca)} ${escapeHtmlAttr(modelo)}</div>
            </div>
            <div style="margin-left:auto; text-align:right; gap:16px; display:flex;">
                <div><strong>${totalMovimientos}</strong><br><span style="color:#666;">Movimientos</span></div>
                <div><strong>${estadosUnicos.size}</strong><br><span style="color:#666;">Estados</span></div>
                <div><strong>${escapeHtmlAttr(ultimo['estado'] || '-')}</strong><br><span style="color:#666;">Estado actual</span></div>
            </div>
        </div>
    `;
}

// Buscar la hoja de vida de un dispositivo por codigo_utic
async function buscarHojaDeVida() {
    const codigo = document.getElementById('codigoUtic').value.trim();
    if (!codigo) {
        alert('Ingresa un código UTIC para buscar.');
        return;
    }

    currentCodigoUtic = codigo;
    currentSearchMode = 'utic';
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    const btnExportar = document.getElementById('btnExportar');

    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';
    btnExportar.style.display = 'none';

    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq(COLUMNA_RASTREO, codigo)
            .order('fecha', { ascending: false });
        if (error) throw error;

        currentData = data || [];
        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]);
            renderTable(currentData);
            btnExportar.style.display = 'inline-block';
        } else {
            tableContainer.innerHTML = `<div class="no-data">No se encontraron movimientos para el código UTIC "${escapeHtmlAttr(codigo)}".</div>`;
        }
        renderResumen();
    } catch (error) {
        console.error('Error buscando hoja de vida:', error);
        tableContainer.innerHTML = '<div class="error">Error buscando hoja de vida: ' + error.message + '</div>';
        renderResumen();
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// "Consultar" recarga la búsqueda activa (hoja de vida o global).
function loadData() {
    if (currentSearchMode === 'global') {
        buscarGlobal();
    } else if (currentSearchMode === 'utic' || currentCodigoUtic) {
        buscarHojaDeVida();
    }
}

// Cargar las columnas disponibles de la tabla y llenar el select de búsqueda global.
async function cargarColumnasGlobal() {
    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .limit(1);
        if (error) throw error;

        let columnas = [];
        if (data && data.length > 0) {
            columnas = Object.keys(data[0]);
        }
        globalColumns = columnas;

        const select = document.getElementById('columnaGlobal');
        if (!select) return;
        select.innerHTML = '<option value="">Todas las columnas</option>';
        columnas.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = getDisplayName(col);
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error cargando columnas:', error);
    }
}

// Búsqueda global en toda la tabla dispositivos por una columna seleccionada.
async function buscarGlobal() {
    const valor = document.getElementById('busquedaGlobal').value.trim();
    const columna = document.getElementById('columnaGlobal').value;

    if (!valor) {
        alert('Ingresa un dato para buscar.');
        return;
    }

    currentCodigoUtic = null;
    currentSearchMode = 'global';

    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    const btnExportar = document.getElementById('btnExportar');

    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';
    btnExportar.style.display = 'none';

    // Ocultar el resumen de hoja de vida (no aplica a búsqueda global)
    const resumenEl = document.getElementById('resumenDispositivo');
    if (resumenEl) resumenEl.style.display = 'none';

    try {
        let data;
        let error;

        if (columna) {
            // Búsqueda por columna específica en el servidor
            const res = await supabase
                .from(TABLE_NAME)
                .select('*')
                .ilike(columna, `%${valor}%`)
                .order('fecha', { ascending: false });
            data = res.data;
            error = res.error;
        } else {
            // "Todas las columnas": se filtran en cliente
            const res = await supabase
                .from(TABLE_NAME)
                .select('*')
                .order('fecha', { ascending: false });
            data = res.data;
            error = res.error;
            if (!error && Array.isArray(data)) {
                const term = valor.toLowerCase();
                data = data.filter(row => {
                    return (globalColumns.length > 0 ? globalColumns : Object.keys(row)).some(col => {
                        const v = row[col];
                        return v != null && String(v).toLowerCase().includes(term);
                    });
                });
            }
        }

        if (error) throw error;

        currentData = data || [];
        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]);
            renderTable(currentData);
            btnExportar.style.display = 'inline-block';
        } else {
            tableContainer.innerHTML = `<div class="no-data">No se encontraron resultados para "${escapeHtmlAttr(valor)}".</div>`;
        }
    } catch (error) {
        console.error('Error en búsqueda global:', error);
        tableContainer.innerHTML = '<div class="error">Error en la búsqueda global: ' + error.message + '</div>';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Renderizar tabla de movimientos
function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    const gridColumns = getGridColumns();

    let filterHtml = `<div class="personal-table-wrapper"><div class="sticky-search-row personal-sticky-search" style="display: flex; gap: 10px; align-items: center;">
        <label for="filterSearch" style="font-weight:bold; font-size:1.1em;">Buscar:</label>
        <input type="text" id="filterSearch" style="width: 220px; height: 38px; font-size: 1.1em; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;" placeholder="Buscar..." autocomplete="off">
        <select id="filterColumn" style="min-width:150px; height: 38px; font-size: 1.1em; border-radius: 6px; border: 1px solid #ccc; padding: 6px 10px;"></select>
        <button type="button" id="btnClearFilter" class="btn btn-secondary btn-sm" style="height: 38px; font-size: 1.1em; border-radius: 6px;">Limpiar</button>
    </div>`;

    let html = '<table class="data-table"><thead><tr>';
    gridColumns.forEach(column => {
        html += `<th>${getDisplayName(column)}</th>`;
    });
    html += '<th>Acciones</th></tr></thead><tbody>';

    data.forEach(row => {
        const rowId = row[PRIMARY_KEY] || row[tableColumns[0]];
        html += '<tr>';
        gridColumns.forEach(column => {
            let value = row[column];

            // Columnas de evidencia: mostrar un enlace "Ver" que abre la URL
            if (['evidencias', 'evidencia2', 'evidencia3'].includes(column)) {
                if (isImageUrl(value)) {
                    html += `<td><a href="${escapeHtmlAttr(value.trim())}" target="_blank" rel="noopener" class="btn btn-link">Ver</a></td>`;
                } else {
                    html += `<td>-</td>`;
                }
                return;
            }

            if (looksLikePhotoValue(column, value)) {
                html += `<td>${getPhotoCellHtml(value, row['codigo_utic'] || 'Dispositivo')}</td>`;
                return;
            }

            if (value === null || value === undefined) {
                value = '';
            } else if (typeof value === 'string' && value.length > 60) {
                value = value.substring(0, 60) + '...';
            } else if (column.includes('fecha') || column.includes('date')) {
                if (value) {
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) {
                        value = date.toLocaleString('es-ES', { timeZone: 'UTC' });
                    }
                }
            }
            html += `<td>${value}</td>`;
        });
        html += `<td class="actions"><button class="btn btn-sm btn-info" onclick="viewDetails('${rowId}')" title="Ver detalles">👁️</button></td>`;
        html += '</tr>';
    });
    html += '</tbody></table></div>';

    tableContainer.innerHTML = filterHtml + html;

    const filterColumn = document.getElementById('filterColumn');
    if (filterColumn) {
        filterColumn.innerHTML = '<option value="">Todas las columnas</option>';
        gridColumns.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = getDisplayName(col);
            filterColumn.appendChild(option);
        });
    }

    const filterSearch = document.getElementById('filterSearch');
    const btnClearFilter = document.getElementById('btnClearFilter');
    if (filterSearch) {
        filterSearch.value = '';
        filterSearch.addEventListener('input', function() {
            applyFilter(this.value, filterColumn.value);
        });
    }
    if (filterColumn) {
        filterColumn.onchange = function() {
            applyFilter(filterSearch.value, this.value);
        };
    }
    if (btnClearFilter) {
        btnClearFilter.onclick = function() {
            filterSearch.value = '';
            filterColumn.value = '';
            renderTable(currentData);
            filterSearch.focus();
        };
    }
}

// Aplicar filtro
function applyFilter(searchText, filterColumn) {
    searchText = (searchText || '').toLowerCase().trim();
    const gridColumns = getGridColumns();
    if (!searchText) {
        renderTable(currentData);
        return;
    }
    let filteredData = currentData.filter(row => {
        if (filterColumn) {
            const value = row[filterColumn];
            return value != null && String(value).toLowerCase().includes(searchText);
        } else {
            return gridColumns.some(col => {
                const value = row[col];
                return value != null && String(value).toLowerCase().includes(searchText);
            });
        }
    });
    renderTable(filteredData);
}

// Ver detalles de un movimiento
async function viewDetails(id) {
    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq(PRIMARY_KEY, id)
            .single();

        if (error) throw error;

        let detailsHtml = '<div style="max-width: 600px; margin: 0 auto; padding: 10px;">';
        Object.entries(data).forEach(([key, value]) => {
            const displayName = getDisplayName(key);
            let displayValue = value || 'No especificado';

            if (looksLikePhotoValue(key, value)) {
                displayValue = getPhotoCellHtml(value, data['codigo_utic'] || 'Dispositivo', 'personal-photo-detail');
            } else if (key.includes('fecha') && value) {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    displayValue = date.toLocaleString('es-ES', { timeZone: 'UTC' });
                }
            }
            detailsHtml += `<p><strong>${displayName}:</strong> ${displayValue}</p>`;
        });
        detailsHtml += '</div>';

        document.getElementById('modalTitle').textContent = 'Detalles del Movimiento';
        document.getElementById('modalBody').innerHTML = detailsHtml;
        document.getElementById('dataModal').style.display = 'flex';
    } catch (error) {
        console.error('Error cargando detalles:', error);
        alert('Error cargando detalles: ' + error.message);
    }
}

function closeModal() {
    document.getElementById('dataModal').style.display = 'none';
}

// Valores planos para exportar (sin HTML de imágenes)
function getExportData() {
    const gridColumns = getGridColumns();
    return currentData.map(row => {
        const obj = {};
        gridColumns.forEach(col => {
            let value = row[col];
            if (value instanceof Date) value = value.toISOString();
            if (value != null && typeof value === 'object') value = JSON.stringify(value);
            obj[getDisplayName(col)] = value == null ? '' : String(value);
        });
        return obj;
    });
}

// Exportar hoja de vida a Excel (.xlsx)
function exportarExcel() {
    if (!currentData.length) {
        alert('No hay datos para exportar. Primero busca un código UTIC.');
        return;
    }

    const rowsData = getExportData();

    // Añadir resumen del dispositivo al inicio de la hoja
    const resumenData = [
        { 'Campo': 'Código UTIC', 'Valor': currentCodigoUtic || '' },
        { 'Campo': 'Total movimientos', 'Valor': currentData.length },
    ];
    const ultimo = currentData[0];
    if (ultimo) {
        resumenData.push({ 'Campo': 'Marca', 'Valor': ultimo['marca'] || '' });
        resumenData.push({ 'Campo': 'Modelo', 'Valor': ultimo['modelo'] || '' });
        resumenData.push({ 'Campo': 'Estado actual', 'Valor': ultimo['estado'] || '' });
        resumenData.push({ 'Campo': 'Última fecha', 'Valor': formatDate(ultimo['fecha']) });
    }

    let wb;

    if (typeof XLSX !== 'undefined') {
        // Usar SheetJS
        const wsResumen = XLSX.utils.json_to_sheet(resumenData);
        const wsMovimientos = XLSX.utils.json_to_sheet(rowsData);

        // Ajustar ancho de columnas
        wsMovimientos['!cols'] = (getGridColumns().map(c => ({ wch: Math.max(getDisplayName(c).length + 2, 14) })));
        wsResumen['!cols'] = [{ wch: 25 }, { wch: 40 }];

        wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');
        XLSX.utils.book_append_sheet(wb, wsMovimientos, 'Movimientos');
    } else {
        alert('La librería de Excel no está disponible. Verifica la conexión a internet.');
        return;
    }

    const nombreArchivo = `Hoja_de_vida_${(currentCodigoUtic || 'dispositivo').replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
}

function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleString('es-ES', { timeZone: 'UTC' });
}

// Cargar al inicio: solo mostrar mensaje de búsqueda previa
document.addEventListener('DOMContentLoaded', function() {
    const tableContainer = document.getElementById('tableContainer');
    const btnExportar = document.getElementById('btnExportar');
    if (btnExportar) btnExportar.style.display = 'none';
    tableContainer.innerHTML = '<div class="no-data">Usa la <strong>búsqueda por código UTIC</strong> para ver la hoja de vida de un dispositivo, o la <strong>búsqueda global</strong> para consultar en toda la tabla.</div>';

    // Cargar columnas para la búsqueda global
    cargarColumnasGlobal();

    // Permitir buscar con Enter en el campo de código UTIC y forzar mayúsculas
    const codigoUtic = document.getElementById('codigoUtic');
    if (codigoUtic) {
        codigoUtic.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                buscarHojaDeVida();
            }
        });
        codigoUtic.addEventListener('input', function() {
            this.value = this.value.toUpperCase();
        });
        setTimeout(() => codigoUtic.focus(), 100);
    }

    // Permitir buscar con Enter en el campo de búsqueda global
    const busquedaGlobal = document.getElementById('busquedaGlobal');
    if (busquedaGlobal) {
        busquedaGlobal.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                buscarGlobal();
            }
        });
    }
});
