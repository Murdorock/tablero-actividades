let currentData = [];
let tableColumns = [];
let importedData = [];

const ALLOWED_IMPORT_COLUMNS = [
    'id_correria',
    'nombre_correria',
    'zona',
    'sup',
    'transporte',
    'gv',
    'cali',
    'terr',
    'nombre_zona',
    'hist2',
    'hist1',
    'codigo',
    'dias',
    'ok',
    'nov',
    'rep',
    'totales',
    'nombre_lector',
    'telefono',
    'tpl',
    'controles',
    'certificaciones',
    'entrega',
    'en_paquetes',
    'funcionario'
];

const COLUMN_HEADER_MAP = {
    'correria': 'id_correria',
    'id_correria': 'id_correria',
    'nombre_correria': 'nombre_correria',
    'zona': 'zona',
    'sup': 'sup',
    'transporte': 'transporte',
    'gv': 'gv',
    'cali': 'cali',
    'terr': 'terr',
    'nombre_zona': 'nombre_zona',
    'hist2': 'hist2',
    'hist1': 'hist1',
    'codigo': 'codigo',
    'dias': 'dias',
    'ok': 'ok',
    'nov': 'nov',
    'rep': 'rep',
    'totales': 'totales',
    'nombre_lector': 'nombre_lector',
    'telefono': 'telefono',
    'tpl': 'tpl',
    'controles': 'controles',
    'certificaciones': 'certificaciones',
    'entrega': 'entrega',
    'en_paquetes': 'en_paquetes',
    'en_paquete': 'en_paquetes',
    'funcionario': 'funcionario'
};

async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');

    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';

    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order('zona', { ascending: true })
            .order(PRIMARY_KEY, { ascending: true })
            .limit(500);

        if (error) throw error;

        currentData = data || [];

        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]);
            populateFilterColumns();
            renderTable(currentData);
        } else {
            tableColumns = ALLOWED_IMPORT_COLUMNS;
            populateFilterColumns();
            tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #7f8c8d;">No hay registros en esta tabla</div>';
        }

        loadingIndicator.style.display = 'none';
    } catch (error) {
        console.error('Error completo:', error);
        handleError(error, 'al cargar datos');
        loadingIndicator.style.display = 'none';
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">Error: ' + error.message + '</div>';
    }
}

function populateFilterColumns() {
    const filterColumn = document.getElementById('filterColumn');
    if (!filterColumn || tableColumns.length === 0) return;

    const currentValue = filterColumn.value;
    filterColumn.innerHTML = '<option value="">Todas las columnas</option>';

    tableColumns.forEach(col => {
        const option = document.createElement('option');
        option.value = col;
        option.textContent = formatColumnName(col);
        filterColumn.appendChild(option);
    });

    filterColumn.value = currentValue;
}

function applyFilter() {
    const searchText = document.getElementById('filterSearch').value.toLowerCase().trim();
    const filterColumn = document.getElementById('filterColumn').value;

    if (!searchText) {
        renderTable(currentData);
        return;
    }

    const filteredData = currentData.filter(row => {
        if (filterColumn) {
            const value = row[filterColumn];
            return value != null && String(value).toLowerCase().includes(searchText);
        }

        return Object.values(row).some(value =>
            value != null && String(value).toLowerCase().includes(searchText)
        );
    });

    renderTable(filteredData);
    showMessage(`${filteredData.length} registros encontrados`, 'info');
}

function clearFilter() {
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterColumn').value = '';
    renderTable(currentData);
}

function formatColumnName(column) {
    return column.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');

    if (!data || data.length === 0) {
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #7f8c8d;">No hay registros para mostrar</div>';
        return;
    }

    const columns = Object.keys(data[0]);

    let tableHTML = '<table class="data-table"><thead><tr>';
    columns.forEach(col => {
        tableHTML += `<th>${formatColumnName(col)}</th>`;
    });
    tableHTML += '<th>Acciones</th></tr></thead><tbody>';

    data.forEach(row => {
        tableHTML += '<tr>';
        columns.forEach(col => {
            const value = row[col];
            if (value === null || value === undefined) {
                tableHTML += '<td style="color: #bdc3c7;">-</td>';
            } else if (typeof value === 'boolean') {
                tableHTML += `<td>${value ? 'SI' : 'NO'}</td>`;
            } else if (col.includes('fecha') || col.includes('date')) {
                tableHTML += `<td>${formatDate(value)}</td>`;
            } else {
                tableHTML += `<td>${value}</td>`;
            }
        });
        tableHTML += `
            <td class="action-buttons">
                <button class="btn btn-sm btn-primary" onclick='editRecord(${JSON.stringify(row)})'>Editar</button>
                <button class="btn btn-sm btn-danger" onclick="deleteRecord('${row[PRIMARY_KEY]}')">Eliminar</button>
            </td>
        </tr>`;
    });

    tableHTML += '</tbody></table>';
    tableContainer.innerHTML = tableHTML;
}

function openCreateModal() {
    document.getElementById('modalTitle').textContent = 'Nuevo Registro';
    document.getElementById('recordId').value = '';
    document.getElementById('dataForm').reset();

    const columns = tableColumns.length > 0 ? tableColumns : ALLOWED_IMPORT_COLUMNS;
    const formFields = document.getElementById('formFields');
    formFields.innerHTML = '';

    columns.forEach(col => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = formatColumnName(col);
        label.setAttribute('for', col);

        const input = document.createElement('input');
        input.type = 'text';
        input.id = col;
        input.name = col;

        if (col === PRIMARY_KEY) {
            input.required = true;
        }

        formGroup.appendChild(label);
        formGroup.appendChild(input);
        formFields.appendChild(formGroup);
    });

    document.getElementById('dataModal').style.display = 'block';
}

function editRecord(record) {
    document.getElementById('modalTitle').textContent = 'Editar Registro';
    document.getElementById('recordId').value = record[PRIMARY_KEY];

    const columns = Object.keys(record);
    const formFields = document.getElementById('formFields');
    formFields.innerHTML = '';

    columns.forEach(col => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = formatColumnName(col);
        label.setAttribute('for', col);

        const input = document.createElement('input');
        input.type = 'text';
        input.id = col;
        input.name = col;
        input.value = record[col] ?? '';

        if (col === PRIMARY_KEY) {
            input.disabled = true;
        }

        formGroup.appendChild(label);
        formGroup.appendChild(input);
        formFields.appendChild(formGroup);
    });

    document.getElementById('dataModal').style.display = 'block';
}

async function deleteRecord(id) {
    if (!confirm('Estas seguro de que deseas eliminar este registro?')) return;

    try {
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq(PRIMARY_KEY, id);

        if (error) throw error;

        showMessage('Registro eliminado exitosamente', 'success');
        loadData();
    } catch (error) {
        handleError(error, 'al eliminar el registro');
    }
}

function closeModal() {
    document.getElementById('dataModal').style.display = 'none';
    document.getElementById('dataForm').reset();
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
    return (rows || []).map(row => {
        const transformed = {};

        Object.keys(row || {}).forEach(originalKey => {
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
    }).filter(row => Object.keys(row).length > 0);
}

function parseAndPrepareRows(rawInput, sourceLabel = 'entrada') {
    const parseResult = Papa.parse(rawInput, {
        header: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', ';', '\t', '|']
    });

    if (parseResult.errors && parseResult.errors.length > 0) {
        const realErrors = parseResult.errors.filter(err => err.code !== 'UndetectableDelimiter');
        if (realErrors.length > 0) {
            throw new Error(`Error al leer ${sourceLabel}: ${realErrors[0].message}`);
        }
    }

    const transformedRows = transformImportedRows(parseResult.data);
    if (transformedRows.length === 0) {
        throw new Error(`No se encontraron registros validos en ${sourceLabel}`);
    }

    return transformedRows;
}

function openImportModal() {
    document.getElementById('importModal').classList.add('show');
    document.getElementById('csvFile').value = '';

    const pastedData = document.getElementById('pastedData');
    if (pastedData) pastedData.value = '';

    resetImportProgress();
    document.getElementById('btnImport').disabled = true;
    importedData = [];
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('show');
}

function resetImportProgress() {
    const section = document.getElementById('importProgressSection');
    const bar = document.getElementById('importProgressBar');
    const text = document.getElementById('importProgressText');

    if (section) section.style.display = 'none';
    if (bar) bar.style.width = '0%';
    if (text) text.textContent = 'Archivo listo para importar';
}

function setImportProgress(processed, total) {
    const section = document.getElementById('importProgressSection');
    const bar = document.getElementById('importProgressBar');
    const text = document.getElementById('importProgressText');

    if (!section || !bar || !text) return;

    section.style.display = 'block';

    const safeTotal = total > 0 ? total : 1;
    const percent = Math.min(100, Math.round((processed / safeTotal) * 100));
    bar.style.width = `${percent}%`;
    text.textContent = `${processed}/${total} registros procesados`;
}

function parsePastedImportData() {
    const pastedData = document.getElementById('pastedData')?.value || '';
    if (!pastedData.trim()) {
        showMessage('Pega primero la informacion para procesarla', 'error');
        return;
    }

    try {
        importedData = parseAndPrepareRows(pastedData, 'el texto pegado');

        const validRows = importedData.filter(row => row[PRIMARY_KEY] !== null && row[PRIMARY_KEY] !== undefined && String(row[PRIMARY_KEY]).trim() !== '');
        if (validRows.length !== importedData.length) {
            const descartadas = importedData.length - validRows.length;
            importedData = validRows;
            showMessage(`Se descartaron ${descartadas} filas sin CORRERIA`, 'info');
        }

        if (importedData.length === 0) {
            throw new Error('No hay filas validas con CORRERIA para importar');
        }

        const importProgressSection = document.getElementById('importProgressSection');
        const importProgressBar = document.getElementById('importProgressBar');
        const importProgressText = document.getElementById('importProgressText');

        if (importProgressSection) importProgressSection.style.display = 'block';
        if (importProgressBar) importProgressBar.style.width = '0%';
        if (importProgressText) importProgressText.textContent = `${importedData.length} registros listos para importar`;
        document.getElementById('btnImport').disabled = false;

        showMessage('Texto procesado correctamente. Puedes importar ahora.', 'success');
    } catch (error) {
        showMessage(error.message || 'Error al procesar el texto pegado', 'error');
        document.getElementById('btnImport').disabled = true;
    }
}

async function importData() {
    if (importedData.length === 0) {
        showMessage('No hay datos para importar', 'error');
        return;
    }

    if (!confirm(`Deseas importar ${importedData.length} registros?`)) {
        return;
    }

    const btnImport = document.getElementById('btnImport');
    btnImport.disabled = true;
    btnImport.textContent = 'Importando...';
    setImportProgress(0, importedData.length);

    try {
        const batchSize = 100;
        let imported = 0;

        for (let i = 0; i < importedData.length; i += batchSize) {
            const batch = importedData.slice(i, i + batchSize);
            const { error } = await supabase
                .from(TABLE_NAME)
                .insert(batch);

            if (error) throw error;

            imported += batch.length;
            btnImport.textContent = `Importando... ${imported}/${importedData.length}`;
            setImportProgress(imported, importedData.length);
        }

        showMessage(`${importedData.length} registros importados exitosamente`, 'success');
        closeImportModal();
        loadData();
    } catch (error) {
        handleError(error, 'al importar datos');
    } finally {
        btnImport.disabled = false;
        btnImport.textContent = 'Importar Datos';
    }
}

async function limpiarTabla() {
    const confirmacion = prompt('Estas seguro de que deseas eliminar TODOS los registros de esta tabla? Esta accion no se puede deshacer.\n\nEscribe "ELIMINAR TODO" para confirmar:');

    if (confirmacion !== 'ELIMINAR TODO') {
        showMessage('Operacion cancelada', 'info');
        return;
    }

    try {
        showMessage('Eliminando todos los registros...', 'info');

        const { data: allRecords, error: fetchError } = await supabase
            .from(TABLE_NAME)
            .select(PRIMARY_KEY);

        if (fetchError) throw fetchError;

        if (!allRecords || allRecords.length === 0) {
            showMessage('La tabla ya esta vacia', 'info');
            return;
        }

        const batchSize = 100;
        let deleted = 0;

        for (let i = 0; i < allRecords.length; i += batchSize) {
            const batch = allRecords.slice(i, i + batchSize);
            const ids = batch.map(record => record[PRIMARY_KEY]);

            const { error } = await supabase
                .from(TABLE_NAME)
                .delete()
                .in(PRIMARY_KEY, ids);

            if (error) throw error;

            deleted += batch.length;
            showMessage(`Eliminados ${deleted} de ${allRecords.length} registros...`, 'info');
        }

        showMessage(`Tabla limpiada exitosamente (${deleted} registros eliminados)`, 'success');
        loadData();
    } catch (error) {
        handleError(error, 'al limpiar la tabla');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadData();

    document.getElementById('filterSearch')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            applyFilter();
        }
    });

    document.getElementById('csvFile')?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        resetImportProgress();

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                if (!results.data || results.data.length === 0) {
                    showMessage('El archivo esta vacio', 'error');
                    return;
                }

                importedData = transformImportedRows(results.data)
                    .filter(row => row[PRIMARY_KEY] !== null && row[PRIMARY_KEY] !== undefined && String(row[PRIMARY_KEY]).trim() !== '');

                if (importedData.length === 0) {
                    showMessage('No se encontraron registros validos para importar', 'error');
                    return;
                }

                const importProgressSection = document.getElementById('importProgressSection');
                const importProgressBar = document.getElementById('importProgressBar');
                const importProgressText = document.getElementById('importProgressText');

                if (importProgressSection) importProgressSection.style.display = 'block';
                if (importProgressBar) importProgressBar.style.width = '0%';
                if (importProgressText) importProgressText.textContent = `${importedData.length} registros listos para importar`;
                document.getElementById('btnImport').disabled = false;
            },
            error: function(error) {
                showMessage('Error al leer el archivo: ' + error.message, 'error');
            }
        });
    });

    document.getElementById('dataForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const data = {};

        for (const [key, value] of formData.entries()) {
            if (key !== 'recordId') {
                data[key] = value === '' ? null : value;
            }
        }

        const recordId = document.getElementById('recordId').value;

        try {
            if (recordId) {
                delete data[PRIMARY_KEY];

                const { error } = await supabase
                    .from(TABLE_NAME)
                    .update(data)
                    .eq(PRIMARY_KEY, recordId);

                if (error) throw error;
                showMessage('Registro actualizado exitosamente', 'success');
            } else {
                const { error } = await supabase
                    .from(TABLE_NAME)
                    .insert([data]);

                if (error) throw error;
                showMessage('Registro creado exitosamente', 'success');
            }

            closeModal();
            loadData();
        } catch (error) {
            handleError(error, recordId ? 'al actualizar' : 'al crear');
        }
    });

    window.onclick = function(event) {
        const modal = document.getElementById('dataModal');
        const importModal = document.getElementById('importModal');

        if (event.target === modal) {
            closeModal();
        } else if (event.target === importModal) {
            closeImportModal();
        }
    };
});
