// Table logic simplificado para hist_lectura
const PRIMARY_KEY = 'id_hist';
const TABLE_NAME = 'hist_lectura';
const TABLE_TITLE = '📖 Historial Lectura';

// Variables globales
let tableData = [];
let allData = []; // Guardar todos los datos para filtrado
let columns = [];
let isEditing = false;
let currentEditId = null;

// Función para cargar datos
async function loadData() {
    console.log('🔄 Cargando datos de', TABLE_NAME);
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    
    if (!loadingIndicator || !tableContainer) {
        console.error('❌ Elementos DOM no encontrados');
        return;
    }
    
    try {
        loadingIndicator.style.display = 'block';
        tableContainer.innerHTML = '';
        
        console.log('📡 Consultando Supabase...');
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order(PRIMARY_KEY, { ascending: false })
            .limit(10);
        
        if (error) {
            console.error('❌ Error de Supabase:', error);
            throw error;
        }
        
        console.log('✅ Datos cargados:', data?.length || 0, 'registros');
        tableData = data || [];
        allData = []; // No guardar todos los datos inicialmente
        
        if (tableData.length > 0) {
            columns = Object.keys(tableData[0]);
            // Excluir la clave primaria de la visualización
            columns = columns.filter(col => col !== PRIMARY_KEY);
            generateFilters(); // Generar filtros dinámicamente
            await loadFilterOptions(); // Cargar opciones de filtro desde la BD
        }
        
        renderTable();
        
    } catch (error) {
        console.error('❌ Error al cargar datos:', error);
        tableContainer.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 2rem; color: #dc3545;">
                <h3>❌ Error al cargar los datos</h3>
                <p>${error.message}</p>
                <button onclick="loadData()" class="btn btn-primary" style="margin-top: 1rem;">🔄 Reintentar</button>
            </div>
        `;
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Generar filtros dinámicamente para todas las columnas
function generateFilters() {
    const filterContainer = document.getElementById('filterContainer');
    if (!filterContainer || columns.length === 0) return;
    
    let filtersHTML = '';
    
    columns.forEach(column => {
        const columnId = column.replace(/\s+/g, '-').toLowerCase();
        const columnLabel = column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        filtersHTML += `
            <div class="filter-group">
                <label for="filtro-${columnId}">${columnLabel}:</label>
                <input type="text" id="filtro-${columnId}" placeholder="Buscar..." oninput="debounceApplyFilters()">
            </div>
        `;
    });
    
    filtersHTML += `
        <div class="filter-group">
            <button class="btn btn-secondary btn-sm" onclick="clearFilters()">🗑️ Limpiar Filtros</button>
        </div>
    `;
    
    filterContainer.innerHTML = filtersHTML;
    filterContainer.style.display = 'flex';
    
    // Poblar los filtros con valores únicos
    populateFilters();
}

// Variable para debounce
let filterTimeout = null;

// Aplicar filtros con debounce (esperar a que el usuario termine de escribir)
function debounceApplyFilters() {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
        applyFilters();
    }, 500); // Esperar 500ms después de que el usuario deje de escribir
}

// Poblar los filtros con valores únicos
function populateFilters() {
    // Los filtros se poblarán dinámicamente al escribir
    // No precargamos valores para evitar consultas pesadas
}

// Cargar opciones de filtro desde Supabase
async function loadFilterOptions() {
    // Esta función puede expandirse en el futuro si se necesita precargar valores
    // Por ahora, los filtros funcionan con búsqueda directa en Supabase
}

// Aplicar filtros con consulta a Supabase
async function applyFilters() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    try {
        loadingIndicator.style.display = 'block';
        
        // Construir query de Supabase
        let query = supabase
            .from(TABLE_NAME)
            .select('*')
            .order(PRIMARY_KEY, { ascending: false });
        
        // Aplicar filtros por cada columna
        let hasFilters = false;
        columns.forEach(column => {
            const columnId = column.replace(/\s+/g, '-').toLowerCase();
            const filterInput = document.getElementById(`filtro-${columnId}`);
            
            if (filterInput) {
                const filterValue = filterInput.value.trim();
                
                if (filterValue) {
                    // Usar ilike para búsqueda case-insensitive y con comodines
                    query = query.ilike(column, `%${filterValue}%`);
                    hasFilters = true;
                }
            }
        });
        
        // Limitar resultados
        query = query.limit(1000);
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        tableData = data || [];
        renderTable();
        
        // Mostrar mensaje si hay muchos resultados
        if (tableData.length === 1000 && hasFilters) {
            console.log('⚠️ Se muestran los primeros 1000 resultados. Refina tu búsqueda para ver más específicos.');
        }
        
    } catch (error) {
        console.error('❌ Error al filtrar:', error);
        alert('Error al aplicar filtros: ' + error.message);
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Limpiar filtros
function clearFilters() {
    columns.forEach(column => {
        const columnId = column.replace(/\s+/g, '-').toLowerCase();
        const filterInput = document.getElementById(`filtro-${columnId}`);
        if (filterInput) {
            filterInput.value = '';
        }
    });
    
    // Recargar datos iniciales (solo 10 registros)
    loadData();
}

// Función para renderizar tabla
function renderTable() {
    const tableContainer = document.getElementById('tableContainer');
    
    if (tableData.length === 0) {
        tableContainer.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 3rem;">
                <h3>📭 No hay registros</h3>
                <p>No se encontraron registros en el historial de lectura</p>
                <button onclick="openCreateModal()" class="btn btn-primary">➕ Agregar Registro</button>
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <div class="table-info" style="margin-bottom: 1rem;">
            <span class="record-count">📊 ${tableData.length} registros encontrados</span>
        </div>
        <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
    `;
    
    columns.forEach(col => {
        tableHTML += `<th style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: left; color: #212529; font-weight: bold;">${formatColumnName(col)}</th>`;
    });
    tableHTML += '<th style="padding: 0.75rem; border: 1px solid #dee2e6; color: #212529; font-weight: bold;">Acciones</th></tr></thead><tbody>';
    
    tableData.forEach(row => {
        tableHTML += '<tr>';
        columns.forEach(col => {
            let value = row[col];
            if (value === null || value === undefined) {
                value = '<span style="color: #6c757d;">-</span>';
            }
            tableHTML += `<td style="padding: 0.75rem; border: 1px solid #dee2e6;">${value}</td>`;
        });
        
        tableHTML += `
            <td style="padding: 0.75rem; border: 1px solid #dee2e6;">
                <button onclick="openEditModal(${row[PRIMARY_KEY]})" class="btn-action" style="margin-right: 0.25rem; padding: 0.25rem 0.5rem; background: #007bff; color: white; border: none; border-radius: 0.25rem; cursor: pointer;">✏️</button>
                <button onclick="deleteRecord(${row[PRIMARY_KEY]})" class="btn-action" style="padding: 0.25rem 0.5rem; background: #dc3545; color: white; border: none; border-radius: 0.25rem; cursor: pointer;">🗑️</button>
            </td>
        `;
        tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody></table></div>';
    tableContainer.innerHTML = tableHTML;
}

function formatColumnName(columnName) {
    const nameMap = {
        'id_hist': '🆔 ID',
        'fecha_lectura': '📅 Fecha',
        'hora_lectura': '🕒 Hora',
        'lectura_actual': '📊 Lectura Actual',
        'lectura_anterior': '📊 Lectura Anterior',
        'consumo': '⚡ Consumo',
        'estado': '📋 Estado',
        'observaciones': '📝 Observaciones'
    };
    return nameMap[columnName] || columnName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Modal functions
function openCreateModal() {
    isEditing = false;
    currentEditId = null;
    document.getElementById('modalTitle').textContent = 'Nuevo Registro';
    document.getElementById('recordId').value = '';
    generateForm();
    document.getElementById('dataModal').style.display = 'block';
}

function openEditModal(id) {
    isEditing = true;
    currentEditId = id;
    document.getElementById('modalTitle').textContent = 'Editar Registro';
    document.getElementById('recordId').value = id;
    
    const record = tableData.find(item => item[PRIMARY_KEY] === id);
    if (record) {
        generateForm(record);
        document.getElementById('dataModal').style.display = 'block';
    }
}

function generateForm(data = null) {
    const formFields = document.getElementById('formFields');
    let formHTML = '';
    
    columns.forEach(column => {
        if (column === PRIMARY_KEY && !isEditing) return;
        
        const value = data ? data[column] || '' : '';
        const fieldId = `field_${column}`;
        const label = formatColumnName(column);
        const readonly = column === PRIMARY_KEY && isEditing ? 'readonly' : '';
        
        formHTML += `
            <div class="form-group" style="margin-bottom: 1rem;">
                <label for="${fieldId}" style="display: block; margin-bottom: 0.25rem; font-weight: bold;">${label}:</label>
                <input type="text" id="${fieldId}" name="${column}" value="${value}" class="form-control" style="width: 100%; padding: 0.375rem 0.75rem; border: 1px solid #ced4da; border-radius: 0.25rem;" ${readonly}>
            </div>
        `;
    });
    
    formFields.innerHTML = formHTML;
}

function closeModal() {
    document.getElementById('dataModal').style.display = 'none';
    document.getElementById('dataForm').reset();
}

// Form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    console.log('📝 Enviando formulario...');
    
    const formData = new FormData(e.target);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        if (value !== '') {
            data[key] = value;
        }
    }
    
    try {
        if (isEditing) {
            console.log('🔄 Actualizando registro:', currentEditId);
            const { error } = await supabase
                .from(TABLE_NAME)
                .update(data)
                .eq(PRIMARY_KEY, currentEditId);
            
            if (error) throw error;
        } else {
            console.log('➕ Creando nuevo registro');
            const { error } = await supabase
                .from(TABLE_NAME)
                .insert([data]);
            
            if (error) throw error;
        }
        
        console.log('✅ Operación exitosa');
        closeModal();
        loadData();
        
    } catch (error) {
        console.error('❌ Error al guardar:', error);
        alert('Error: ' + error.message);
    }
}

// Delete record
async function deleteRecord(id) {
    if (!confirm('¿Está seguro de que desea eliminar este registro?')) {
        return;
    }
    
    try {
        console.log('🗑️ Eliminando registro:', id);
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq(PRIMARY_KEY, id);
        
        if (error) throw error;
        
        console.log('✅ Registro eliminado');
        loadData();
        
    } catch (error) {
        console.error('❌ Error al eliminar:', error);
        alert('Error: ' + error.message);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando aplicación...');
    
    // Check if supabase is available
    if (!window.supabase) {
        console.error('❌ Supabase no disponible');
        const tableContainer = document.getElementById('tableContainer');
        if (tableContainer) {
            tableContainer.innerHTML = '<div style="color: red; text-align: center; padding: 2rem;">❌ Error: Supabase no está disponible</div>';
        }
        return;
    }
    
    // Add form submit handler
    const form = document.getElementById('dataForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
        console.log('✅ Event listener agregado al formulario');
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('dataModal');
    if (modal) {
        window.onclick = function(event) {
            if (event.target === modal) {
                closeModal();
            }
        };
    }
    
    // Load initial data
    loadData();
});