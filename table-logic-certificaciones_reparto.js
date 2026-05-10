// Logica especifica para certificaciones_reparto
let tableColumns = [];
let currentData = [];
let currentFilteredData = null;
let importedData = [];
let allSupabaseData = null;
let filterDebounceTimer = null;
let filterRequestToken = 0;

const DATE_RANGE_FILTERS = [
    {
        fromInputId: 'fechaFinalEjecucionDesde',
        toInputId: 'fechaFinalEjecucionHasta',
        preferredColumns: ['fecha_final_ejecucion', 'fecha final ejecucion']
    },
    {
        fromInputId: 'fechaCargaDesde',
        toInputId: 'fechaCargaHasta',
        preferredColumns: ['fecha_carga', 'fecha carga']
    }
];

const REQUIRED_COLUMNS = [
    'funcionario',
    'numero_correria',
    'nombre_correria',
    'cantidad_certificaciones',
    'ciclo',
    'direccion',
    'ciudad',
    'cantidad',
    'controles',
    'certificaciones',
    'paquetes_entrega',
    'cantidad_facturas_en_paquetes',
    'peso'
];

const NUMERIC_COLUMNS = [
    'cantidad_certificaciones',
    'cantidad',
    'cantidad_facturas_en_paquetes',
    'peso'
];

function sanitizeText(value) {
    if (value === null || value === undefined) return null;

    // Convertir a texto y limpiar caracteres de control que pueden romper inserts.
    return String(value)
        .replace(/\u0000/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .trim();
}

function normalizeHeader(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
}

function normalizeRecord(row, headerMap) {
    const normalized = {};

    REQUIRED_COLUMNS.forEach((columnName) => {
        const sourceKey = headerMap[columnName];
        let value = sourceKey !== undefined ? row[sourceKey] : null;

        if (typeof value === 'string') {
            value = sanitizeText(value);
        }

        if (NUMERIC_COLUMNS.includes(columnName)) {
            if (value === '' || value === null || value === undefined) {
                normalized[columnName] = null;
            } else {
                const parsed = Number(String(value).replace(',', '.'));
                normalized[columnName] = Number.isFinite(parsed) ? parsed : null;
            }
            return;
        }

        normalized[columnName] = value === undefined ? null : sanitizeText(value);
    });

    return normalized;
}

async function insertChunkWithFallback(chunk, startIndex) {
    const { error } = await supabase
        .from(TABLE_NAME)
        .insert(chunk);

    if (!error) {
        return { inserted: chunk.length, failedRows: [] };
    }

    // Si falla el lote completo, probamos fila por fila para no perder todo el archivo.
    const failedRows = [];
    let inserted = 0;

    for (let i = 0; i < chunk.length; i++) {
        const row = chunk[i];
        const { error: rowError } = await supabase
            .from(TABLE_NAME)
            .insert([row]);

        if (rowError) {
            failedRows.push({
                excelRow: startIndex + i + 2,
                error: rowError.message
            });
        } else {
            inserted += 1;
        }
    }

    return { inserted, failedRows };
}

function chunkArray(list, chunkSize) {
    const chunks = [];
    for (let i = 0; i < list.length; i += chunkSize) {
        chunks.push(list.slice(i, i + chunkSize));
    }
    return chunks;
}

function formatColumnName(col) {
    return col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatValue(value, columnName) {
    if (value === null || value === undefined || value === '') return '-';

    if (typeof value === 'boolean') return value ? 'Si' : 'No';

    const lowerColumn = String(columnName || '').toLowerCase();
    if (lowerColumn.includes('fecha') || lowerColumn.includes('date') || lowerColumn.includes('_at')) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleString('es-ES');
        }
    }

    if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
        return `<a href="${value}" target="_blank" rel="noopener noreferrer">Abrir</a>`;
    }

    if (typeof value === 'object') return JSON.stringify(value);

    return String(value);
}

function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');

    if (!tableColumns.length) {
        tableContainer.innerHTML = '<div style="text-align:center; padding: 40px; color: #7f8c8d;">No hay columnas para mostrar</div>';
        return;
    }

    let html = '<table class="data-table"><thead><tr>';

    tableColumns.forEach((col) => {
        html += `<th>${formatColumnName(col)}</th>`;
    });

    html += '</tr></thead><tbody>';

    data.forEach((row) => {
        html += '<tr>';
        tableColumns.forEach((col) => {
            html += `<td>${formatValue(row[col], col)}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    tableContainer.innerHTML = html;
}

function filterRowsByText(rows, filterText, columns = null) {
    const normalizedFilter = String(filterText || '').trim().toLowerCase();
    if (!normalizedFilter) return rows;

    return rows.filter((row) => {
        const keys = columns && columns.length ? columns : Object.keys(row || {});
        return keys.some((col) => {
            const value = row[col];
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(normalizedFilter);
        });
    });
}

function normalizeFieldName(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[_\s]+/g, '_')
        .trim();
}

function toIsoDateOnly(value) {
    if (value === null || value === undefined || value === '') return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const raw = String(value).trim();
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    const dmyMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    return null;
}

function readDateRangeFilterValues() {
    return DATE_RANGE_FILTERS.map((config) => {
        const fromInput = document.getElementById(config.fromInputId);
        const toInput = document.getElementById(config.toInputId);
        return {
            ...config,
            from: fromInput ? fromInput.value : '',
            to: toInput ? toInput.value : ''
        };
    });
}

function hasActiveDateRangeFilters(dateRangeFilters) {
    return dateRangeFilters.some((filter) => filter.from || filter.to);
}

function resolveDateColumns(rows, dateRangeFilters) {
    if (!rows || rows.length === 0) return new Map();

    const availableColumns = Object.keys(rows[0]);
    const normalizedColumns = availableColumns.map((column) => ({
        original: column,
        normalized: normalizeFieldName(column)
    }));

    const resolved = new Map();
    dateRangeFilters.forEach((filter) => {
        const preferredNormalized = filter.preferredColumns.map((name) => normalizeFieldName(name));
        const found = normalizedColumns.find((col) => preferredNormalized.includes(col.normalized));
        if (found) {
            resolved.set(filter.fromInputId, found.original);
        }
    });

    return resolved;
}

function applyDateRangeFilters(rows, dateRangeFilters) {
    if (!hasActiveDateRangeFilters(dateRangeFilters)) return rows;

    const resolvedColumns = resolveDateColumns(rows, dateRangeFilters);

    return rows.filter((row) => {
        return dateRangeFilters.every((filter) => {
            if (!filter.from && !filter.to) return true;

            const dateColumn = resolvedColumns.get(filter.fromInputId);
            if (!dateColumn) return false;

            const rowDate = toIsoDateOnly(row[dateColumn]);
            if (!rowDate) return false;

            if (filter.from && rowDate < filter.from) return false;
            if (filter.to && rowDate > filter.to) return false;
            return true;
        });
    });
}

function applyCombinedFilters(rows, filterText, dateRangeFilters, columns = null) {
    const textFiltered = filterRowsByText(rows, filterText, columns);
    return applyDateRangeFilters(textFiltered, dateRangeFilters);
}

function scheduleApplyFilter() {
    if (filterDebounceTimer) {
        clearTimeout(filterDebounceTimer);
    }

    filterDebounceTimer = setTimeout(() => {
        applyFilter();
    }, 250);
}

function clearDateFilters() {
    DATE_RANGE_FILTERS.forEach((config) => {
        const fromInput = document.getElementById(config.fromInputId);
        const toInput = document.getElementById(config.toInputId);
        if (fromInput) fromInput.value = '';
        if (toInput) toInput.value = '';
    });

    applyFilter();
}

async function applyFilter() {
    const filterInput = document.getElementById('filterInput');
    if (!filterInput) return;

    const filter = filterInput.value.trim().toLowerCase();
    const dateRangeFilters = readDateRangeFilterValues();
    const hasAnyFilter = Boolean(filter) || hasActiveDateRangeFilters(dateRangeFilters);

    if (!hasAnyFilter) {
        currentFilteredData = null;
        renderTable(currentData);
        return;
    }

    const currentToken = ++filterRequestToken;

    try {
        if (!allSupabaseData) {
            showMessage('Buscando en toda la tabla de Supabase...', 'info');
            allSupabaseData = await fetchAllFromSupabase();

            if (currentToken !== filterRequestToken) {
                return;
            }
        }

        const columns = allSupabaseData.length ? Object.keys(allSupabaseData[0]) : tableColumns;
        const filteredData = applyCombinedFilters(allSupabaseData, filter, dateRangeFilters, columns);

        currentFilteredData = filteredData;
        renderTable(filteredData);
    } catch (error) {
        handleError(error, 'al filtrar certificaciones de reparto');
    }
}

async function fetchAllFromSupabase() {
    const PAGE_SIZE = 1000;
    let allRows = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allRows = allRows.concat(data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return allRows;
}

async function exportToExcel() {
    if (!tableColumns.length) {
        showMessage('No hay datos para exportar.', 'error');
        return;
    }

    const btnExport = document.querySelector('[onclick="exportToExcel()"]');
    const originalText = btnExport ? btnExport.textContent : '';
    if (btnExport) {
        btnExport.disabled = true;
        btnExport.textContent = 'Exportando...';
    }

    try {
        const filterInput = document.getElementById('filterInput');
        const filterText = filterInput ? filterInput.value.trim().toLowerCase() : '';
        const dateRangeFilters = readDateRangeFilterValues();
        const hasAnyFilter = Boolean(filterText) || hasActiveDateRangeFilters(dateRangeFilters);

        showMessage('Descargando todos los registros de Supabase...', 'info');
        const allRows = await fetchAllFromSupabase();

        if (!allRows.length) {
            showMessage('No hay registros para exportar.', 'error');
            return;
        }

        // Aplicar los mismos filtros activos de la vista (texto y rangos de fecha)
        const columns = allRows.length ? Object.keys(allRows[0]) : tableColumns;
        const dataToExport = applyCombinedFilters(allRows, filterText, dateRangeFilters, columns);

        if (!dataToExport.length) {
            showMessage('El filtro no encontro registros para exportar.', 'error');
            return;
        }

        // Usar columnas del primer registro para no depender de tableColumns (puede estar limitado)
        const exportColumns = Object.keys(dataToExport[0]);

        const rows = dataToExport.map((row) => {
            const exportRow = {};
            exportColumns.forEach((col) => {
                const value = row[col];
                exportRow[formatColumnName(col)] = value === null || value === undefined ? '' : value;
            });
            return exportRow;
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Certificaciones');

        const filtro = hasAnyFilter ? '_filtrado' : '';
        const fecha = new Date().toISOString().slice(0, 10);
        const fileName = `certificaciones_reparto${filtro}_${fecha}.xlsx`;

        XLSX.writeFile(workbook, fileName);
        showMessage(`Exportado: ${dataToExport.length} registro(s) en ${fileName}`, 'success');
    } catch (error) {
        handleError(error, 'al exportar a Excel');
    } finally {
        if (btnExport) {
            btnExport.disabled = false;
            btnExport.textContent = originalText;
        }
    }
}

async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');

    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';

    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .limit(1000);

        if (error) throw error;

        currentData = data || [];
        allSupabaseData = null;
        currentFilteredData = null;

        if (currentData.length === 0) {
            tableColumns = [];
            tableContainer.innerHTML = '<div style="text-align:center; padding: 40px; color: #7f8c8d;">No hay registros en la tabla certificaciones_reparto</div>';
        } else {
            tableColumns = Object.keys(currentData[0]);
            renderTable(currentData);
        }
    } catch (error) {
        handleError(error, 'al cargar certificaciones de reparto');
        tableContainer.innerHTML = `<div style="text-align:center; padding: 40px; color: #e74c3c;">Error: ${error.message}</div>`;
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function openImportModal() {
    const importModal = document.getElementById('importModal');
    const excelFile = document.getElementById('excelFile');
    const importPreview = document.getElementById('importPreview');
    const btnImport = document.getElementById('btnImport');

    importedData = [];
    excelFile.value = '';
    importPreview.style.display = 'none';
    btnImport.disabled = true;
    importModal.classList.add('show');
}

function closeImportModal() {
    const importModal = document.getElementById('importModal');
    importModal.classList.remove('show');
}

function openAssignModal() {
    const assignModal = document.getElementById('assignModal');
    const assignForm = document.getElementById('assignForm');
    const assignNumeroCorreria = document.getElementById('assignNumeroCorreria');
    const assignFuncionario = document.getElementById('assignFuncionario');

    if (assignForm) assignForm.reset();
    if (assignNumeroCorreria) assignNumeroCorreria.value = '';
    if (assignFuncionario) assignFuncionario.value = '';

    assignModal.classList.add('show');
}

function closeAssignModal() {
    const assignModal = document.getElementById('assignModal');
    assignModal.classList.remove('show');
}

function fallbackUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return fallbackUuid();
}

async function generateReplacementIds(rowsToAssign) {
    const sampleRow = rowsToAssign.find((row) => row.id_cert_reparto !== null && row.id_cert_reparto !== undefined);
    if (!sampleRow) return [];

    const sampleId = sampleRow.id_cert_reparto;
    const idType = typeof sampleId;
    const isNumericString = idType === 'string' && /^\d+$/.test(sampleId);

    if (idType === 'number' || isNumericString) {
        const { data: maxIdData, error: maxIdError } = await supabase
            .from(TABLE_NAME)
            .select('id_cert_reparto')
            .order('id_cert_reparto', { ascending: false })
            .limit(1);

        if (maxIdError) throw maxIdError;

        let nextId = 1n;
        if (maxIdData && maxIdData.length > 0 && maxIdData[0].id_cert_reparto !== null && maxIdData[0].id_cert_reparto !== undefined) {
            nextId = BigInt(String(maxIdData[0].id_cert_reparto)) + 1n;
        }

        return rowsToAssign.map((row, index) => {
            const generated = nextId + BigInt(index);
            return {
                oldId: row.id_cert_reparto,
                newId: idType === 'number' ? Number(generated) : generated.toString()
            };
        });
    }

    return rowsToAssign.map((row) => ({
        oldId: row.id_cert_reparto,
        newId: generateUuid()
    }));
}

async function assignOrdersByCorreria(numeroCorreria, nuevoFuncionario) {
    const btnAssign = document.getElementById('btnAssign');
    const originalText = btnAssign ? btnAssign.textContent : 'Asignar';

    if (btnAssign) {
        btnAssign.disabled = true;
        btnAssign.textContent = 'Asignando...';
    }

    try {
        const numeroCorreriaSanitized = sanitizeText(numeroCorreria);
        const nuevoFuncionarioSanitized = sanitizeText(nuevoFuncionario);
        const fechaCargaDesdeInput = document.getElementById('fechaCargaDesde');
        const fechaCargaHastaInput = document.getElementById('fechaCargaHasta');
        const fechaCargaDesde = fechaCargaDesdeInput ? fechaCargaDesdeInput.value : '';
        const fechaCargaHasta = fechaCargaHastaInput ? fechaCargaHastaInput.value : '';

        if (!numeroCorreriaSanitized || !nuevoFuncionarioSanitized) {
            showMessage('Debes ingresar numero de correria y funcionario.', 'error');
            return;
        }

        if (!fechaCargaDesde || !fechaCargaHasta) {
            showMessage('Para asignar ordenes debes seleccionar un rango completo en FECHA CARGA (desde y hasta).', 'error');
            return;
        }

        if (fechaCargaDesde > fechaCargaHasta) {
            showMessage('El rango de FECHA CARGA no es valido: la fecha desde no puede ser mayor que la fecha hasta.', 'error');
            return;
        }

        const { data: targetRows, error: targetError } = await supabase
            .from(TABLE_NAME)
            .select('id_cert_reparto, funcionario, numero_correria, certificacion_nombre_del_cliente, fecha_carga')
            .eq('numero_correria', numeroCorreriaSanitized)
            .or('certificacion_nombre_del_cliente.is.null,certificacion_nombre_del_cliente.eq.');

        if (targetError) throw targetError;

        if (!targetRows || targetRows.length === 0) {
            showMessage('No hay filas elegibles para esa correria (sin certificacion_nombre_del_cliente).', 'error');
            return;
        }

        const rowsToAssign = targetRows.filter((row) => {
            const fechaCarga = toIsoDateOnly(row.fecha_carga);
            if (!fechaCarga) return false;
            return fechaCarga >= fechaCargaDesde && fechaCarga <= fechaCargaHasta;
        });

        if (rowsToAssign.length === 0) {
            showMessage('No hay filas elegibles para esa correria dentro del rango FECHA CARGA seleccionado.', 'error');
            return;
        }

        const targetIds = rowsToAssign.map((row) => row.id_cert_reparto).filter((id) => id !== null && id !== undefined);

        if (targetIds.length === 0) {
            showMessage('No se encontraron IDs validos para actualizar.', 'error');
            return;
        }

        const replacements = await generateReplacementIds(rowsToAssign);
        let updatedCount = 0;
        const failedRows = [];

        for (const replacement of replacements) {
            const { error: updateError } = await supabase
                .from(TABLE_NAME)
                .update({
                    funcionario: nuevoFuncionarioSanitized,
                    id_cert_reparto: replacement.newId
                })
                .eq('id_cert_reparto', replacement.oldId)
                .eq('numero_correria', numeroCorreriaSanitized)
                .or('certificacion_nombre_del_cliente.is.null,certificacion_nombre_del_cliente.eq.');

            if (updateError) {
                failedRows.push({
                    oldId: replacement.oldId,
                    attemptedNewId: replacement.newId,
                    error: updateError.message
                });
            } else {
                updatedCount += 1;
            }
        }

        if (failedRows.length > 0) {
            console.table(failedRows);
            showMessage(`Asignacion parcial: ${updatedCount} fila(s) actualizadas, ${failedRows.length} con error.`, 'error');
        } else {
            showMessage(`Asignacion completada para ${updatedCount} fila(s) dentro del rango FECHA CARGA ${fechaCargaDesde} a ${fechaCargaHasta}.`, 'success');
        }

        closeAssignModal();
        await loadData();
    } catch (error) {
        handleError(error, 'al asignar ordenes');
    } finally {
        if (btnAssign) {
            btnAssign.disabled = false;
            btnAssign.textContent = originalText;
        }
    }
}

function showPreview(data) {
    const previewContent = document.getElementById('previewContent');
    const previewCount = document.getElementById('previewCount');

    const sample = data.slice(0, 5);
    let html = '<table class="data-table" style="font-size: 12px;"><thead><tr>';

    REQUIRED_COLUMNS.forEach((column) => {
        html += `<th>${formatColumnName(column)}</th>`;
    });

    html += '</tr></thead><tbody>';

    sample.forEach((row) => {
        html += '<tr>';
        REQUIRED_COLUMNS.forEach((column) => {
            html += `<td>${formatValue(row[column], column)}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    previewContent.innerHTML = html;
    previewCount.textContent = String(data.length);
}

function processExcelFile(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const bytes = new Uint8Array(event.target.result);
            const workbook = XLSX.read(bytes, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const firstSheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: null });

            if (!rows.length) {
                importedData = [];
                document.getElementById('btnImport').disabled = true;
                document.getElementById('importPreview').style.display = 'none';
                showMessage('El archivo no contiene registros.', 'error');
                return;
            }

            const firstRow = rows[0];
            const sourceHeaders = Object.keys(firstRow);
            const normalizedSourceHeaders = sourceHeaders.map((header) => normalizeHeader(header));

            const missingColumns = REQUIRED_COLUMNS.filter((required) => !normalizedSourceHeaders.includes(required));
            if (missingColumns.length > 0) {
                importedData = [];
                document.getElementById('btnImport').disabled = true;
                document.getElementById('importPreview').style.display = 'none';
                showMessage('Faltan columnas requeridas: ' + missingColumns.join(', '), 'error');
                return;
            }

            const headerMap = {};
            sourceHeaders.forEach((header) => {
                const normalized = normalizeHeader(header);
                if (REQUIRED_COLUMNS.includes(normalized) && headerMap[normalized] === undefined) {
                    headerMap[normalized] = header;
                }
            });

            importedData = rows
                .map((row) => normalizeRecord(row, headerMap))
                .filter((row) => Object.values(row).some((value) => value !== null && value !== ''));

            if (!importedData.length) {
                document.getElementById('btnImport').disabled = true;
                document.getElementById('importPreview').style.display = 'none';
                showMessage('No se encontraron filas validas para importar.', 'error');
                return;
            }

            showPreview(importedData);
            document.getElementById('importPreview').style.display = 'block';
            document.getElementById('btnImport').disabled = false;
            showMessage('Archivo validado correctamente.', 'success');
        } catch (error) {
            importedData = [];
            document.getElementById('btnImport').disabled = true;
            document.getElementById('importPreview').style.display = 'none';
            showMessage('Error al procesar el Excel: ' + error.message, 'error');
        }
    };

    reader.readAsArrayBuffer(file);
}

async function importData() {
    if (!importedData.length) {
        showMessage('No hay datos preparados para importar.', 'error');
        return;
    }

    const btnImport = document.getElementById('btnImport');
    btnImport.disabled = true;
    const originalText = btnImport.textContent;
    btnImport.textContent = 'Importando...';

    try {
        // Obtener el máximo ID actual
        const { data: maxIdData, error: maxError } = await supabase
            .from(TABLE_NAME)
            .select('id_cert_reparto')
            .order('id_cert_reparto', { ascending: false })
            .limit(1);

        let nextId = 1n;
        if (!maxError && maxIdData && maxIdData.length > 0) {
            nextId = BigInt(String(maxIdData[0].id_cert_reparto)) + 1n;
        }

        // Asignar IDs a los registros
        const dataWithIds = importedData.map((row, index) => ({
            ...row,
            id_cert_reparto: Number(nextId + BigInt(index))
        }));

        const chunks = chunkArray(dataWithIds, 200);
        let insertedCount = 0;
        const failedRows = [];

        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex];
            const startIndex = chunkIndex * 200;
            const result = await insertChunkWithFallback(chunk, startIndex);
            insertedCount += result.inserted;
            failedRows.push(...result.failedRows);
        }

        if (failedRows.length > 0) {
            console.table(failedRows);
            showMessage(`Importacion parcial: ${insertedCount} cargados, ${failedRows.length} con error. Revisa consola para detalle.`, 'error');
        } else {
            showMessage(`Importacion completada: ${insertedCount} registros cargados.`, 'success');
        }

        closeImportModal();
        await loadData();
    } catch (error) {
        handleError(error, 'al importar certificaciones_reparto');
    } finally {
        btnImport.textContent = originalText;
        btnImport.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const filterInput = document.getElementById('filterInput');
    const excelFile = document.getElementById('excelFile');
    const assignForm = document.getElementById('assignForm');
    const dateInputs = DATE_RANGE_FILTERS.flatMap((config) => [
        document.getElementById(config.fromInputId),
        document.getElementById(config.toInputId)
    ]).filter(Boolean);

    if (filterInput) {
        filterInput.addEventListener('input', function() {
            scheduleApplyFilter();
        });
    }

    dateInputs.forEach((input) => {
        input.addEventListener('change', function() {
            scheduleApplyFilter();
        });
    });

    if (excelFile) {
        excelFile.addEventListener('change', function(event) {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            processExcelFile(file);
        });
    }

    if (assignForm) {
        assignForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const numeroCorreria = document.getElementById('assignNumeroCorreria').value;
            const nuevoFuncionario = document.getElementById('assignFuncionario').value;
            await assignOrdersByCorreria(numeroCorreria, nuevoFuncionario);
        });
    }

    loadData();
});
