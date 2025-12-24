// Lógica específica para la tabla base (usa id_lector como clave única)
let tableColumns = [];
let currentData = [];

document.addEventListener('DOMContentLoaded', function() {
    loadData();
});

async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    
    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';
    
    try {
        // Cargar datos ordenados por id_lector de menor a mayor
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order(PRIMARY_KEY, { ascending: true })
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
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">Error: ' + error.message + '<br><br>Verifica que la tabla "base" existe en Supabase y tiene políticas RLS configuradas.</div>';
    }
}

function populateFilterColumns() {
    const filterColumn = document.getElementById('filterColumn');
    if (!filterColumn || tableColumns.length === 0) return;
    
    // Mantener la opción "Todas las columnas"
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
            // Filtrar por columna específica
            const value = row[filterColumn];
            return value != null && String(value).toLowerCase().includes(searchText);
        } else {
            // Buscar en todas las columnas
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

function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    
    let html = '<table class="data-table"><thead><tr>';
    
    tableColumns.forEach(col => {
        html += `<th>${formatColumnName(col)}</th>`;
    });
    html += '<th>Acciones</th></tr></thead><tbody>';
    
    data.forEach(row => {
        html += '<tr>';
        tableColumns.forEach(col => {
            html += `<td>${formatValue(row[col], col)}</td>`;
        });
        
        const rowId = row[PRIMARY_KEY];
        html += `<td class="actions">
            <button class="btn btn-primary btn-sm" onclick='editRecord(${JSON.stringify(row).replace(/'/g, "&apos;")})'>✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteRecord('${rowId}')">🗑️</button>
        </td></tr>`;
    });
    
    html += '</tbody></table>';
    tableContainer.innerHTML = html;
}

function formatColumnName(col) {
    return col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatValue(value, columnName) {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (columnName.includes('fecha') || columnName.includes('date') || columnName.includes('_at')) {
        return formatDate(value);
    }
    if (typeof value === 'object') return JSON.stringify(value).substring(0, 50);
    const str = String(value);
    return str.length > 80 ? str.substring(0, 80) + '...' : str;
}

function openCreateModal() {
    document.getElementById('modalTitle').textContent = 'Nuevo Registro';
    document.getElementById('dataForm').reset();
    document.getElementById('recordId').value = '';
    generateFormFields();
    document.getElementById('dataModal').classList.add('show');
}

function generateFormFields() {
    const formFields = document.getElementById('formFields');
    formFields.innerHTML = '';
    
    tableColumns.forEach(col => {
        if (col === 'created_at' || col === 'updated_at') return;
        
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const label = document.createElement('label');
        label.textContent = formatColumnName(col);
        label.setAttribute('for', col);
        
        let input = document.createElement('input');
        input.type = 'text';
        input.id = col;
        input.name = col;
        
        // Marcar la clave primaria como requerida en modo creación
        if (col === PRIMARY_KEY) {
            input.required = true;
        }
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        formFields.appendChild(formGroup);
    });
}

function editRecord(record) {
    try {
        document.getElementById('modalTitle').textContent = 'Editar Registro';
        document.getElementById('recordId').value = record[PRIMARY_KEY];
        generateFormFields();
        
        tableColumns.forEach(col => {
            const input = document.getElementById(col);
            if (input && record[col] !== null && record[col] !== undefined) {
                input.value = record[col];
                // Deshabilitar la clave primaria al editar
                if (col === PRIMARY_KEY) {
                    input.disabled = true;
                }
            }
        });
        
        document.getElementById('dataModal').classList.add('show');
    } catch (error) {
        handleError(error, 'al cargar registro');
    }
}

async function deleteRecord(id) {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return;
    
    try {
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq(PRIMARY_KEY, id);
        
        if (error) throw error;
        showMessage('Registro eliminado', 'success');
        loadData();
    } catch (error) {
        handleError(error, 'al eliminar');
    }
}

function closeModal() {
    document.getElementById('dataModal').classList.remove('show');
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

// Manejar selección de archivo CSV para importar
document.addEventListener('DOMContentLoaded', function() {
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
                
                // Validar que tenga la columna id_lector
                if (!results.data[0].hasOwnProperty(PRIMARY_KEY)) {
                    showMessage(`El archivo debe contener la columna "${PRIMARY_KEY}"`, 'error');
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
});

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
            
            // Actualizar progreso
            btnImport.textContent = `Importando... ${imported}/${importedData.length}`;
        }
        
        showMessage(`${imported} registros importados exitosamente`, 'success');
        closeImportModal();
        loadData();
    } catch (error) {
        showMessage('Error al importar: ' + error.message, 'error');
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
    
    if (!confirm(`¿Deseas actualizar ${updateDataArray.length} registros usando la columna ${PRIMARY_KEY}?`)) {
        return;
    }
    
    const btnUpdate = document.getElementById('btnUpdate');
    btnUpdate.disabled = true;
    btnUpdate.textContent = 'Actualizando...';
    
    try {
        let updated = 0;
        let errors = 0;
        
        for (let i = 0; i < updateDataArray.length; i++) {
            const row = updateDataArray[i];
            const id = row[PRIMARY_KEY];
            
            if (!id) {
                errors++;
                continue;
            }
            
            // Crear objeto con los datos a actualizar (excluyendo la clave primaria)
            const updateRow = {};
            Object.keys(row).forEach(key => {
                if (key !== PRIMARY_KEY) {
                    updateRow[key] = row[key];
                }
            });
            
            const { error } = await supabase
                .from(TABLE_NAME)
                .update(updateRow)
                .eq(PRIMARY_KEY, id);
            
            if (error) {
                console.error(`Error al actualizar ${id}:`, error);
                errors++;
            } else {
                updated++;
            }
            
            // Actualizar progreso cada 10 registros
            if (i % 10 === 0) {
                btnUpdate.textContent = `Actualizando... ${i + 1}/${updateDataArray.length}`;
            }
        }
        
        let message = `${updated} registros actualizados`;
        if (errors > 0) {
            message += `, ${errors} errores`;
        }
        
        showMessage(message, errors > 0 ? 'info' : 'success');
        closeUpdateModal();
        loadData();
    } catch (error) {
        showMessage('Error al actualizar: ' + error.message, 'error');
    } finally {
        btnUpdate.disabled = false;
        btnUpdate.textContent = 'Actualizar Datos';
    }
}

async function limpiarTabla() {
    const confirmText = prompt(
        'ADVERTENCIA: Esto eliminará TODOS los registros de la tabla base.\n\n' +
        'Para confirmar, escribe: ELIMINAR TODO'
    );
    
    if (confirmText !== 'ELIMINAR TODO') {
        showMessage('Operación cancelada', 'info');
        return;
    }
    
    try {
        // Obtener todos los IDs
        const { data, error: fetchError } = await supabase
            .from(TABLE_NAME)
            .select(PRIMARY_KEY);
        
        if (fetchError) throw fetchError;
        
        if (!data || data.length === 0) {
            showMessage('La tabla ya está vacía', 'info');
            return;
        }
        
        // Eliminar en lotes
        const batchSize = 100;
        let deleted = 0;
        
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const ids = batch.map(row => row[PRIMARY_KEY]);
            
            const { error } = await supabase
                .from(TABLE_NAME)
                .delete()
                .in(PRIMARY_KEY, ids);
            
            if (error) throw error;
            deleted += batch.length;
        }
        
        showMessage(`${deleted} registros eliminados`, 'success');
        loadData();
    } catch (error) {
        showMessage('Error al limpiar tabla: ' + error.message, 'error');
    }
}

// ========== FIN FUNCIONES CSV ==========

document.addEventListener('DOMContentLoaded', function() {
    loadData();
    
    // Enter en el filtro de búsqueda
    document.getElementById('filterSearch')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            applyFilter();
        }
    });
    
    document.getElementById('dataForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const id = document.getElementById('recordId').value;
        const formData = {};
        
        tableColumns.forEach(col => {
            if (col === 'created_at' || col === 'updated_at') return;
            const input = document.getElementById(col);
            if (input && !input.disabled) {
                formData[col] = input.value || null;
            }
        });
        
        try {
            if (id) {
                // Actualizar registro existente
                const { error } = await supabase
                    .from(TABLE_NAME)
                    .update(formData)
                    .eq(PRIMARY_KEY, id);
                
                if (error) throw error;
                showMessage('Actualizado', 'success');
            } else {
                // Crear nuevo registro
                const { error } = await supabase
                    .from(TABLE_NAME)
                    .insert([formData]);
                
                if (error) throw error;
                showMessage('Creado', 'success');
            }
            closeModal();
            loadData();
        } catch (error) {
            handleError(error, 'al guardar');
        }
    });
    
    document.getElementById('dataModal')?.addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
});
