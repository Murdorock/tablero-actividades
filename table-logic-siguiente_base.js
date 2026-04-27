const TABLE_NAME = 'base_sig_dia';
const TABLE_TITLE = '🗄️ Siguiente Base';
const MAX_ROWS = 500;
const IMPORT_BATCH_SIZE = 100;

const ALLOWED_IMPORT_COLUMNS = [
    'id_codigo',
    'nombre',
    'cedula',
    'novedad',
    'transporte',
    'correria',
    'observacion',
    'dias',
    'super_zona',
    'fecha'
];

const COLUMN_HEADER_MAP = {
    'codigo': 'id_codigo',
    'id_codigo': 'id_codigo',
    'nombre': 'nombre',
    'cedula': 'cedula',
    'novedad': 'novedad',
    'transporte': 'transporte',
    'correria': 'correria',
    'correria_': 'correria',
    'observacion': 'observacion',
    'antiguedad': 'dias',
    'dias': 'dias',
    'supervisor_de_zona': 'super_zona',
    'super_zona': 'super_zona',
    'fecha': 'fecha'
};

const loadingIndicator = document.getElementById('loadingIndicator');
const tableContainer = document.getElementById('tableContainer');
const statusLine = document.getElementById('statusLine');
const searchInput = document.getElementById('searchInput');
const columnFilter = document.getElementById('columnFilter');
const btnSearch = document.getElementById('btnSearch');
const btnClear = document.getElementById('btnClear');
const btnRefresh = document.getElementById('btnRefresh');

let currentData = [];
let tableColumns = [];
let importedData = [];

function setStatus(message, isError) {
    statusLine.textContent = message;
    statusLine.style.color = isError ? '#dc2626' : '#475569';
}

function handleError(error, context) {
    console.error('Error ' + context + ':', error);
    setStatus((error && error.message) ? error.message : 'Ocurrio un error ' + context, true);
}

function showMessage(message, type) {
    setStatus(message, type === 'error');
}

function formatColumnName(column) {
    return String(column || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value, columnName) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Si' : 'No';

    const normalizedColumn = String(columnName || '').toLowerCase();
    if (normalizedColumn.includes('fecha') || normalizedColumn.includes('date') || normalizedColumn.endsWith('_at')) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleString('es-CO');
        }
    }

    if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    return String(value);
}

function populateColumnFilter() {
    const currentValue = columnFilter.value;
    columnFilter.innerHTML = '<option value="">Todas las columnas</option>';

    tableColumns.forEach((column) => {
        const option = document.createElement('option');
        option.value = column;
        option.textContent = formatColumnName(column);
        columnFilter.appendChild(option);
    });

    columnFilter.value = currentValue;
}

function renderTable(rows) {
    if (!rows.length) {
        tableContainer.innerHTML = '<div style="text-align:center; padding: 40px; color: #64748b;">No hay registros para mostrar.</div>';
        return;
    }

    const html = [
        '<table class="data-table">',
        '<thead><tr>',
        ...tableColumns.map((column) => '<th>' + formatColumnName(column) + '</th>'),
        '</tr></thead>',
        '<tbody>',
        ...rows.map((row) => {
            const cells = tableColumns.map((column) => '<td>' + formatValue(row[column], column) + '</td>').join('');
            return '<tr>' + cells + '</tr>';
        }),
        '</tbody></table>'
    ].join('');

    tableContainer.innerHTML = html;
}

function applyFilter() {
    const query = (searchInput.value || '').trim().toLowerCase();
    const selectedColumn = columnFilter.value;

    if (!query) {
        renderTable(currentData);
        setStatus('Mostrando ' + currentData.length + ' registros.', false);
        return;
    }

    const filteredRows = currentData.filter((row) => {
        if (selectedColumn) {
            const value = row[selectedColumn];
            return value !== null && value !== undefined && String(value).toLowerCase().includes(query);
        }

        return tableColumns.some((column) => {
            const value = row[column];
            return value !== null && value !== undefined && String(value).toLowerCase().includes(query);
        });
    });

    renderTable(filteredRows);
    setStatus('Se encontraron ' + filteredRows.length + ' registros.', false);
}

function clearFilter() {
    searchInput.value = '';
    columnFilter.value = '';
    renderTable(currentData);
    setStatus('Mostrando ' + currentData.length + ' registros.', false);
}

async function loadData() {
    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';
    setStatus('Consultando datos de ' + TABLE_NAME + '...', false);

    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .limit(MAX_ROWS);

        if (error) throw error;

        currentData = data || [];
        tableColumns = currentData.length ? Object.keys(currentData[0]) : [];

        if (!currentData.length) {
            tableContainer.innerHTML = '<div style="text-align:center; padding: 40px; color: #64748b;">La tabla ' + TABLE_NAME + ' no tiene registros.</div>';
            setStatus('Sin registros en ' + TABLE_NAME + '.', false);
            populateColumnFilter();
            return;
        }

        populateColumnFilter();
        renderTable(currentData);
        setStatus('Carga completada: ' + currentData.length + ' registros en ' + TABLE_TITLE + '.', false);
    } catch (error) {
        tableContainer.innerHTML = '<div style="text-align:center; padding: 40px; color: #dc2626;">Error al consultar ' + TABLE_NAME + ': ' + error.message + '</div>';
        handleError(error, 'al consultar ' + TABLE_NAME);
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

async function clearTableData() {
    if (!window.confirm('¿Deseas eliminar todos los registros de ' + TABLE_TITLE + '?')) {
        return;
    }

    const deleteFilterColumn = tableColumns[0] || ALLOWED_IMPORT_COLUMNS[0];

    if (!deleteFilterColumn) {
        showMessage('No se pudo determinar la columna para limpiar la tabla.', 'error');
        return;
    }

    loadingIndicator.style.display = 'block';
    setStatus('Eliminando registros de ' + TABLE_NAME + '...', false);

    try {
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .or(deleteFilterColumn + '.is.null,' + deleteFilterColumn + '.not.is.null');

        if (error) throw error;

        currentData = [];
        importedData = [];
        renderTable([]);
        populateColumnFilter();
        showMessage('Tabla limpiada correctamente.', 'success');
        await loadData();
    } catch (error) {
        handleError(error, 'al limpiar la tabla');
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function normalizeHeaderName(header) {
    if (header === null || header === undefined) return '';
    return String(header)
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

function mapIncomingHeader(header) {
    const normalized = normalizeHeaderName(header);
    const snakeCase = normalized.replace(/\s+/g, '_');
    const mapped = COLUMN_HEADER_MAP[snakeCase] || COLUMN_HEADER_MAP[normalized] || snakeCase;
    return ALLOWED_IMPORT_COLUMNS.includes(mapped) ? mapped : null;
}

function transformImportedRows(rows) {
    return (rows || []).map((row) => {
        const transformed = {};

        Object.keys(row || {}).forEach((originalKey) => {
            const mappedKey = mapIncomingHeader(originalKey);
            if (!mappedKey) return;

            let value = row[originalKey];
            if (typeof value === 'string') {
                value = value.trim();
            }
            if (value === '') {
                value = null;
            }

            transformed[mappedKey] = value;
        });

        return transformed;
    }).filter((row) => Object.keys(row).length > 0);
}

function parseAndPrepareRows(rawInput) {
    const parseResult = Papa.parse(rawInput, {
        header: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', ';', '\t', '|']
    });

    if (parseResult.errors && parseResult.errors.length > 0) {
        const realErrors = parseResult.errors.filter((err) => err.code !== 'UndetectableDelimiter');
        if (realErrors.length > 0) {
            throw new Error(realErrors[0].message);
        }
    }

    const transformedRows = transformImportedRows(parseResult.data);
    if (transformedRows.length === 0) {
        throw new Error('No se encontraron registros validos en el texto pegado.');
    }

    return transformedRows;
}

function resetImportProgress() {
    const section = document.getElementById('importProgressSection');
    const bar = document.getElementById('importProgressBar');
    const text = document.getElementById('importProgressText');

    if (section) section.style.display = 'none';
    if (bar) bar.style.width = '0%';
    if (text) text.textContent = 'Texto listo para importar';
}

function setImportProgress(processed, total) {
    const section = document.getElementById('importProgressSection');
    const bar = document.getElementById('importProgressBar');
    const text = document.getElementById('importProgressText');

    if (!section || !bar || !text) return;

    section.style.display = 'block';
    const safeTotal = total > 0 ? total : 1;
    const percent = Math.min(100, Math.round((processed / safeTotal) * 100));
    bar.style.width = percent + '%';
    text.textContent = processed + '/' + total + ' registros procesados';
}

function openImportModal() {
    document.getElementById('importModal').classList.add('show');
    document.getElementById('pastedData').value = '';
    document.getElementById('btnImport').disabled = true;
    importedData = [];
    resetImportProgress();
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('show');
}

function parsePastedImportData() {
    const pastedData = document.getElementById('pastedData')?.value || '';
    if (!pastedData.trim()) {
        showMessage('Pega primero la informacion para procesarla.', 'error');
        return;
    }

    try {
        importedData = parseAndPrepareRows(pastedData);
        const progressSection = document.getElementById('importProgressSection');
        const progressBar = document.getElementById('importProgressBar');
        const progressText = document.getElementById('importProgressText');

        if (progressSection) progressSection.style.display = 'block';
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = importedData.length + ' registros listos para importar';

        document.getElementById('btnImport').disabled = false;
        showMessage('Texto procesado correctamente. Puedes importar ahora.', 'success');
    } catch (error) {
        document.getElementById('btnImport').disabled = true;
        handleError(error, 'al procesar el texto pegado');
    }
}

async function importData() {
    if (importedData.length === 0) {
        showMessage('No hay datos para importar.', 'error');
        return;
    }

    if (!window.confirm('¿Deseas importar ' + importedData.length + ' registros en ' + TABLE_TITLE + '?')) {
        return;
    }

    const btnImport = document.getElementById('btnImport');
    btnImport.disabled = true;
    btnImport.textContent = 'Importando...';
    setImportProgress(0, importedData.length);

    try {
        let imported = 0;

        for (let index = 0; index < importedData.length; index += IMPORT_BATCH_SIZE) {
            const batch = importedData.slice(index, index + IMPORT_BATCH_SIZE);
            const { error } = await supabase
                .from(TABLE_NAME)
                .insert(batch);

            if (error) throw error;

            imported += batch.length;
            btnImport.textContent = 'Importando... ' + imported + '/' + importedData.length;
            setImportProgress(imported, importedData.length);
        }

        showMessage('✓ ' + importedData.length + ' registros importados exitosamente.', 'success');
        closeImportModal();
        await loadData();
    } catch (error) {
        handleError(error, 'al importar registros');
    } finally {
        btnImport.disabled = false;
        btnImport.textContent = 'Importar Registros';
    }
}

btnSearch.addEventListener('click', applyFilter);
btnClear.addEventListener('click', clearFilter);
btnRefresh.addEventListener('click', loadData);
searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        applyFilter();
    }
});

document.addEventListener('DOMContentLoaded', loadData);