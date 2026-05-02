// Logica especifica para certificaciones_reparto
let tableColumns = [];
let currentData = [];
let currentFilteredData = null;
let importedData = [];

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

function applyFilter() {
    const filterInput = document.getElementById('filterInput');
    if (!filterInput) return;

    const filter = filterInput.value.trim().toLowerCase();
    if (!filter) {
        currentFilteredData = null;
        renderTable(currentData);
        return;
    }

    const filteredData = currentData.filter((row) => {
        return tableColumns.some((col) => {
            const value = row[col];
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(filter);
        });
    });

    currentFilteredData = filteredData;
    renderTable(filteredData);
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

        showMessage('Descargando todos los registros de Supabase...', 'info');
        const allRows = await fetchAllFromSupabase();

        if (!allRows.length) {
            showMessage('No hay registros para exportar.', 'error');
            return;
        }

        // Aplicar el mismo filtro de texto sobre el total completo
        const dataToExport = filterText
            ? allRows.filter((row) => {
                return Object.values(row).some((value) => {
                    if (value === null || value === undefined) return false;
                    return String(value).toLowerCase().includes(filterText);
                });
            })
            : allRows;

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

        const filtro = filterText ? '_filtrado' : '';
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

        if (!numeroCorreriaSanitized || !nuevoFuncionarioSanitized) {
            showMessage('Debes ingresar numero de correria y funcionario.', 'error');
            return;
        }

        const { data: targetRows, error: targetError } = await supabase
            .from(TABLE_NAME)
            .select('id_cert_reparto, funcionario, numero_correria, certificacion_nombre_del_cliente')
            .eq('numero_correria', numeroCorreriaSanitized)
            .or('certificacion_nombre_del_cliente.is.null,certificacion_nombre_del_cliente.eq.');

        if (targetError) throw targetError;

        if (!targetRows || targetRows.length === 0) {
            showMessage('No hay filas elegibles para esa correria (sin certificacion_nombre_del_cliente).', 'error');
            return;
        }

        const rowsToAssign = targetRows;

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
            showMessage(`Asignacion completada para ${updatedCount} fila(s).`, 'success');
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
        const chunks = chunkArray(importedData, 200);
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

    if (filterInput) {
        filterInput.addEventListener('input', applyFilter);
    }

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
