// Configuración específica para tabla Personal
const TABLE_NAME = 'personal';
const PRIMARY_KEY = 'id_codigo';

let currentData = [];
let tableColumns = [];

// Cargar datos iniciales
async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';
    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order(PRIMARY_KEY, { ascending: true }) // Orden ascendente
            .limit(500);
        if (error) throw error;
        currentData = data || [];
        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]);
            renderTable(currentData);
        } else {
            tableContainer.innerHTML = '<div class="no-data">No hay personal registrado para mostrar</div>';
        }
    } catch (error) {
        console.error('Error cargando datos:', error);
        tableContainer.innerHTML = '<div class="error">Error cargando datos: ' + error.message + '</div>';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Renderizar tabla
function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    // Filtro global fuera de la tabla, similar a base.js
    let filterHtml = `<div style="margin-bottom: 10px; display: flex; gap: 10px; align-items: center;">
        <label for="filterSearch" style="font-weight:bold; font-size:1.1em;">Buscar:</label>
        <input type="text" id="filterSearch" style="width: 200px; height: 38px; font-size: 1.1em; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;" placeholder="Buscar..." autocomplete="off">
        <select id="filterColumn" style="min-width:130px; height: 38px; font-size: 1.1em; border-radius: 6px; border: 1px solid #ccc; padding: 6px 10px;"></select>
        <button type="button" id="btnClearFilter" class="btn btn-secondary btn-sm" style="height: 38px; font-size: 1.1em; border-radius: 6px;">Limpiar</button>
    </div>`;
    // Tabla
    let html = '<table class="data-table"><thead><tr>';
    tableColumns.forEach(column => {
        const displayName = column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        html += `<th>${displayName}</th>`;
    });
    html += '<th>Acciones</th></tr></thead><tbody>';
    data.forEach(row => {
        const rowId = row[PRIMARY_KEY] || row[tableColumns[0]];
        html += '<tr>';
        tableColumns.forEach(column => {
            let value = row[column];
            
            // Formatear valores especiales
            if (value === null || value === undefined) {
                value = '';
            } else if (typeof value === 'string' && value.length > 50) {
                value = value.substring(0, 50) + '...';
            } else if (column.includes('fecha') || column.includes('date')) {
                // Formatear fechas
                if (value) {
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) {
                        value = date.toLocaleDateString('es-ES');
                    }
                }
            } else if (column.includes('salario') || column.includes('sueldo') || column.includes('pago')) {
                // Formatear moneda
                if (value && !isNaN(value)) {
                    value = new Intl.NumberFormat('es-ES', { 
                        style: 'currency', 
                        currency: 'EUR' 
                    }).format(value);
                }
            } else if (column.includes('telefono') || column.includes('celular') || column.includes('phone')) {
                // Formatear teléfonos
                if (value && value.toString().length >= 10) {
                    value = value.toString().replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
                }
            }
            
            // Resaltar estado activo/inactivo
            if (column.includes('estado') || column.includes('activo')) {
                const isActive = value === 'activo' || value === 'Activo' || value === true || value === 1;
                const statusClass = isActive ? 'status-active' : 'status-inactive';
                const statusText = isActive ? '✅ Activo' : '❌ Inactivo';
                html += `<td><span class="${statusClass}">${statusText}</span></td>`;
            } else {
                html += `<td>${value}</td>`;
            }
        });
        html += `<td class="actions"><button class="btn btn-sm btn-primary" onclick="openEditModal('${rowId}')" title="Editar">✏️</button><button class="btn btn-sm btn-danger" onclick="deleteRecord('${rowId}')" title="Eliminar">🗑️</button><button class="btn btn-sm btn-info" onclick="viewDetails('${rowId}')" title="Ver detalles">👁️</button></td>`;
        html += '</tr>';
    });
    html += '</tbody></table>';
    tableContainer.innerHTML = filterHtml + html;
    // Poblamos el select de columnas
    const filterColumn = document.getElementById('filterColumn');
    if (filterColumn) {
        filterColumn.innerHTML = '<option value="">Todas las columnas</option>';
        tableColumns.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            filterColumn.appendChild(option);
        });
    }
    // Asignamos eventos
    const filterSearch = document.getElementById('filterSearch');
    const btnClearFilter = document.getElementById('btnClearFilter');
    if (filterSearch) {
        filterSearch.value = window.lastFilterValue || '';
        filterSearch.disabled = false;
        filterSearch.addEventListener('input', function() {
            window.lastFilterValue = this.value;
            applyFilterPersonal();
        });
    }
    if (filterColumn) {
        filterColumn.onchange = function() {
            applyFilterPersonal();
        };
    }
    if (btnClearFilter) {
        btnClearFilter.onclick = function() {
            filterSearch.value = '';
            filterColumn.value = '';
            applyFilterPersonal();
            filterSearch.focus();
        };
    }
    // Enfocar el campo de búsqueda automáticamente
    setTimeout(() => {
        if (filterSearch) filterSearch.focus();
    }, 0);
}

// Función para aplicar el filtro
function applyFilterPersonal() {
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
            return tableColumns.some(col => {
                const value = row[col];
                return value != null && String(value).toLowerCase().includes(searchText);
            });
        }
    });
    renderTable(filteredData);
}

// Abrir modal para crear nuevo registro
function openCreateModal() {
    document.getElementById('modalTitle').textContent = 'Nuevo Personal';
    document.getElementById('recordId').value = '';
    generateFormFields();
    document.getElementById('dataModal').style.display = 'flex';
}

// Abrir modal para editar registro
async function openEditModal(id) {
    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq(PRIMARY_KEY, id)
            .single();
        
        if (error) throw error;
        
        document.getElementById('modalTitle').textContent = 'Editar Personal';
        document.getElementById('recordId').value = data[PRIMARY_KEY] || data[tableColumns[0]];
        
        generateFormFields(data);
        document.getElementById('dataModal').style.display = 'flex';
    } catch (error) {
        console.error('Error cargando registro:', error);
        alert('Error cargando registro: ' + error.message);
    }
}

// Ver detalles del personal
async function viewDetails(id) {
    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq(PRIMARY_KEY, id)
            .single();
        
        if (error) throw error;
        
        let detailsHtml = '<div style="max-width: 500px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">';
        detailsHtml += '<h3 style="text-align: center; margin-bottom: 20px;">👤 Detalles del Personal</h3>';
        
        Object.entries(data).forEach(([key, value]) => {
            const displayName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            let displayValue = value || 'No especificado';
            
            if (key.includes('fecha') && value) {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    displayValue = date.toLocaleDateString('es-ES');
                }
            }
            
            detailsHtml += `<p><strong>${displayName}:</strong> ${displayValue}</p>`;
        });
        
        detailsHtml += '<div style="text-align: center; margin-top: 20px;">';
        detailsHtml += '<button onclick="this.parentElement.parentElement.remove()" class="btn btn-secondary">Cerrar</button>';
        detailsHtml += '</div></div>';
        
        // Crear overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;';
        overlay.innerHTML = detailsHtml;
        
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
        
        document.body.appendChild(overlay);
        
    } catch (error) {
        console.error('Error cargando detalles:', error);
        alert('Error cargando detalles: ' + error.message);
    }
}

// Eliminar registro
async function deleteRecord(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este registro de personal?')) {
        return;
    }
    
    try {
        const { error } = await supabase.from(TABLE_NAME).delete().eq(PRIMARY_KEY, id);
        
        if (error) throw error;
        
        alert('Personal eliminado exitosamente');
        loadData();
    } catch (error) {
        console.error('Error eliminando registro:', error);
        alert('Error eliminando registro: ' + error.message);
    }
}

// Generar campos del formulario
function generateFormFields(data = {}) {
    const formFields = document.getElementById('formFields');
    formFields.innerHTML = '';
    
    tableColumns.forEach(column => {
        // Saltar la clave primaria si es auto-incrementable y es nuevo registro
        if (column === PRIMARY_KEY && !data[column]) {
            return;
        }
        
        const displayName = column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        let value = data[column] || '';
        let inputType = 'text';
        
        // Determinar tipo de input basado en el nombre de la columna
        if (column.includes('fecha') || column.includes('date')) {
            inputType = 'date';
            if (value) {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    value = date.toISOString().split('T')[0];
                }
            }
        } else if (column.includes('email') || column.includes('correo')) {
            inputType = 'email';
        } else if (column.includes('telefono') || column.includes('celular') || column.includes('phone')) {
            inputType = 'tel';
        } else if (column.includes('salario') || column.includes('sueldo') || column.includes('pago')) {
            inputType = 'number';
        } else if (column.includes('edad')) {
            inputType = 'number';
        }
        
        let fieldHtml = '';
        
        // Campos especiales
        if (column.includes('estado') || column.includes('activo')) {
            fieldHtml = `
                <div class="form-group">
                    <label for="${column}">${displayName}:</label>
                    <select id="${column}" name="${column}" class="form-control">
                        <option value="activo" ${value === 'activo' || value === 1 ? 'selected' : ''}>Activo</option>
                        <option value="inactivo" ${value === 'inactivo' || value === 0 ? 'selected' : ''}>Inactivo</option>
                    </select>
                </div>
            `;
        } else if (column.includes('cargo') || column.includes('puesto') || column.includes('posicion')) {
            fieldHtml = `
                <div class="form-group">
                    <label for="${column}">${displayName}:</label>
                    <select id="${column}" name="${column}" class="form-control">
                        <option value="">Seleccionar cargo</option>
                        <option value="Gerente" ${value === 'Gerente' ? 'selected' : ''}>Gerente</option>
                        <option value="Supervisor" ${value === 'Supervisor' ? 'selected' : ''}>Supervisor</option>
                        <option value="Lector" ${value === 'Lector' ? 'selected' : ''}>Lector</option>
                        <option value="Técnico" ${value === 'Técnico' ? 'selected' : ''}>Técnico</option>
                        <option value="Administrativo" ${value === 'Administrativo' ? 'selected' : ''}>Administrativo</option>
                        <option value="Auxiliar" ${value === 'Auxiliar' ? 'selected' : ''}>Auxiliar</option>
                        <option value="Otro" ${value === 'Otro' ? 'selected' : ''}>Otro</option>
                    </select>
                </div>
            `;
        } else if (column.includes('direccion') || column.includes('address')) {
            fieldHtml = `
                <div class="form-group">
                    <label for="${column}">${displayName}:</label>
                    <textarea id="${column}" name="${column}" class="form-control" rows="2">${value}</textarea>
                </div>
            `;
        } else {
            fieldHtml = `
                <div class="form-group">
                    <label for="${column}">${displayName}:</label>
                    <input type="${inputType}" id="${column}" name="${column}" value="${value}" class="form-control"
                           ${column.includes('edad') ? 'min="18" max="70"' : ''}
                           ${column.includes('salario') ? 'min="0" step="0.01"' : ''}>
                </div>
            `;
        }
        
        formFields.innerHTML += fieldHtml;
    });
}

// Manejar envío del formulario
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('dataForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = {};
            
            for (let [key, value] of formData.entries()) {
                // Convertir valores numéricos
                if (key.includes('salario') || key.includes('edad')) {
                    data[key] = value ? parseFloat(value) : null;
                } else {
                    data[key] = value || null;
                }
            }
            
            const id = document.getElementById('recordId').value;
            
            try {
                if (id) {
                    // Actualizar registro existente
                    const { error } = await supabase.from(TABLE_NAME).update(data).eq(PRIMARY_KEY, id);
                    if (error) throw error;
                    alert('Personal actualizado exitosamente');
                } else {
                    // Crear nuevo registro
                    const { error } = await supabase.from(TABLE_NAME).insert([data]);
                    if (error) throw error;
                    alert('Personal creado exitosamente');
                }
                
                closeModal();
                loadData();
            } catch (error) {
                console.error('Error guardando registro:', error);
                alert('Error guardando registro: ' + error.message);
            }
        });
    }
});

// Cerrar modal
function closeModal() {
    document.getElementById('dataModal').style.display = 'none';
}

// Cargar datos al inicio
document.addEventListener('DOMContentLoaded', function() {
    loadData();
});

// Función de búsqueda
function searchData(searchTerm) {
    if (!searchTerm) {
        renderTable(currentData);
        return;
    }
    
    const filteredData = currentData.filter(row => {
        return Object.values(row).some(value => {
            if (value === null || value === undefined) return false;
            return value.toString().toLowerCase().includes(searchTerm.toLowerCase());
        });
    });
    
    renderTable(filteredData);
}

// Filtrar por cargo
function filterByCargo(cargo) {
    if (!cargo) {
        renderTable(currentData);
        return;
    }
    
    const cargoColumn = tableColumns.find(col => col.includes('cargo') || col.includes('puesto'));
    if (!cargoColumn) {
        renderTable(currentData);
        return;
    }
    
    const filteredData = currentData.filter(row => {
        return row[cargoColumn] && row[cargoColumn].toLowerCase().includes(cargo.toLowerCase());
    });
    
    renderTable(filteredData);
}

// Filtrar por estado
function filterByEstado(activo = null) {
    if (activo === null) {
        renderTable(currentData);
        return;
    }
    
    const estadoColumn = tableColumns.find(col => col.includes('estado') || col.includes('activo'));
    if (!estadoColumn) {
        renderTable(currentData);
        return;
    }
    
    const filteredData = currentData.filter(row => {
        const estado = row[estadoColumn];
        if (activo) {
            return estado === 'activo' || estado === 1 || estado === true;
        } else {
            return estado === 'inactivo' || estado === 0 || estado === false;
        }
    });
    
    renderTable(filteredData);
}

// Filtrar por id_codigo
function filterByIdCodigo(idCodigo) {
    if (!idCodigo) {
        renderTable(currentData);
        return;
    }
    const filteredData = currentData.filter(row => {
        return row[PRIMARY_KEY] && row[PRIMARY_KEY].toString().includes(idCodigo);
    });
    renderTable(filteredData);
}

// Exportar datos del personal (función adicional)
function exportarPersonal() {
    if (!currentData.length) {
        alert('No hay datos para exportar');
        return;
    }
    
    let csv = tableColumns.join(',') + '\n';
    currentData.forEach(row => {
        const values = tableColumns.map(col => {
            let value = row[col] || '';
            if (typeof value === 'string' && value.includes(',')) {
                value = `"${value}"`;
            }
            return value;
        });
        csv += values.join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'personal.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Filtro global para cualquier columna
function filterByGlobal(searchTerm) {
    if (!searchTerm) {
        renderTable(currentData);
        return;
    }
    const filteredData = currentData.filter(row => {
        return tableColumns.some(col => {
            const value = row[col];
            return value !== null && value !== undefined && value.toString().toLowerCase().includes(searchTerm.toLowerCase());
        });
    });
    renderTable(filteredData);
}