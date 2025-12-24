// Configuración específica para tabla CMLEC
const TABLE_NAME = 'cmlec';
const PRIMARY_KEY = 'id_llave';

let currentData = [];
let tableColumns = [];
let allData = []; // Guardar todos los datos para filtrado

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
            .order(PRIMARY_KEY, { ascending: false })
            .limit(500);
        
        if (error) throw error;
        
        currentData = data || [];
        allData = data || []; // Guardar copia de todos los datos
        
        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]);
            populateFilters(); // Poblar los filtros
            renderTable(currentData);
        } else {
            tableContainer.innerHTML = '<div class="no-data">No hay registros para mostrar</div>';
        }
    } catch (error) {
        console.error('Error cargando datos:', error);
        tableContainer.innerHTML = '<div class="error">Error cargando datos: ' + error.message + '</div>';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Poblar los filtros con valores únicos
function populateFilters() {
    // Filtro de Correría MP
    const correriaMpList = document.getElementById('correria-mp-list');
    const correriaMpValues = [...new Set(allData.map(row => row.correria_mp).filter(val => val !== null && val !== undefined && val !== ''))];
    correriaMpList.innerHTML = '';
    correriaMpValues.sort().forEach(value => {
        correriaMpList.innerHTML += `<option value="${value}">`;
    });
    
    // Filtro de Terminal
    const terminalList = document.getElementById('terminal-list');
    const terminalValues = [...new Set(allData.map(row => row.terminal).filter(val => val !== null && val !== undefined && val !== ''))];
    terminalList.innerHTML = '';
    terminalValues.sort().forEach(value => {
        terminalList.innerHTML += `<option value="${value}">`;
    });
}

// Aplicar filtros
function applyFilters() {
    const correriaMpFilter = document.getElementById('filtro-correria-mp').value.trim().toLowerCase();
    const terminalFilter = document.getElementById('filtro-terminal').value.trim().toLowerCase();
    
    let filteredData = allData;
    
    // Filtrar por Correría MP (búsqueda parcial)
    if (correriaMpFilter) {
        filteredData = filteredData.filter(row => {
            const value = row.correria_mp;
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(correriaMpFilter);
        });
    }
    
    // Filtrar por Terminal (búsqueda parcial)
    if (terminalFilter) {
        filteredData = filteredData.filter(row => {
            const value = row.terminal;
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(terminalFilter);
        });
    }
    
    currentData = filteredData;
    renderTable(currentData);
}

// Limpiar filtros
function clearFilters() {
    document.getElementById('filtro-correria-mp').value = '';
    document.getElementById('filtro-terminal').value = '';
    currentData = allData;
    renderTable(currentData);
}

// Renderizar tabla
function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    
    if (!data || data.length === 0) {
        tableContainer.innerHTML = '<div class="no-data">No hay registros para mostrar</div>';
        return;
    }
    
    let html = '<table class="data-table"><thead><tr>';
    
    // Headers de la tabla (ocultar id_llave)
    tableColumns.forEach(column => {
        if (column === 'id_llave') return; // Saltar la columna id_llave
        const displayName = column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        html += `<th>${displayName}</th>`;
    });
    html += '<th>Acciones</th></tr></thead><tbody>';
    
    // Filas de datos
    data.forEach(row => {
        const rowId = row[PRIMARY_KEY] || row[tableColumns[0]];
        html += '<tr>';
        
        tableColumns.forEach(column => {
            if (column === 'id_llave') return; // Saltar la columna id_llave
            let value = row[column];
            
            // Formatear valores especiales
            if (value === null || value === undefined) {
                value = '';
            } else if (typeof value === 'string' && value.length > 50) {
                value = value.substring(0, 50) + '...';
            }
            
            html += `<td>${value}</td>`;
        });
        
        // Columna de acciones
        html += `<td class="actions">
            <button class="btn btn-sm btn-primary" onclick="openEditModal('${rowId}')" title="Editar">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteRecord('${rowId}')" title="Eliminar">🗑️</button>
        </td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    tableContainer.innerHTML = html;
}

// Abrir modal para crear nuevo registro
function openCreateModal() {
    document.getElementById('modalTitle').textContent = 'Nuevo Registro CMLEC';
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
        
        document.getElementById('modalTitle').textContent = 'Editar Registro CMLEC';
        document.getElementById('recordId').value = data[PRIMARY_KEY] || data[tableColumns[0]];
        
        generateFormFields(data);
        document.getElementById('dataModal').style.display = 'flex';
    } catch (error) {
        console.error('Error cargando registro:', error);
        alert('Error cargando registro: ' + error.message);
    }
}

// Eliminar registro
async function deleteRecord(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este registro?')) {
        return;
    }
    
    try {
        const { error } = await supabase.from(TABLE_NAME).delete().eq(PRIMARY_KEY, id);
        
        if (error) throw error;
        
        alert('Registro eliminado exitosamente');
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
        // Saltar la clave primaria si es auto-incrementable
        if (column === PRIMARY_KEY && !data[column]) {
            return;
        }
        
        const displayName = column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const value = data[column] || '';
        
        const fieldHtml = `
            <div class="form-group">
                <label for="${column}">${displayName}:</label>
                <input type="text" id="${column}" name="${column}" value="${value}" class="form-control">
            </div>
        `;
        
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
                data[key] = value || null;
            }
            
            const id = document.getElementById('recordId').value;
            
            try {
                if (id) {
                    // Actualizar registro existente
                    const { error } = await supabase.from(TABLE_NAME).update(data).eq(PRIMARY_KEY, id);
                    if (error) throw error;
                    alert('Registro actualizado exitosamente');
                } else {
                    // Crear nuevo registro
                    const { error } = await supabase.from(TABLE_NAME).insert([data]);
                    if (error) throw error;
                    alert('Registro creado exitosamente');
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

// Función de búsqueda (opcional)
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