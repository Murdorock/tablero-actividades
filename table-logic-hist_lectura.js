// Configuración específica para tabla hist_lectura con clave primaria id_hist
// Verificar que el cliente de Supabase esté disponible
if (!window.supabase) {
    console.error('Supabase no está disponible. Verifique que el script esté cargado.');
}

// Configuración específica de la tabla
const PRIMARY_KEY = 'id_hist';
const TABLE_NAME = 'hist_lectura';
const TABLE_TITLE = '📖 Historial Lectura';

console.log('Configuración cargada:', { PRIMARY_KEY, TABLE_NAME, TABLE_TITLE });

// Variables globales
let tableData = [];
let columns = [];
let isEditing = false;
let currentEditId = null;

// Función para cargar datos
async function loadData() {
    console.log('Función loadData iniciada');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    
    if (!loadingIndicator || !tableContainer) {
        console.error('Elementos DOM no encontrados:', { loadingIndicator, tableContainer });
        return;
    }
    
    try {
        console.log('Mostrando indicador de carga');
        loadingIndicator.style.display = 'block';
        tableContainer.innerHTML = '';
        
        console.log('Realizando consulta de prueba a la tabla:', TABLE_NAME);
        // Verificar si la tabla tiene datos sin usar count()
        const testQuery = await supabase
            .from(TABLE_NAME)
            .select('*')
            .limit(1);
            
        if (testQuery.error) {
            console.error('Error en consulta de prueba:', testQuery.error);
            throw testQuery.error;
        }
        
        console.log('Consulta de prueba exitosa, cargando todos los datos...');
        // Cargar todos los datos
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order(PRIMARY_KEY, { ascending: false });
        
        if (error) {
            console.error('Error al cargar datos:', error);
            throw error;
        }
        
        console.log('Datos cargados exitosamente:', data ? data.length : 0, 'registros');
        tableData = data || [];
        
        if (tableData.length > 0) {
            columns = Object.keys(tableData[0]).filter(col => col !== PRIMARY_KEY);
            columns.unshift(PRIMARY_KEY); // Poner la clave primaria al inicio
            console.log('Columnas detectadas:', columns);
        } else {
            console.log('No hay datos en la tabla');
        }
        
        console.log('Renderizando tabla...');
        renderTable();
        
    } catch (error) {
        console.error('Error al cargar datos:', error);
        tableContainer.innerHTML = `
            <div class="error-message">
                <h3>Error al cargar los datos</h3>
                <p>${error.message}</p>
                <button onclick="loadData()" class="btn btn-primary">🔄 Reintentar</button>
            </div>
        `;
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Función para renderizar la tabla
function renderTable() {
    const tableContainer = document.getElementById('tableContainer');
    
    if (tableData.length === 0) {
        tableContainer.innerHTML = `
            <div class="empty-state">
                <h3>No hay registros de historial de lectura</h3>
                <p>Comienza agregando tu primer registro de historial</p>
                <button onclick="openCreateModal()" class="btn btn-primary">➕ Agregar Registro</button>
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <div class="table-info">
            <span class="record-count">📊 ${tableData.length} registros encontrados</span>
        </div>
        <table class="data-table">
            <thead>
                <tr>
                    ${columns.map(col => `<th>${formatColumnName(col)}</th>`).join('')}
                    <th class="actions-column">Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    tableData.forEach(row => {
        tableHTML += '<tr>';
        columns.forEach(col => {
            let cellValue = row[col];
            
            // Formateo específico para historial de lectura
            if (col.includes('fecha') && cellValue) {
                cellValue = formatDate(cellValue);
            } else if (col.includes('hora') && cellValue) {
                cellValue = formatTime(cellValue);
            } else if (col.includes('lectura') && cellValue && !isNaN(cellValue)) {
                cellValue = formatReading(cellValue);
            } else if (col.includes('estado')) {
                cellValue = formatStatus(cellValue);
            } else if (cellValue === null || cellValue === undefined) {
                cellValue = '<span class="null-value">-</span>';
            }
            
            tableHTML += `<td>${cellValue}</td>`;
        });
        
        tableHTML += `
            <td class="actions-cell">
                <button onclick="openEditModal(${row[PRIMARY_KEY]})" class="btn-action edit" title="Editar">
                    ✏️
                </button>
                <button onclick="viewRecord(${row[PRIMARY_KEY]})" class="btn-action view" title="Ver detalles">
                    👁️
                </button>
                <button onclick="deleteRecord(${row[PRIMARY_KEY]})" class="btn-action delete" title="Eliminar">
                    🗑️
                </button>
            </td>
        `;
        tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody></table>';
    tableContainer.innerHTML = tableHTML;
}

// Funciones de formateo específicas para historial de lectura
function formatDate(dateString) {
    if (!dateString) return '-';
    
    // Extraer la parte YYYY-MM-DD para evitar problemas de zona horaria
    let dateOnly = dateString;
    if (typeof dateString === 'string') {
        const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
            dateOnly = match[0]; // Solo YYYY-MM-DD
        }
    }
    
    // Crear fecha desde los componentes para evitar interpretación como UTC
    const parts = dateOnly.split('-');
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function formatTime(timeString) {
    if (!timeString) return '-';
    if (timeString.length <= 8) {
        return `<span class="time-value">${timeString}</span>`;
    }
    return timeString;
}

function formatReading(value) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;
    return `<span class="reading-value">${numValue.toLocaleString('es-ES')} kWh</span>`;
}

function formatStatus(status) {
    if (!status) return '-';
    const statusMap = {
        'leido': '✅ Leído',
        'pendiente': '⏳ Pendiente',
        'error': '❌ Error',
        'verificado': '✔️ Verificado',
        'anomalia': '⚠️ Anomalía'
    };
    return statusMap[status.toLowerCase()] || status;
}

function formatColumnName(columnName) {
    const nameMap = {
        'id_hist': '🆔 ID Historial',
        'fecha_lectura': '📅 Fecha Lectura',
        'hora_lectura': '🕒 Hora',
        'lectura_actual': '📊 Lectura Actual',
        'lectura_anterior': '📊 Lectura Anterior',
        'consumo': '⚡ Consumo',
        'estado': '📋 Estado',
        'observaciones': '📝 Observaciones',
        'codigo_medidor': '🔢 Código Medidor',
        'numero_cuenta': '🏠 N° Cuenta'
    };
    return nameMap[columnName] || columnName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Función para abrir modal de creación
function openCreateModal() {
    isEditing = false;
    currentEditId = null;
    document.getElementById('modalTitle').textContent = 'Nuevo Registro de Historial';
    document.getElementById('recordId').value = '';
    generateForm();
    document.getElementById('dataModal').style.display = 'block';
}

// Función para abrir modal de edición
function openEditModal(id) {
    isEditing = true;
    currentEditId = id;
    document.getElementById('modalTitle').textContent = 'Editar Registro de Historial';
    document.getElementById('recordId').value = id;
    
    const record = tableData.find(item => item[PRIMARY_KEY] === id);
    if (record) {
        generateForm(record);
        document.getElementById('dataModal').style.display = 'block';
    }
}

// Función para generar el formulario dinámicamente
function generateForm(data = null) {
    const formFields = document.getElementById('formFields');
    let formHTML = '';
    
    columns.forEach(column => {
        if (column === PRIMARY_KEY && !isEditing) return;
        
        const value = data ? data[column] || '' : '';
        const fieldId = `field_${column}`;
        const label = formatColumnName(column);
        
        if (column.includes('fecha')) {
            formHTML += `
                <div class="form-group">
                    <label for="${fieldId}">${label}:</label>
                    <input type="date" id="${fieldId}" name="${column}" value="${value}" class="form-control">
                </div>
            `;
        } else if (column.includes('hora')) {
            formHTML += `
                <div class="form-group">
                    <label for="${fieldId}">${label}:</label>
                    <input type="time" id="${fieldId}" name="${column}" value="${value}" class="form-control">
                </div>
            `;
        } else if (column.includes('estado')) {
            formHTML += `
                <div class="form-group">
                    <label for="${fieldId}">${label}:</label>
                    <select id="${fieldId}" name="${column}" class="form-control">
                        <option value="">Seleccionar estado...</option>
                        <option value="leido" ${value === 'leido' ? 'selected' : ''}>✅ Leído</option>
                        <option value="pendiente" ${value === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                        <option value="error" ${value === 'error' ? 'selected' : ''}>❌ Error</option>
                        <option value="verificado" ${value === 'verificado' ? 'selected' : ''}>✔️ Verificado</option>
                        <option value="anomalia" ${value === 'anomalia' ? 'selected' : ''}>⚠️ Anomalía</option>
                    </select>
                </div>
            `;
        } else if (column.includes('observaciones')) {
            formHTML += `
                <div class="form-group">
                    <label for="${fieldId}">${label}:</label>
                    <textarea id="${fieldId}" name="${column}" class="form-control" rows="3" placeholder="Ingrese observaciones...">${value}</textarea>
                </div>
            `;
        } else if (column.includes('lectura') || column.includes('consumo')) {
            formHTML += `
                <div class="form-group">
                    <label for="${fieldId}">${label}:</label>
                    <input type="number" id="${fieldId}" name="${column}" value="${value}" class="form-control" step="0.01" placeholder="0.00">
                </div>
            `;
        } else {
            const inputType = column === PRIMARY_KEY ? 'number' : 'text';
            const readonly = column === PRIMARY_KEY && isEditing ? 'readonly' : '';
            formHTML += `
                <div class="form-group">
                    <label for="${fieldId}">${label}:</label>
                    <input type="${inputType}" id="${fieldId}" name="${column}" value="${value}" class="form-control" ${readonly}>
                </div>
            `;
        }
    });
    
    formFields.innerHTML = formHTML;
}

// Función para ver detalles del registro
function viewRecord(id) {
    const record = tableData.find(item => item[PRIMARY_KEY] === id);
    if (!record) return;
    
    let detailsHTML = `
        <div class="record-details">
            <h3>📖 Detalles del Historial de Lectura</h3>
            <div class="details-grid">
    `;
    
    // Información principal
    detailsHTML += `
        <div class="detail-section">
            <h4>📊 Información de Lectura</h4>
            <div class="detail-item"><strong>ID Historial:</strong> ${record[PRIMARY_KEY]}</div>
            <div class="detail-item"><strong>Fecha:</strong> ${formatDate(record.fecha_lectura)}</div>
            <div class="detail-item"><strong>Hora:</strong> ${formatTime(record.hora_lectura)}</div>
            <div class="detail-item"><strong>Estado:</strong> ${formatStatus(record.estado)}</div>
        </div>
    `;
    
    // Información de medición
    if (record.lectura_actual || record.lectura_anterior || record.consumo) {
        detailsHTML += `
            <div class="detail-section">
                <h4>⚡ Información de Medición</h4>
                ${record.lectura_actual ? `<div class="detail-item"><strong>Lectura Actual:</strong> ${formatReading(record.lectura_actual)}</div>` : ''}
                ${record.lectura_anterior ? `<div class="detail-item"><strong>Lectura Anterior:</strong> ${formatReading(record.lectura_anterior)}</div>` : ''}
                ${record.consumo ? `<div class="detail-item"><strong>Consumo:</strong> ${formatReading(record.consumo)}</div>` : ''}
            </div>
        `;
    }
    
    // Información del medidor
    if (record.codigo_medidor || record.numero_cuenta) {
        detailsHTML += `
            <div class="detail-section">
                <h4>🔢 Información del Medidor</h4>
                ${record.codigo_medidor ? `<div class="detail-item"><strong>Código Medidor:</strong> ${record.codigo_medidor}</div>` : ''}
                ${record.numero_cuenta ? `<div class="detail-item"><strong>Número de Cuenta:</strong> ${record.numero_cuenta}</div>` : ''}
            </div>
        `;
    }
    
    // Observaciones
    if (record.observaciones) {
        detailsHTML += `
            <div class="detail-section full-width">
                <h4>📝 Observaciones</h4>
                <div class="detail-item observations">${record.observaciones}</div>
            </div>
        `;
    }
    
    detailsHTML += `
            </div>
            <div class="detail-actions">
                <button onclick="openEditModal(${id})" class="btn btn-primary">✏️ Editar</button>
                <button onclick="closeDetailsModal()" class="btn btn-secondary">Cerrar</button>
            </div>
        </div>
    `;
    
    // Crear modal de detalles
    const detailsModal = document.createElement('div');
    detailsModal.id = 'detailsModal';
    detailsModal.className = 'modal';
    detailsModal.innerHTML = `<div class="modal-content large">${detailsHTML}</div>`;
    
    document.body.appendChild(detailsModal);
    detailsModal.style.display = 'block';
}

function closeDetailsModal() {
    const detailsModal = document.getElementById('detailsModal');
    if (detailsModal) {
        document.body.removeChild(detailsModal);
    }
}

// Función para cerrar modal
function closeModal() {
    document.getElementById('dataModal').style.display = 'none';
    document.getElementById('dataForm').reset();
}

// Función para inicializar la aplicación
function initializeApp() {
    console.log('Inicializando aplicación...');
    const form = document.getElementById('dataForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
        console.log('Event listener del formulario agregado');
    } else {
        console.log('Formulario no encontrado');
    }
    
    console.log('Cargando datos...');
    loadData();
}

// Función para manejar el envío del formulario
document.addEventListener('DOMContentLoaded', initializeApp);

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        if (value !== '') {
            data[key] = value;
        }
    }
    
    try {
        let result;
        
        if (isEditing) {
            const { error } = await supabase
                .from(TABLE_NAME)
                .update(data)
                .eq(PRIMARY_KEY, currentEditId);
            
            if (error) throw error;
            
        } else {
            const { error } = await supabase
                .from(TABLE_NAME)
                .insert([data]);
            
            if (error) throw error;
        }
        
        closeModal();
        loadData();
        
        // Mostrar mensaje de éxito
        showNotification(isEditing ? 'Registro actualizado correctamente' : 'Registro creado correctamente', 'success');
        
    } catch (error) {
        console.error('Error al guardar:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

// Función para eliminar registro
async function deleteRecord(id) {
    if (!confirm('¿Está seguro de que desea eliminar este registro de historial?')) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq(PRIMARY_KEY, id);
        
        if (error) throw error;
        
        loadData();
        showNotification('Registro eliminado correctamente', 'success');
        
    } catch (error) {
        console.error('Error al eliminar:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

// Función para mostrar notificaciones
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Cerrar modal al hacer clic fuera
window.onclick = function(event) {
    const modal = document.getElementById('dataModal');
    const detailsModal = document.getElementById('detailsModal');
    
    if (event.target === modal) {
        closeModal();
    } else if (event.target === detailsModal) {
        closeDetailsModal();
    }
};

// Manejar tecla Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('dataModal');
        const detailsModal = document.getElementById('detailsModal');
        
        if (modal && modal.style.display === 'block') {
            closeModal();
        } else if (detailsModal && detailsModal.style.display === 'block') {
            closeDetailsModal();
        }
    }
});