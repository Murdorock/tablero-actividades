// Modal de pendientes
function openPendientesModal() {
    // Filtrar filas con pendientes > 0
    const pendientesRows = allData.filter(row => Number(row.pendientes) > 0);
    const modal = document.getElementById('modalPendientes');
    const body = document.getElementById('modalPendientesBody');
    if (!modal || !body) return;
    if (pendientesRows.length === 0) {
        body.innerHTML = '<div style="padding:2rem; text-align:center; color:#888;">No hay registros con pendientes mayores a cero.</div>';
    } else {
        // Estilo similar a la imagen adjunta: columnas más anchas, fuente clara, bordes y colores destacados
        let html = `<style>
        .compact-table {
            border-collapse: collapse;
            width: auto;
            margin: 0 auto;
            font-size: 15px;
            background: #fff;
        }
        .compact-table th, .compact-table td {
            border: 2px solid #4b5c5e;
            padding: 4px 10px;
            text-align: center;
            min-width: 40px;
            max-width: 120px;
            word-break: break-word;
            white-space: normal;
        }
        .compact-table th {
            background: #4b5c5e;
            color: #fff;
            font-weight: bold;
        }
        .compact-table tr:nth-child(even) {
            background: #f4f8fa;
        }
        .compact-table tr:last-child {
            background: #e6f0f3;
            font-weight: bold;
        }
        .compact-table td {
            color: #222;
        }
        .compact-table td[data-color="red"] { color: #d32f2f; font-weight: bold; }
        .compact-table td[data-color="green"] { color: #388e3c; font-weight: bold; }
        </style>`;
        html += '<table class="compact-table"><thead><tr>';
        const visibleColumns = tableColumns.filter(col => col !== 'por_legalizar');
        visibleColumns.forEach(col => {
            html += `<th>${col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</th>`;
        });
        html += '</tr></thead><tbody>';
        pendientesRows.forEach(row => {
            html += '<tr>';
            visibleColumns.forEach(col => {
                let value = row[col];
                if (value === null || value === undefined) value = '';
                // Colorear valores numéricos relevantes como en la imagen
                let colorAttr = '';
                if (["pendientes", "pend_registrar", "desc_pendientes"].includes(col.toLowerCase()) && Number(value) > 0) {
                    colorAttr = ' data-color="red"';
                } else if (["registrados", "desc_confirmadas", "%_descargado", "%_registrado"].some(k => col.toLowerCase().includes(k)) && Number(value) > 0) {
                    colorAttr = ' data-color="green"';
                }
                html += `<td${colorAttr}>${value}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        body.innerHTML = html;
    }
    modal.style.display = 'flex';
}

function closePendientesModal() {
    const modal = document.getElementById('modalPendientes');
    if (modal) modal.style.display = 'none';
}
// Configuración específica para tabla Control Descargas
const TABLE_NAME = 'control_descargas';
const PRIMARY_KEY = 'id_correria';

let currentData = [];
let tableColumns = [];
let allData = []; // Guardar todos los datos para filtrado

// Obtener hora del primer registro de cmlec
async function obtenerHoraPrimerRegistro() {
    try {
        const { data, error } = await supabase
            .from('cmlec')
            .select('updated_at')
            .order('updated_at', { ascending: true })
            .limit(1);
        
        if (error) throw error;
        
        if (data && data.length > 0 && data[0].updated_at) {
            // Convertir a hora local
            const fecha = new Date(data[0].updated_at);
            const horaLocal = fecha.toLocaleTimeString('es-CO', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit',
                hour12: false 
            });
            
            document.getElementById('hora-primer-registro').textContent = horaLocal;
        } else {
            document.getElementById('hora-primer-registro').textContent = 'Sin datos';
        }
    } catch (error) {
        console.error('Error obteniendo hora primer registro:', error);
        document.getElementById('hora-primer-registro').textContent = 'Error al cargar';
    }
}

// Cargar datos iniciales
async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    
    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';
    
    // Obtener hora del primer registro de cmlec
    obtenerHoraPrimerRegistro();
    
    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order(PRIMARY_KEY, { ascending: false })
            .limit(500);
        
        if (error) throw error;
        
        allData = data || []; // Guardar copia de todos los datos
        currentData = allData;
        
        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]);
            populateFilters(); // Poblar los filtros
            // Ordenar los datos antes de renderizar
            currentData = sortData(currentData);
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
    // Filtro ID Correría
    const idCorreriaList = document.getElementById('id-correria-list');
    const idCorreriaValues = [...new Set(allData.map(row => row.id_correria).filter(val => val !== null && val !== undefined && val !== ''))];
    idCorreriaList.innerHTML = '';
    idCorreriaValues.sort().forEach(value => {
        idCorreriaList.innerHTML += `<option value="${value}">`;
    });
    
    // Filtro Código
    const codigoList = document.getElementById('codigo-list');
    const codigoValues = [...new Set(allData.map(row => row.codigo).filter(val => val !== null && val !== undefined && val !== ''))];
    codigoList.innerHTML = '';
    codigoValues.sort().forEach(value => {
        codigoList.innerHTML += `<option value="${value}">`;
    });
    
    // Filtro Supervisor
    const supervisorList = document.getElementById('supervisor-list');
    const supervisorValues = [...new Set(allData.map(row => row.supervisor).filter(val => val !== null && val !== undefined && val !== ''))];
    supervisorList.innerHTML = '';
    supervisorValues.sort().forEach(value => {
        supervisorList.innerHTML += `<option value="${value}">`;
    });
}

// Aplicar filtros
function applyFilters() {
    const idCorreriaFilter = document.getElementById('filtro-id-correria').value.trim().toLowerCase();
    const codigoFilter = document.getElementById('filtro-codigo').value.trim().toLowerCase();
    const supervisorFilter = document.getElementById('filtro-supervisor').value.trim().toLowerCase();
    
    let filteredData = allData;
    
    // Filtrar por ID Correría
    if (idCorreriaFilter) {
        filteredData = filteredData.filter(row => {
            const value = row.id_correria;
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(idCorreriaFilter);
        });
    }
    
    // Filtrar por Código
    if (codigoFilter) {
        filteredData = filteredData.filter(row => {
            const value = row.codigo;
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(codigoFilter);
        });
    }
    
    // Filtrar por Supervisor
    if (supervisorFilter) {
        filteredData = filteredData.filter(row => {
            const value = row.supervisor;
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(supervisorFilter);
        });
    }
    
    currentData = sortData(filteredData);
    renderTable(currentData);
}

// Limpiar filtros
function clearFilters() {
    document.getElementById('filtro-id-correria').value = '';
    document.getElementById('filtro-codigo').value = '';
    document.getElementById('filtro-supervisor').value = '';
    currentData = sortData(allData);
    renderTable(currentData);
}

// Función para ordenar datos
function sortData(data) {
    // Separar registros con pendientes = 0 de los demás
    const conPendientes = data.filter(row => {
        const pendientes = Number(row.pendientes) || 0;
        return pendientes > 0;
    });
    
    const sinPendientes = data.filter(row => {
        const pendientes = Number(row.pendientes) || 0;
        return pendientes === 0;
    });
    
    // Ordenar registros con pendientes > 0
    conPendientes.sort((a, b) => {
        // 1. Ordenar por supervisor (A-Z, menor a mayor)
        const supervisorA = (a.supervisor || '').toString().toLowerCase();
        const supervisorB = (b.supervisor || '').toString().toLowerCase();
        
        if (supervisorA < supervisorB) return -1;
        if (supervisorA > supervisorB) return 1;
        
        // 2. Si los supervisores son iguales, ordenar por pendientes de mayor a menor
        const pendientesA = Number(a.pendientes) || 0;
        const pendientesB = Number(b.pendientes) || 0;
        
        return pendientesB - pendientesA;
    });
    
    // Ordenar registros con pendientes = 0 (solo por supervisor)
    sinPendientes.sort((a, b) => {
        const supervisorA = (a.supervisor || '').toString().toLowerCase();
        const supervisorB = (b.supervisor || '').toString().toLowerCase();
        
        if (supervisorA < supervisorB) return -1;
        if (supervisorA > supervisorB) return 1;
        return 0;
    });
    
    // Concatenar: primero los que tienen pendientes, luego los que tienen 0
    return [...conPendientes, ...sinPendientes];
}

// Renderizar tabla
function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    
    if (!data || data.length === 0) {
        tableContainer.innerHTML = '<div class="no-data">No hay registros para mostrar</div>';
        return;
    }
    
    let html = '<table class="data-table"><thead><tr>';
    
    // Headers de la tabla
    tableColumns.forEach(column => {
        // Ocultar columna por_legalizar
        if (column === 'por_legalizar') return;
        
        const displayName = column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        html += `<th>${displayName}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Filas de datos
    data.forEach(row => {
        const rowId = row[PRIMARY_KEY] || row[tableColumns[0]];
        html += '<tr>';
        
        tableColumns.forEach(column => {
            // Ocultar columna por_legalizar
            if (column === 'por_legalizar') return;
            
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
            }
            
            html += `<td>${value}</td>`;
        });
        
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    tableContainer.innerHTML = html;
}

// Abrir modal para crear nuevo registro
function openCreateModal() {
    document.getElementById('modalTitle').textContent = 'Nuevo Control de Descarga';
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
        
        document.getElementById('modalTitle').textContent = 'Editar Control de Descarga';
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
    if (!confirm('¿Estás seguro de que quieres eliminar este control de descarga?')) {
        return;
    }
    
    try {
        const { error } = await supabase.from(TABLE_NAME).delete().eq(PRIMARY_KEY, id);
        
        if (error) throw error;
        
        alert('Control de descarga eliminado exitosamente');
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
        } else if (column.includes('hora') || column.includes('time')) {
            inputType = 'time';
        } else if (column.includes('email') || column.includes('correo')) {
            inputType = 'email';
        } else if (column.includes('telefono') || column.includes('phone')) {
            inputType = 'tel';
        } else if (column.includes('url') || column.includes('link')) {
            inputType = 'url';
        }
        
        const fieldHtml = `
            <div class="form-group">
                <label for="${column}">${displayName}:</label>
                <input type="${inputType}" id="${column}" name="${column}" value="${value}" class="form-control">
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
                    alert('Control de descarga actualizado exitosamente');
                } else {
                    // Crear nuevo registro
                    const { error } = await supabase.from(TABLE_NAME).insert([data]);
                    if (error) throw error;
                    alert('Control de descarga creado exitosamente');
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

// Función para filtrar por correría específica
function filterByCorreria(correria) {
    if (!correria) {
        renderTable(currentData);
        return;
    }
    
    const filteredData = currentData.filter(row => {
        return row[PRIMARY_KEY] && row[PRIMARY_KEY].toString().includes(correria);
    });
    
    renderTable(filteredData);
}