// Configuración específica para tabla Rangos Reparto
const TABLE_NAME = 'rangos_reparto';
const PRIMARY_KEY = 'id_ranrep';

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
            .order(PRIMARY_KEY, { ascending: false })
            .limit(500);
        
        if (error) throw error;
        
        currentData = data || [];
        
        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]).filter(col => col.toLowerCase() !== 'id');
            renderTable(currentData);
        } else {
            tableContainer.innerHTML = '<div class="no-data">No hay rangos de reparto para mostrar</div>';
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
        tableContainer.innerHTML = '<div class="no-data">No hay rangos de reparto para mostrar</div>';
        return;
    }
    
    let html = '<table class="data-table"><thead><tr>';
    
    // Headers de la tabla
    tableColumns.forEach(column => {
        const displayName = column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        html += `<th>${displayName}</th>`;
    });
    html += '<th>Acciones</th></tr></thead><tbody>';
    
    // Filas de datos
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
            } else if (column.includes('hora') || column.includes('time')) {
                // Formatear horas
                if (value) {
                    const time = new Date('2000-01-01T' + value);
                    if (!isNaN(time.getTime())) {
                        value = time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    }
                }
            } else if (column.includes('rango') && (column.includes('inicio') || column.includes('fin'))) {
                // Formatear rangos numéricos
                if (value && !isNaN(value)) {
                    value = parseInt(value).toLocaleString('es-ES');
                }
            } else if (column.includes('distancia') || column.includes('kilometros')) {
                // Formatear distancias
                if (value && !isNaN(value)) {
                    value = parseFloat(value).toFixed(2) + ' km';
                }
            }
            
            // Resaltar prioridad alta
            if (column.includes('prioridad') || column.includes('urgente')) {
                const isHighPriority = value === 'alta' || value === 'urgente' || value === 1;
                if (isHighPriority) {
                    html += `<td style="background-color: #ffebee; color: #d32f2f; font-weight: bold;">🔥 ${value}</td>`;
                } else {
                    html += `<td>${value}</td>`;
                }
            } else {
                html += `<td>${value}</td>`;
            }
        });
        
        // Columna de acciones
        html += `<td class="actions">
            <button class="btn btn-sm btn-primary" onclick="openEditModal('${rowId}')" title="Editar">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteRecord('${rowId}')" title="Eliminar">🗑️</button>
            <button class="btn btn-sm btn-info" onclick="viewRangeDetails('${rowId}')" title="Ver rango">📍</button>
        </td>`;
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    tableContainer.innerHTML = html;
}

// Abrir modal para crear nuevo registro
function openCreateModal() {
    document.getElementById('modalTitle').textContent = 'Nuevo Rango de Reparto';
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
        
        document.getElementById('modalTitle').textContent = 'Editar Rango de Reparto';
        document.getElementById('recordId').value = data[PRIMARY_KEY] || data[tableColumns[0]];
        
        generateFormFields(data);
        document.getElementById('dataModal').style.display = 'flex';
    } catch (error) {
        console.error('Error cargando registro:', error);
        alert('Error cargando registro: ' + error.message);
    }
}

// Ver detalles del rango
async function viewRangeDetails(id) {
    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq(PRIMARY_KEY, id)
            .single();
        
        if (error) throw error;
        
        let detailsHtml = '<div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">';
        detailsHtml += '<h3 style="text-align: center; margin-bottom: 20px;">📦 Detalles del Rango de Reparto</h3>';
        
        // Información principal
        const mainFields = ['nombre', 'descripcion', 'zona', 'tipo'];
        const rangeFields = ['rango_inicio', 'rango_fin', 'desde', 'hasta'];
        const locationFields = ['direccion', 'coordenadas', 'ubicacion'];
        
        // Sección principal
        detailsHtml += '<div style="margin-bottom: 15px;"><h4>📋 Información General</h4>';
        Object.entries(data).forEach(([key, value]) => {
            if (mainFields.some(field => key.toLowerCase().includes(field))) {
                const displayName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                detailsHtml += `<p><strong>${displayName}:</strong> ${value || 'No especificado'}</p>`;
            }
        });
        detailsHtml += '</div>';
        
        // Sección de rangos
        detailsHtml += '<div style="margin-bottom: 15px;"><h4>📊 Rangos</h4>';
        Object.entries(data).forEach(([key, value]) => {
            if (rangeFields.some(field => key.toLowerCase().includes(field))) {
                const displayName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                let displayValue = value || 'No especificado';
                if (value && !isNaN(value)) {
                    displayValue = parseInt(value).toLocaleString('es-ES');
                }
                detailsHtml += `<p><strong>${displayName}:</strong> ${displayValue}</p>`;
            }
        });
        detailsHtml += '</div>';
        
        // Sección de ubicación
        detailsHtml += '<div style="margin-bottom: 15px;"><h4>📍 Ubicación</h4>';
        Object.entries(data).forEach(([key, value]) => {
            if (locationFields.some(field => key.toLowerCase().includes(field))) {
                const displayName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                detailsHtml += `<p><strong>${displayName}:</strong> ${value || 'No especificado'}</p>`;
            }
        });
        detailsHtml += '</div>';
        
        // Otros campos
        detailsHtml += '<div style="margin-bottom: 15px;"><h4>ℹ️ Información Adicional</h4>';
        Object.entries(data).forEach(([key, value]) => {
            const isMainField = mainFields.some(field => key.toLowerCase().includes(field));
            const isRangeField = rangeFields.some(field => key.toLowerCase().includes(field));
            const isLocationField = locationFields.some(field => key.toLowerCase().includes(field));
            
            if (!isMainField && !isRangeField && !isLocationField && key !== PRIMARY_KEY) {
                const displayName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                let displayValue = value || 'No especificado';
                
                if (key.includes('fecha') && value) {
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) {
                        displayValue = date.toLocaleDateString('es-ES');
                    }
                }
                
                detailsHtml += `<p><strong>${displayName}:</strong> ${displayValue}</p>`;
            }
        });
        detailsHtml += '</div>';
        
        detailsHtml += '<div style="text-align: center; margin-top: 20px;">';
        detailsHtml += '<button onclick="this.parentElement.parentElement.remove()" class="btn btn-secondary">Cerrar</button>';
        detailsHtml += '</div></div>';
        
        // Crear overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; overflow-y: auto;';
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
    if (!confirm('¿Estás seguro de que quieres eliminar este rango de reparto?')) {
        return;
    }
    
    try {
        const { error } = await supabase.from(TABLE_NAME).delete().eq(PRIMARY_KEY, id);
        
        if (error) throw error;
        
        alert('Rango de reparto eliminado exitosamente');
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
        } else if (column.includes('rango') || column.includes('numero') || column.includes('cantidad')) {
            inputType = 'number';
        } else if (column.includes('distancia') || column.includes('kilometros')) {
            inputType = 'number';
        }
        
        let fieldHtml = '';
        
        // Campos especiales
        if (column.includes('prioridad')) {
            fieldHtml = `
                <div class="form-group">
                    <label for="${column}">${displayName}:</label>
                    <select id="${column}" name="${column}" class="form-control">
                        <option value="">Seleccionar prioridad</option>
                        <option value="baja" ${value === 'baja' ? 'selected' : ''}>Baja</option>
                        <option value="media" ${value === 'media' ? 'selected' : ''}>Media</option>
                        <option value="alta" ${value === 'alta' ? 'selected' : ''}>Alta</option>
                        <option value="urgente" ${value === 'urgente' ? 'selected' : ''}>Urgente</option>
                    </select>
                </div>
            `;
        } else if (column.includes('estado') || column.includes('status')) {
            fieldHtml = `
                <div class="form-group">
                    <label for="${column}">${displayName}:</label>
                    <select id="${column}" name="${column}" class="form-control">
                        <option value="activo" ${value === 'activo' ? 'selected' : ''}>Activo</option>
                        <option value="inactivo" ${value === 'inactivo' ? 'selected' : ''}>Inactivo</option>
                        <option value="pendiente" ${value === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                        <option value="completado" ${value === 'completado' ? 'selected' : ''}>Completado</option>
                    </select>
                </div>
            `;
        } else if (column.includes('tipo')) {
            fieldHtml = `
                <div class="form-group">
                    <label for="${column}">${displayName}:</label>
                    <select id="${column}" name="${column}" class="form-control">
                        <option value="">Seleccionar tipo</option>
                        <option value="residencial" ${value === 'residencial' ? 'selected' : ''}>Residencial</option>
                        <option value="comercial" ${value === 'comercial' ? 'selected' : ''}>Comercial</option>
                        <option value="industrial" ${value === 'industrial' ? 'selected' : ''}>Industrial</option>
                        <option value="rural" ${value === 'rural' ? 'selected' : ''}>Rural</option>
                        <option value="urbano" ${value === 'urbano' ? 'selected' : ''}>Urbano</option>
                    </select>
                </div>
            `;
        } else if (column.includes('descripcion') || column.includes('observacion') || column.includes('nota')) {
            fieldHtml = `
                <div class="form-group">
                    <label for="${column}">${displayName}:</label>
                    <textarea id="${column}" name="${column}" class="form-control" rows="3">${value}</textarea>
                </div>
            `;
        } else {
            fieldHtml = `
                <div class="form-group">
                    <label for="${column}">${displayName}:</label>
                    <input type="${inputType}" id="${column}" name="${column}" value="${value}" class="form-control"
                           ${column.includes('rango') ? 'min="0"' : ''}
                           ${column.includes('distancia') ? 'min="0" step="0.01"' : ''}>
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
                if (key.includes('rango') || key.includes('numero') || key.includes('cantidad') || key.includes('distancia')) {
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
                    alert('Rango de reparto actualizado exitosamente');
                } else {
                    // Crear nuevo registro
                    const { error } = await supabase.from(TABLE_NAME).insert([data]);
                    if (error) throw error;
                    alert('Rango de reparto creado exitosamente');
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

// Filtrar por tipo de rango
function filterByTipo(tipo) {
    if (!tipo) {
        renderTable(currentData);
        return;
    }
    
    const tipoColumn = tableColumns.find(col => col.includes('tipo'));
    if (!tipoColumn) {
        renderTable(currentData);
        return;
    }
    
    const filteredData = currentData.filter(row => {
        return row[tipoColumn] && row[tipoColumn].toLowerCase() === tipo.toLowerCase();
    });
    
    renderTable(filteredData);
}

// Filtrar por prioridad
function filterByPrioridad(prioridad) {
    if (!prioridad) {
        renderTable(currentData);
        return;
    }
    
    const prioridadColumn = tableColumns.find(col => col.includes('prioridad'));
    if (!prioridadColumn) {
        renderTable(currentData);
        return;
    }
    
    const filteredData = currentData.filter(row => {
        return row[prioridadColumn] && row[prioridadColumn].toLowerCase() === prioridad.toLowerCase();
    });
    
    renderTable(filteredData);
}

// Filtrar por rango numérico
function filterByRangoNumerico(minValue, maxValue) {
    const rangoColumn = tableColumns.find(col => col.includes('rango') && (col.includes('inicio') || col.includes('desde')));
    if (!rangoColumn) {
        renderTable(currentData);
        return;
    }
    
    const filteredData = currentData.filter(row => {
        const valor = parseInt(row[rangoColumn]);
        if (isNaN(valor)) return false;
        
        let inRange = true;
        if (minValue !== undefined && minValue !== '') {
            inRange = inRange && valor >= parseInt(minValue);
        }
        if (maxValue !== undefined && maxValue !== '') {
            inRange = inRange && valor <= parseInt(maxValue);
        }
        
        return inRange;
    });
    
    renderTable(filteredData);
}

// Supabase client initialization and data loading
(function() {
    let supabaseClient;
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase;
    } else if (window.supabase && window.SUPABASE_URL && window.SUPABASE_KEY) {
        supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    } else {
        console.error('Supabase no está configurado correctamente.');
        renderTable([]);
        return;
    }

    let allData = [];
    let filteredColumns = [];

    document.addEventListener('DOMContentLoaded', function() {
        loadData();
    });

    async function loadData() {
        const tableContainer = document.getElementById('tableContainer');
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        tableContainer.innerHTML = '';
        try {
            const { data, error } = await supabaseClient
                .from('rangos_reparto')
                .select('*')
                .order('id_ranrep', { ascending: true });
            if (error) throw error;
            if (!data || !Array.isArray(data)) throw new Error('No se recibieron datos de Supabase.');
            // Excluir id_ranrep desde el inicio
            allData = data.map(row => {
                const { id_ranrep, ...rest } = row;
                return rest;
            });
            filteredColumns = Object.keys(allData[0] || {}).filter(col => col !== 'id_ranrep');
            renderTable(allData);
        } catch (error) {
            tableContainer.innerHTML = '<div class="error">Error cargando datos: ' + error.message + '</div>';
        } finally {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        }
    }

    function setUpDoubleFilter() {
        const filterCiclo = document.getElementById('filterCiclo');
        const filterCorreria = document.getElementById('filterCorreria');
        if (filterCiclo && filterCorreria) {
            filterCiclo.value = window.lastFilterCiclo || '';
            filterCorreria.value = window.lastFilterCorreria || '';
            filterCiclo.disabled = false;
            filterCorreria.disabled = false;
            // Eliminar todos los listeners previos usando un flag
            if (!window._filtrosRangosRepartoSet) {
                filterCiclo.addEventListener('input', function() {
                    window.lastFilterCiclo = filterCiclo.value;
                    applyDoubleFilter();
                });
                filterCorreria.addEventListener('input', function() {
                    window.lastFilterCorreria = filterCorreria.value;
                    applyDoubleFilter();
                });
                window._filtrosRangosRepartoSet = true;
            }
        }
    }

    // Evitar que renderTable vuelva a crear los campos de filtro y pierdan el foco
    function renderTable(data) {
        const tableContainer = document.getElementById('tableContainer');
        // Solo crear los filtros si no existen
        let filterHtml = document.getElementById('filtrosRangosRepartoHtml');
        if (!filterHtml) {
            filterHtml = document.createElement('div');
            filterHtml.id = 'filtrosRangosRepartoHtml';
            filterHtml.style.marginBottom = '10px';
            filterHtml.style.display = 'flex';
            filterHtml.style.gap = '16px';
            filterHtml.style.alignItems = 'center';
            filterHtml.innerHTML = `<label for="filterCiclo" style="font-weight:bold; font-size:1.1em;">Ciclo:</label>`
                + `<input type="text" id="filterCiclo" style="width: 120px; height: 38px; font-size: 1.1em; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;" placeholder="Ciclo" autocomplete="off">`
                + `<label for="filterCorreria" style="font-weight:bold; font-size:1.1em;">Correria:</label>`
                + `<input type="text" id="filterCorreria" style="width: 120px; height: 38px; font-size: 1.1em; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;" placeholder="Correria" autocomplete="off">`
                + `<span style="color:#d32f2f; font-size:0.95em; margin-left:10px;">* Ambos campos son obligatorios</span>`
                + `<button id="exportExcelBtn" style="margin-left:20px; padding:8px 18px; font-size:1em; background:#1976d2; color:#fff; border:none; border-radius:6px; cursor:pointer;">Exportar Excel</button>`;
            tableContainer.parentNode.insertBefore(filterHtml, tableContainer);
            setUpDoubleFilter();
            // Cargar SheetJS si no está presente
            if (!window.XLSX) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
                script.onload = function() {
                    setUpExportButton();
                };
                document.head.appendChild(script);
            } else {
                setUpExportButton();
            }
        }
        // Elimina cualquier duplicado extra de filtros si existe
        const filtros = document.querySelectorAll('#filtrosRangosRepartoHtml');
        if (filtros.length > 1) {
            for (let i = 1; i < filtros.length; i++) {
                filtros[i].remove();
            }
        }
        // Filtros dobles para CICLO y CORRERIA
        // Solo mostrar los filtros una vez, no los dupliques en el innerHTML de la tabla
        if (!data || data.length === 0) {
            tableContainer.innerHTML = '<div class="no-data">No hay rangos de reparto registrados para mostrar</div>';
            return;
        }
        let html = '<table class="data-table"><thead><tr>';
        filteredColumns.forEach(col => {
            if (col !== 'id_ranrep') { // Nunca mostrar id_ranrep
                let header = col.replace(/_/g, ' ').toUpperCase();
                html += `<th>${header}</th>`;
            }
        });
        html += '</tr></thead><tbody>';
        data.forEach(row => {
            html += '<tr>';
            filteredColumns.forEach(col => {
                if (col !== 'id_ranrep') {
                    html += `<td>${row[col] || '-'}</td>`;
                }
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        tableContainer.innerHTML = html;
        setUpDoubleFilter();
        setUpExportButton();
        // Exportar a Excel los datos filtrados
        function setUpExportButton() {
            const btn = document.getElementById('exportExcelBtn');
            if (!btn) return;
            btn.onclick = function() {
                // Obtener los datos visibles en la tabla
                let rows = [];
                const table = document.querySelector('.data-table');
                if (!table) return alert('No hay datos para exportar');
                const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim()).filter(h => h !== 'Acciones');
                Array.from(table.querySelectorAll('tbody tr')).forEach(tr => {
                    const cells = Array.from(tr.querySelectorAll('td'));
                    // Excluir columna de acciones
                    if (cells.length === headers.length + 1) cells.pop();
                    rows.push(cells.map(td => td.textContent.trim()));
                });
                if (rows.length === 0) return alert('No hay datos para exportar');
                // Crear hoja Excel
                const ws = window.XLSX.utils.aoa_to_sheet([headers, ...rows]);
                const wb = window.XLSX.utils.book_new();
                window.XLSX.utils.book_append_sheet(wb, ws, 'RangosReparto');
                window.XLSX.writeFile(wb, 'rangos_reparto_filtrados.xlsx');
            };
        }
    }

    function applyDoubleFilter() {
        const ciclo = document.getElementById('filterCiclo').value.toLowerCase().trim();
        const correria = document.getElementById('filterCorreria').value.toLowerCase().trim();
        window.lastFilterCiclo = ciclo;
        window.lastFilterCorreria = correria;
        if (!ciclo || !correria) {
            renderTable([]); // Ambos campos obligatorios
            return;
        }
        let filteredData = allData.filter(row => {
            const valCiclo = (row['ciclo'] || '').toString().toLowerCase();
            const valCorreria = (row['correria'] || '').toString().toLowerCase();
            return valCiclo.includes(ciclo) && valCorreria.includes(correria);
        });
        renderTable(filteredData);
    }
})();