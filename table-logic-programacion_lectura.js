let currentData = [];
let tableColumns = [];

async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    
    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';
    
    try {
        // Cargar datos ordenados por zona y correria de menor a mayor
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order('zona', { ascending: true })
            .order('correria', { ascending: true })
            .limit(500);
        
        if (error) throw error;
        
        currentData = data || [];
        
        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]);
            populateFilterColumns();
            renderTable(currentData);
        } else {
            tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #7f8c8d;">No hay registros en esta tabla</div>';
        }
        
        loadingIndicator.style.display = 'none';
    } catch (error) {
        console.error('Error completo:', error);
        handleError(error, 'al cargar datos');
        loadingIndicator.style.display = 'none';
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">Error: ' + error.message + '<br><br>Verifica que la tabla "programacion_lectura" existe en Supabase y tiene políticas RLS configuradas.</div>';
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
    
    let filteredData = currentData.filter(row => {
        if (filterColumn) {
            const value = row[filterColumn];
            return value != null && String(value).toLowerCase().includes(searchText);
        } else {
            return Object.values(row).some(value => 
                value != null && String(value).toLowerCase().includes(searchText)
            );
        }
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

    const columns = Object.keys(data[0]).filter(col => col !== PRIMARY_KEY); // Excluir id_correria
    
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
                tableHTML += '<td style="color: #bdc3c7;">—</td>';
            } else if (typeof value === 'boolean') {
                tableHTML += `<td>${value ? '✓' : '✗'}</td>`;
            } else if (col.includes('fecha') || col.includes('date')) {
                tableHTML += `<td>${formatDate(value)}</td>`;
            } else {
                tableHTML += `<td>${value}</td>`;
            }
        });
        tableHTML += `
            <td class="action-buttons">
                <button class="btn btn-sm btn-primary" onclick='editRecord(${JSON.stringify(row)})'>✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteRecord('${row[PRIMARY_KEY]}')">🗑️</button>
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
    
    if (currentData.length > 0) {
        const columns = Object.keys(currentData[0]);
        const formFields = document.getElementById('formFields');
        formFields.innerHTML = '';
        
        columns.forEach(col => {
            if (col === PRIMARY_KEY) return;
            
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';
            
            const label = document.createElement('label');
            label.textContent = formatColumnName(col);
            label.setAttribute('for', col);
            
            const input = document.createElement('input');
            input.type = 'text';
            input.id = col;
            input.name = col;
            
            if (col.includes('fecha') || col.includes('date')) {
                input.type = 'date';
            } else if (col.includes('hora') || col.includes('time')) {
                input.type = 'time';
            }
            
            formGroup.appendChild(label);
            formGroup.appendChild(input);
            formFields.appendChild(formGroup);
        });
    }
    
    document.getElementById('dataModal').style.display = 'block';
}

function editRecord(record) {
    document.getElementById('modalTitle').textContent = 'Editar Registro';
    document.getElementById('recordId').value = record[PRIMARY_KEY];
    
    const columns = Object.keys(record);
    const formFields = document.getElementById('formFields');
    formFields.innerHTML = '';
    
    columns.forEach(col => {
        if (col === PRIMARY_KEY) return;
        
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const label = document.createElement('label');
        label.textContent = formatColumnName(col);
        label.setAttribute('for', col);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = col;
        input.name = col;
        input.value = record[col] || '';
        
        if (col.includes('fecha') || col.includes('date')) {
            input.type = 'date';
            if (record[col]) {
                input.value = record[col].split('T')[0];
            }
        } else if (col.includes('hora') || col.includes('time')) {
            input.type = 'time';
        }
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        formFields.appendChild(formGroup);
    });
    
    document.getElementById('dataModal').style.display = 'block';
}

async function deleteRecord(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro?')) return;
    
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

// ========== FUNCIONES PARA IMPORTAR/ACTUALIZAR CSV ==========

let importedData = [];
let updateDataArray = [];

const ALLOWED_IMPORT_COLUMNS = [
    'correria',
    'nombre_correria',
    'zona',
    'supervisor',
    'transporte',
    'grupo_vehicular',
    'calificativo',
    'terreno',
    'historico2',
    'historico1',
    'codigo',
    'dias',
    'ok',
    'novedad',
    'repite',
    'totales',
    'nombre_lector',
    'telefono',
    'realiza_zona',
    'diferencia',
    'funcionario',
    'va_grupo'
];

const COLUMN_HEADER_MAP = {
    'correria': 'correria',
    'nombre_correria': 'nombre_correria',
    'zona': 'zona',
    'sup': 'supervisor',
    'supervisor': 'supervisor',
    'transporte': 'transporte',
    'gv': 'grupo_vehicular',
    'grupo_vehicular': 'grupo_vehicular',
    'cali': 'calificativo',
    'calificativo': 'calificativo',
    'terr': 'terreno',
    'terreno': 'terreno',
    'hist2': 'historico2',
    'historico2': 'historico2',
    'hist1': 'historico1',
    'historico1': 'historico1',
    'codigo': 'codigo',
    'dias': 'dias',
    'ok': 'ok',
    'nov': 'novedad',
    'novedad': 'novedad',
    'rep': 'repite',
    'repite': 'repite',
    'totales': 'totales',
    'nombre_lector': 'nombre_lector',
    'telefono': 'telefono',
    'que_realiza_zona': 'realiza_zona',
    'realiza_zona': 'realiza_zona',
    'diferencia': 'diferencia',
    'funcionario': 'funcionario',
    'vagrupo': 'va_grupo',
    'va_grupo': 'va_grupo'
};

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
        throw new Error(`No se encontraron registros válidos en ${sourceLabel}`);
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

function openUpdateModal() {
    document.getElementById('updateModal').classList.add('show');
    document.getElementById('csvFileUpdate').value = '';
    const pastedDataUpdate = document.getElementById('pastedDataUpdate');
    if (pastedDataUpdate) pastedDataUpdate.value = '';
    resetUpdateProgress();
    document.getElementById('btnUpdate').disabled = true;
    updateDataArray = [];
}

function closeUpdateModal() {
    document.getElementById('updateModal').classList.remove('show');
}

function resetUpdateProgress() {
    const section = document.getElementById('updateProgressSection');
    const bar = document.getElementById('updateProgressBar');
    const text = document.getElementById('updateProgressText');

    if (section) section.style.display = 'none';
    if (bar) bar.style.width = '0%';
    if (text) text.textContent = 'Archivo listo para actualizar';
}

function setUpdateProgress(processed, total, updated = 0, notFound = 0) {
    const section = document.getElementById('updateProgressSection');
    const bar = document.getElementById('updateProgressBar');
    const text = document.getElementById('updateProgressText');

    if (!section || !bar || !text) return;

    section.style.display = 'block';

    const safeTotal = total > 0 ? total : 1;
    const percent = Math.min(100, Math.round((processed / safeTotal) * 100));
    bar.style.width = `${percent}%`;
    text.textContent = `${processed}/${total} procesados · ${updated} actualizados · ${notFound} no encontrados`;
}

function parsePastedImportData() {
    const pastedData = document.getElementById('pastedData')?.value || '';
    if (!pastedData.trim()) {
        showMessage('Pega primero la información para procesarla', 'error');
        return;
    }

    try {
        importedData = parseAndPrepareRows(pastedData, 'el texto pegado');

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

function parsePastedUpdateData() {
    const pastedData = document.getElementById('pastedDataUpdate')?.value || '';
    if (!pastedData.trim()) {
        showMessage('Pega primero la información para procesarla', 'error');
        return;
    }

    try {
        const transformedRows = parseAndPrepareRows(pastedData, 'el texto pegado');

        if (!transformedRows[0]?.correria) {
            showMessage('El texto debe contener la columna "correria" para actualizar registros', 'error');
            document.getElementById('btnUpdate').disabled = true;
            return;
        }

        updateDataArray = transformedRows;

        const progressSection = document.getElementById('updateProgressSection');
        const progressBar = document.getElementById('updateProgressBar');
        const progressText = document.getElementById('updateProgressText');

        if (progressSection) progressSection.style.display = 'block';
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = `${updateDataArray.length} registros listos para actualizar`;
        document.getElementById('btnUpdate').disabled = false;

        showMessage('Texto procesado correctamente. Puedes actualizar ahora.', 'success');
    } catch (error) {
        showMessage(error.message || 'Error al procesar el texto pegado', 'error');
        document.getElementById('btnUpdate').disabled = true;
    }
}

async function importData() {
    if (importedData.length === 0) {
        showMessage('No hay datos para importar', 'error');
        return;
    }
    
    if (!confirm(`¿Deseas importar ${importedData.length} registros?`)) {
        return;
    }
    
    const btnImport = document.getElementById('btnImport');
    btnImport.disabled = true;
    btnImport.textContent = 'Importando...';
    setImportProgress(0, importedData.length);
    
    try {
        // Insertar datos en lotes de 100 registros
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
        
        showMessage(`✓ ${importedData.length} registros importados exitosamente`, 'success');
        closeImportModal();
        loadData();
    } catch (error) {
        handleError(error, 'al importar datos');
    } finally {
        btnImport.disabled = false;
        btnImport.textContent = 'Importar Datos';
    }
}

async function updateData() {
    if (updateDataArray.length === 0) {
        showMessage('No hay datos para actualizar', 'error');
        return;
    }
    
    if (!updateDataArray[0]['correria']) {
        showMessage('El archivo CSV debe contener la columna "correria" para actualizar registros', 'error');
        return;
    }
    
    if (!confirm(`¿Deseas actualizar ${updateDataArray.length} registros usando la columna "correria" como referencia?`)) {
        return;
    }
    
    const btnUpdate = document.getElementById('btnUpdate');
    btnUpdate.disabled = true;
    btnUpdate.textContent = 'Actualizando...';
    setUpdateProgress(0, updateDataArray.length, 0, 0);
    
    try {
        let updated = 0;
        let notFound = 0;
        
        for (let i = 0; i < updateDataArray.length; i++) {
            const row = updateDataArray[i];
            const correria = row['correria'];
            
            if (!correria) {
                notFound++;
                continue;
            }
            
            // Buscar por la columna correria
            const { data: existing } = await supabase
                .from(TABLE_NAME)
                .select(PRIMARY_KEY)
                .eq('correria', correria)
                .single();
            
            if (existing) {
                // Actualizar usando id_correria como clave
                const { error } = await supabase
                    .from(TABLE_NAME)
                    .update(row)
                    .eq(PRIMARY_KEY, existing[PRIMARY_KEY]);
                
                if (error) throw error;
                updated++;
            } else {
                notFound++;
            }

            const processed = i + 1;
            btnUpdate.textContent = `Actualizando... ${processed}/${updateDataArray.length}`;
            setUpdateProgress(processed, updateDataArray.length, updated, notFound);
        }
        
        showMessage(`✓ Actualización completada: ${updated} actualizados, ${notFound} no encontrados`, 'success');
        closeUpdateModal();
        loadData();
    } catch (error) {
        handleError(error, 'al actualizar datos');
    } finally {
        btnUpdate.disabled = false;
        btnUpdate.textContent = 'Actualizar Datos';
    }
}

// Limpiar tabla
async function limpiarTabla() {
    const confirmacion = prompt('¿Estás seguro de que deseas eliminar TODOS los registros de esta tabla? Esta acción no se puede deshacer.\n\nEscribe "ELIMINAR TODO" para confirmar:');
    
    if (confirmacion !== 'ELIMINAR TODO') {
        showMessage('Operación cancelada', 'info');
        return;
    }
    
    try {
        showMessage('Eliminando todos los registros...', 'info');
        
        // Obtener todos los IDs primero
        const { data: allRecords, error: fetchError } = await supabase
            .from(TABLE_NAME)
            .select(PRIMARY_KEY);
        
        if (fetchError) throw fetchError;
        
        if (!allRecords || allRecords.length === 0) {
            showMessage('La tabla ya está vacía', 'info');
            return;
        }
        
        // Eliminar en lotes
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
        
        showMessage(`✓ Tabla limpiada exitosamente (${deleted} registros eliminados)`, 'success');
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
    
    // Manejar selección de archivo CSV para importar
    document.getElementById('csvFile')?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        resetImportProgress();
        
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                if (!results.data || results.data.length === 0) {
                    showMessage('El archivo está vacío', 'error');
                    return;
                }

                importedData = transformImportedRows(results.data);
                if (importedData.length === 0) {
                    showMessage('No se encontraron registros válidos para importar', 'error');
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
    
    // Manejar selección de archivo CSV para actualizar
    document.getElementById('csvFileUpdate')?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                if (!results.data || results.data.length === 0) {
                    showMessage('El archivo está vacío', 'error');
                    return;
                }

                const transformedRows = transformImportedRows(results.data);
                if (transformedRows.length === 0) {
                    showMessage('No se encontraron registros válidos para actualizar', 'error');
                    return;
                }

                if (!transformedRows[0]?.correria) {
                    showMessage('El archivo debe contener la columna "correria" para actualizar registros', 'error');
                    return;
                }

                updateDataArray = transformedRows;
                const progressSection = document.getElementById('updateProgressSection');
                const progressBar = document.getElementById('updateProgressBar');
                const progressText = document.getElementById('updateProgressText');

                if (progressSection) progressSection.style.display = 'block';
                if (progressBar) progressBar.style.width = '0%';
                if (progressText) progressText.textContent = `${updateDataArray.length} registros listos para actualizar`;
                document.getElementById('btnUpdate').disabled = false;
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
        
        for (let [key, value] of formData.entries()) {
            if (key !== 'recordId' && value !== '') {
                data[key] = value;
            }
        }
        
        const recordId = document.getElementById('recordId').value;
        
        try {
            if (recordId) {
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
        const updateModal = document.getElementById('updateModal');
        
        if (event.target === modal) {
            closeModal();
        } else if (event.target === importModal) {
            closeImportModal();
        } else if (event.target === updateModal) {
            closeUpdateModal();
        }
    };
});
