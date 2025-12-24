// Configuración específica para tabla Llegadas Tarde
const TABLE_NAME = 'llegadas_tarde';
const PRIMARY_KEY = 'id_tarde';

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
            .order('fecha', { ascending: false })
            .limit(500);
        
        if (error) throw error;
        
        currentData = data || [];
        
        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]);
            renderTable(currentData);
        } else {
            tableContainer.innerHTML = '<div class="no-data">No hay registros de llegadas tarde para mostrar</div>';
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
    
    if (!data || data.length === 0) {
        tableContainer.innerHTML = '<div class="no-data">No hay registros de llegadas tarde para mostrar</div>';
        return;
    }
    
    let html = '<table class="data-table"><thead><tr>';
    
    // Headers de la tabla
    tableColumns.forEach(column => {
        // Ocultar columna id_tarde
        if (column === PRIMARY_KEY) return;
        
        const displayName = column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        html += `<th>${displayName}</th>`;
    });
    html += '<th>Acciones</th></tr></thead><tbody>';
    
    // Filas de datos
    data.forEach(row => {
        const rowId = row[PRIMARY_KEY] || row[tableColumns[0]];
        html += '<tr>';
        
        tableColumns.forEach(column => {
            // Ocultar columna id_tarde
            if (column === PRIMARY_KEY) return;
            
            let value = row[column];
            let isPdfColumn = false;
            
            // Formatear valores especiales
            if (value === null || value === undefined) {
                value = '';
            } else if (column.toLowerCase().includes('pdf') && value) {
                // Hacer que la columna PDF sea clickeable
                value = `<a href="${value}" target="_blank" style="color: #1976d2; text-decoration: underline;">📄 Ver PDF</a>`;
                isPdfColumn = true;
            } else if (column.includes('fecha') || column.includes('date')) {
                // Formatear fechas
                if (value) {
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) {
                        value = date.toLocaleDateString('es-ES');
                    }
                }
            } else if (column.includes('hora') || column.includes('time')) {
                // Formatear horas
                if (value) {
                    const time = new Date('2000-01-01T' + value);
                    if (!isNaN(time.getTime())) {
                        value = time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    }
                }
            } else if (column.includes('minutos') && typeof value === 'number') {
                // Formatear minutos de retraso
                value = `${value} min`;
            } else if (typeof value === 'string' && value.length > 50 && !isPdfColumn) {
                value = value.substring(0, 50) + '...';
            }
            
            // Resaltar llegadas muy tardías (más de 30 minutos)
            if (column.includes('minutos') && typeof row[column] === 'number' && row[column] > 30) {
                html += `<td style="background-color: #ffe6e6; color: #d32f2f; font-weight: bold;">${value}</td>`;
            } else {
                html += `<td>${value}</td>`;
            }
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
    document.getElementById('modalTitle').textContent = 'Nuevo Registro de Llegada Tarde';
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
        
        document.getElementById('modalTitle').textContent = 'Editar Registro de Llegada Tarde';
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
    if (!confirm('¿Estás seguro de que quieres eliminar este registro de llegada tarde?')) {
        return;
    }
    
    try {
        const { error } = await supabase.from(TABLE_NAME).delete().eq(PRIMARY_KEY, id);
        
        if (error) throw error;
        
        alert('Registro de llegada tarde eliminado exitosamente');
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
        } else if (column.includes('minutos') || column.includes('retraso')) {
            inputType = 'number';
        } else if (column.includes('email') || column.includes('correo')) {
            inputType = 'email';
        } else if (column.includes('telefono') || column.includes('phone')) {
            inputType = 'tel';
        }
        
        let fieldHtml = '';
        
        // Campo especial para motivo de llegada tarde
        if (column.includes('motivo') || column.includes('razon')) {
            fieldHtml = `
                <div class="form-group">
                    <label for="${column}">${displayName}:</label>
                    <select id="${column}" name="${column}" class="form-control">
                        <option value="">Seleccionar motivo</option>
                        <option value="Tráfico" ${value === 'Tráfico' ? 'selected' : ''}>Tráfico</option>
                        <option value="Transporte público" ${value === 'Transporte público' ? 'selected' : ''}>Transporte público</option>
                        <option value="Personal" ${value === 'Personal' ? 'selected' : ''}>Personal</option>
                        <option value="Salud" ${value === 'Salud' ? 'selected' : ''}>Salud</option>
                        <option value="Emergencia familiar" ${value === 'Emergencia familiar' ? 'selected' : ''}>Emergencia familiar</option>
                        <option value="Clima" ${value === 'Clima' ? 'selected' : ''}>Clima</option>
                        <option value="Otro" ${value === 'Otro' ? 'selected' : ''}>Otro</option>
                    </select>
                </div>
            `;
        } else {
            fieldHtml = `
                <div class="form-group">
                    <label for="${column}">${displayName}:</label>
                    <input type="${inputType}" id="${column}" name="${column}" value="${value}" class="form-control"
                           ${column.includes('minutos') ? 'min="0" max="480"' : ''}>
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
                if (key.includes('minutos') || key.includes('retraso')) {
                    data[key] = value ? parseInt(value) : null;
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
                    alert('Registro de llegada tarde actualizado exitosamente');
                } else {
                    // Crear nuevo registro
                    const { error } = await supabase.from(TABLE_NAME).insert([data]);
                    if (error) throw error;
                    alert('Registro de llegada tarde creado exitosamente');
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

// Filtrar por rango de minutos de retraso
function filterByRetraso(minMinutos = 0, maxMinutos = 999) {
    const filteredData = currentData.filter(row => {
        const retrasoColumn = tableColumns.find(col => col.includes('minutos') || col.includes('retraso'));
        if (!retrasoColumn || !row[retrasoColumn]) return false;
        
        const minutos = parseInt(row[retrasoColumn]);
        return minutos >= minMinutos && minutos <= maxMinutos;
    });
    
    renderTable(filteredData);
}

// Filtrar por fecha específica
function filterByFecha(fecha) {
    if (!fecha) {
        renderTable(currentData);
        return;
    }
    
    const filteredData = currentData.filter(row => {
        const fechaColumn = tableColumns.find(col => col.includes('fecha') || col.includes('date'));
        if (!fechaColumn || !row[fechaColumn]) return false;
        
        const rowDate = new Date(row[fechaColumn]).toISOString().split('T')[0];
        return rowDate === fecha;
    });
    
    renderTable(filteredData);
}

// Obtener estadísticas de llegadas tarde
function getEstadisticas() {
    if (!currentData.length) return null;
    
    const retrasoColumn = tableColumns.find(col => col.includes('minutos') || col.includes('retraso'));
    if (!retrasoColumn) return null;
    
    const retrasos = currentData.map(row => parseInt(row[retrasoColumn]) || 0);
    const totalRegistros = retrasos.length;
    const promedioRetraso = retrasos.reduce((a, b) => a + b, 0) / totalRegistros;
    const maxRetraso = Math.max(...retrasos);
    const llegadasMuyTarde = retrasos.filter(r => r > 30).length;
    
    return {
        totalRegistros,
        promedioRetraso: Math.round(promedioRetraso),
        maxRetraso,
        llegadasMuyTarde,
        porcentajeMuyTarde: Math.round((llegadasMuyTarde / totalRegistros) * 100)
    };
}

// Filtrar por rango de fechas
function filterByDateRange() {
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    
    if (!fechaInicio && !fechaFin) {
        renderTable(currentData);
        return;
    }
    
    const fechaColumn = tableColumns.find(col => col.includes('fecha') || col.includes('date'));
    if (!fechaColumn) {
        alert('No se encontró una columna de fecha');
        return;
    }
    
    const filteredData = currentData.filter(row => {
        if (!row[fechaColumn]) return false;
        
        const rowDate = new Date(row[fechaColumn]).toISOString().split('T')[0];
        
        if (fechaInicio && fechaFin) {
            return rowDate >= fechaInicio && rowDate <= fechaFin;
        } else if (fechaInicio) {
            return rowDate >= fechaInicio;
        } else if (fechaFin) {
            return rowDate <= fechaFin;
        }
        
        return true;
    });
    
    renderTable(filteredData);
}

// Limpiar filtro de fechas
function clearDateFilter() {
    document.getElementById('fechaInicio').value = '';
    document.getElementById('fechaFin').value = '';
    renderTable(currentData);
}

// Abrir modal de exportación
function openExportModal() {
    document.getElementById('exportModal').style.display = 'flex';
}

// Cerrar modal de exportación
function closeExportModal() {
    document.getElementById('exportModal').style.display = 'none';
}

// Exportar a Excel
function exportToExcel() {
    const fechaInicio = document.getElementById('exportFechaInicio').value;
    const fechaFin = document.getElementById('exportFechaFin').value;
    
    let dataToExport = currentData;
    
    // Filtrar por rango de fechas si se especificó
    if (fechaInicio || fechaFin) {
        const fechaColumn = tableColumns.find(col => col.includes('fecha') || col.includes('date'));
        
        if (fechaColumn) {
            dataToExport = currentData.filter(row => {
                if (!row[fechaColumn]) return false;
                
                const rowDate = new Date(row[fechaColumn]).toISOString().split('T')[0];
                
                if (fechaInicio && fechaFin) {
                    return rowDate >= fechaInicio && rowDate <= fechaFin;
                } else if (fechaInicio) {
                    return rowDate >= fechaInicio;
                } else if (fechaFin) {
                    return rowDate <= fechaFin;
                }
                
                return true;
            });
        }
    }
    
    if (dataToExport.length === 0) {
        alert('No hay datos para exportar con los criterios seleccionados');
        return;
    }
    
    // Preparar datos para exportar (sin la columna id_tarde)
    const exportData = dataToExport.map(row => {
        const newRow = {};
        tableColumns.forEach(column => {
            if (column === PRIMARY_KEY) return; // Excluir id_tarde
            
            let value = row[column];
            
            // Formatear valores para Excel
            if (column.includes('fecha') || column.includes('date')) {
                if (value) {
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) {
                        value = date.toLocaleDateString('es-ES');
                    }
                }
            } else if (column.includes('hora') || column.includes('time')) {
                if (value) {
                    const time = new Date('2000-01-01T' + value);
                    if (!isNaN(time.getTime())) {
                        value = time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    }
                }
            }
            
            const displayName = column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            newRow[displayName] = value || '';
        });
        return newRow;
    });
    
    // Crear libro de Excel
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Llegadas Tarde');
    
    // Generar nombre de archivo con fecha
    const fileName = `llegadas_tarde_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Descargar archivo
    XLSX.writeFile(wb, fileName);
    
    closeExportModal();
    alert(`Archivo ${fileName} descargado exitosamente con ${exportData.length} registros`);
}