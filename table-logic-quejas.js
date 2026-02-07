// Lógica específica para la tabla quejas
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
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order(PRIMARY_KEY, { ascending: false })
            .limit(500);
        
        if (error) throw error;
        
        currentData = data || [];
        
        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]);
            renderTable(currentData);
        } else {
            tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #7f8c8d;">No hay registros en esta tabla</div>';
        }
        
        loadingIndicator.style.display = 'none';
    } catch (error) {
        handleError(error, 'al cargar datos');
        loadingIndicator.style.display = 'none';
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">Error: ' + error.message + '</div>';
    }
}

function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    
    let html = '<table class="data-table"><thead><tr>';
    
    // Filtrar columnas para no mostrar el ID
    const visibleColumns = tableColumns.filter(col => col !== PRIMARY_KEY);
    
    visibleColumns.forEach(col => {
        html += `<th>${formatColumnName(col)}</th>`;
    });
    html += '<th>Acciones</th></tr></thead><tbody>';
    
    data.forEach(row => {
        html += '<tr>';
        visibleColumns.forEach(col => {
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
    const lowerColumn = String(columnName || '').toLowerCase();
    if (lowerColumn.includes('firma') && lowerColumn.includes('url')) {
        const url = String(value).trim();
        if (!url) return '-';
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">Firma</a>`;
    }
    if (lowerColumn.includes('pdf')) {
        const url = String(value).trim();
        if (!url) return '-';
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">PDF</a>`;
    }
    if (lowerColumn.includes('evidencia')) {
        const url = String(value).trim();
        if (!url) return '-';
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">Evidencia</a>`;
    }
    if (columnName.includes('fecha') || columnName.includes('date') || columnName.includes('_at')) {
        return formatDate(value);
    }
    if (typeof value === 'object') return JSON.stringify(value).substring(0, 50);
    const str = String(value);
    return str.length > 80 ? str.substring(0, 80) + '...' : str;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function openCreateModal() {
    document.getElementById('modalTitle').textContent = 'Nueva Queja';
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
        document.getElementById('modalTitle').textContent = 'Editar Queja';
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
    if (!confirm('¿Estás seguro de eliminar esta queja?')) return;
    
    try {
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq(PRIMARY_KEY, id);
        
        if (error) throw error;
        showMessage('Queja eliminada', 'success');
        loadData();
    } catch (error) {
        handleError(error, 'al eliminar');
    }
}

function closeModal() {
    document.getElementById('dataModal').classList.remove('show');
}

// ========== FUNCIONES PARA IMPORTAR/EXPORTAR EXCEL ==========

let importedData = [];

function openImportModal() {
    document.getElementById('importModal').classList.add('show');
    document.getElementById('excelFile').value = '';
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('btnImport').disabled = true;
    importedData = [];
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('show');
}

// Manejar selección de archivo
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('excelFile')?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                
                if (jsonData.length === 0) {
                    showMessage('El archivo está vacío', 'error');
                    return;
                }
                
                importedData = jsonData;
                showPreview(jsonData);
                document.getElementById('btnImport').disabled = false;
            } catch (error) {
                showMessage('Error al leer el archivo: ' + error.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    });
});

function showPreview(data) {
    const previewContent = document.getElementById('previewContent');
    const previewCount = document.getElementById('previewCount');
    
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
    document.getElementById('importPreview').style.display = 'block';
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
        
        showMessage(`${imported} quejas importadas exitosamente`, 'success');
        closeImportModal();
        loadData();
    } catch (error) {
        showMessage('Error al importar: ' + error.message, 'error');
    } finally {
        btnImport.disabled = false;
        btnImport.textContent = 'Importar Datos';
    }
}

function exportToExcel() {
    if (currentData.length === 0) {
        showMessage('No hay datos para exportar', 'error');
        return;
    }
    
    try {
        // Crear libro de trabajo
        const worksheet = XLSX.utils.json_to_sheet(currentData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Quejas');
        
        // Generar nombre de archivo con fecha
        const fecha = new Date().toISOString().split('T')[0];
        const filename = `quejas_${fecha}.xlsx`;
        
        // Descargar archivo
        XLSX.writeFile(workbook, filename);
        showMessage(`Archivo ${filename} descargado`, 'success');
    } catch (error) {
        showMessage('Error al exportar: ' + error.message, 'error');
    }
}

async function limpiarTabla() {
    const confirmText = prompt(
        'ADVERTENCIA: Esto eliminará TODAS las quejas de la tabla.\n\n' +
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
        
        showMessage(`${deleted} quejas eliminadas`, 'success');
        loadData();
    } catch (error) {
        showMessage('Error al limpiar tabla: ' + error.message, 'error');
    }
}

// ========== FIN FUNCIONES EXCEL ==========

document.addEventListener('DOMContentLoaded', function() {
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
                showMessage('Queja actualizada', 'success');
            } else {
                // Crear nuevo registro
                const { error } = await supabase
                    .from(TABLE_NAME)
                    .insert([formData]);
                
                if (error) throw error;
                showMessage('Queja creada', 'success');
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

// ========== FUNCIONES AUXILIARES ==========

function showMessage(message, type = 'info') {
    const colors = {
        success: '#27ae60',
        error: '#e74c3c',
        info: '#3498db'
    };
    
    const msgDiv = document.createElement('div');
    msgDiv.textContent = message;
    msgDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 15px 20px;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(msgDiv);
    
    setTimeout(() => {
        msgDiv.style.opacity = '0';
        msgDiv.style.transition = 'opacity 0.3s';
        setTimeout(() => msgDiv.remove(), 300);
    }, 3000);
}

function handleError(error, context) {
    console.error(`Error ${context}:`, error);
    showMessage(`Error ${context}: ${error.message}`, 'error');
}
