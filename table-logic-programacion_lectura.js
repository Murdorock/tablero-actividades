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

function openImportModal() {
    document.getElementById('importModal').classList.add('show');
    document.getElementById('csvFile').value = '';
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('btnImport').disabled = true;
    importedData = [];
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('show');
}

function openUpdateModal() {
    document.getElementById('updateModal').classList.add('show');
    document.getElementById('csvFileUpdate').value = '';
    document.getElementById('updatePreview').style.display = 'none';
    document.getElementById('btnUpdate').disabled = true;
    updateDataArray = [];
}

function closeUpdateModal() {
    document.getElementById('updateModal').classList.remove('show');
}

function showPreview(data, contentId, countId) {
    const previewContent = document.getElementById(contentId);
    const previewCount = document.getElementById(countId);
    
    previewCount.textContent = data.length;
    
    // Mostrar primeros 5 registros
    const preview = data.slice(0, 5);
    let html = '<table style="width: 100%; border-collapse: collapse; font-size: 12px;"><thead><tr>';
    
    const columns = Object.keys(preview[0]);
    columns.forEach(col => {
        html += `<th style="border: 1px solid #ddd; padding: 8px; background: #34495e; color: white;">${col}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    preview.forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
            html += `<td style="border: 1px solid #ddd; padding: 8px;">${row[col] || '-'}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    
    if (data.length > 5) {
        html += `<p style="margin-top: 10px; font-style: italic; color: #7f8c8d;">... y ${data.length - 5} registros más</p>`;
    }
    
    previewContent.innerHTML = html;
    previewContent.parentElement.style.display = 'block';
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
            
            // Actualizar progreso cada 10 registros
            if ((i + 1) % 10 === 0 || i === updateDataArray.length - 1) {
                btnUpdate.textContent = `Actualizando... ${i + 1}/${updateDataArray.length}`;
            }
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
        
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                if (results.data.length === 0) {
                    showMessage('El archivo está vacío', 'error');
                    return;
                }
                
                importedData = results.data;
                showPreview(results.data, 'previewContent', 'previewCount');
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
                if (results.data.length === 0) {
                    showMessage('El archivo está vacío', 'error');
                    return;
                }
                
                updateDataArray = results.data;
                showPreview(results.data, 'updatePreviewContent', 'updatePreviewCount');
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
