// Lógica compartida para todas las tablas
let tableColumns = [];
let currentData = [];

document.addEventListener('DOMContentLoaded', function() {
    // Verificar si es la página de históricos e inicializar ciclos
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPage.includes('historicos')) {
        setTimeout(() => {
            initializeCicloSelect();
        }, 100);
    }
    
    loadData();
});

async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    
    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';
    
    try {
        // Determinar la columna de clave principal según la tabla
        const primaryKey = typeof PRIMARY_KEY !== 'undefined' ? PRIMARY_KEY :
                          TABLE_NAME === 'controles_reparto' ? 'id_control' : 
                          TABLE_NAME === 'coordenadas' ? 'id_coor' : 
                          TABLE_NAME === 'historicos' ? 'id_historico' : 'id';
        
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order(primaryKey, { ascending: false })
            .limit(500);
        
        if (error) throw error;
        
        currentData = data || [];
        
        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]);
            
            // Ordenar columnas específicamente para la tabla historicos
            if (TABLE_NAME === 'historicos') {
                const columnOrder = ['direccion', 'nro_instalacion', 'ruta_lectura', 'supervisor', 'lector', 'cod_ciclo', 'tipo_consumo', 'actual'];
                tableColumns = columnOrder.concat(tableColumns.filter(col => !columnOrder.includes(col) && col !== 'id_historico'));
            }
            
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
    
    tableColumns.forEach(col => {
        // Ocultar columnas de clave principal
        if ((TABLE_NAME === 'controles_reparto' && col === 'id_control') || 
            (TABLE_NAME === 'coordenadas' && col === 'id_coor') ||
            (TABLE_NAME === 'historicos' && col === 'id_historico') ||
            (TABLE_NAME === 'refutar_errores' && col === 'id')) return;
        html += `<th>${formatColumnName(col)}</th>`;
    });
    html += '<th>Acciones</th></tr></thead><tbody>';
    
    data.forEach(row => {
        html += '<tr>';
        tableColumns.forEach(col => {
            // Ocultar columnas de clave principal
            if ((TABLE_NAME === 'controles_reparto' && col === 'id_control') || 
                (TABLE_NAME === 'coordenadas' && col === 'id_coor') ||
                (TABLE_NAME === 'historicos' && col === 'id_historico') ||
                (TABLE_NAME === 'refutar_errores' && col === 'id')) return;
            const cellValue = formatValue(row[col], col);
            html += `<td>${cellValue}</td>`;
        });
        
        // Determinar la clave principal según la tabla
        const primaryKey = TABLE_NAME === 'controles_reparto' ? 'id_control' : 
                          TABLE_NAME === 'coordenadas' ? 'id_coor' : 
                          TABLE_NAME === 'historicos' ? 'id_historico' : 'id';
        const rowId = row[primaryKey] || row[tableColumns[0]];
        html += `<td class="actions">
            <button class="btn btn-primary btn-sm" onclick='editRecord(${JSON.stringify(row).replace(/'/g, "&apos;")})'>✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteRecord(${rowId})">🗑️</button>
        </td></tr>`;
    });
    
    html += '</tbody></table>';
    tableContainer.innerHTML = html;
    
    // Llenar filtros si es la tabla controles_reparto
    if (TABLE_NAME === 'controles_reparto') {
        populateFilters(currentData);
    }
}

function renderTableFiltered(data) {
    const tableContainer = document.getElementById('tableContainer');
    
    let html = '<table class="data-table"><thead><tr>';
    
    tableColumns.forEach(col => {
        // Ocultar columnas de clave principal
        if ((TABLE_NAME === 'controles_reparto' && col === 'id_control') || 
            (TABLE_NAME === 'coordenadas' && col === 'id_coor') ||
            (TABLE_NAME === 'historicos' && col === 'id_historico') ||
            (TABLE_NAME === 'refutar_errores' && col === 'id')) return;
        html += `<th>${formatColumnName(col)}</th>`;
    });
    html += '<th>Acciones</th></tr></thead><tbody>';
    
    data.forEach(row => {
        html += '<tr>';
        tableColumns.forEach(col => {
            // Ocultar columnas de clave principal
            if ((TABLE_NAME === 'controles_reparto' && col === 'id_control') || 
                (TABLE_NAME === 'coordenadas' && col === 'id_coor') ||
                (TABLE_NAME === 'historicos' && col === 'id_historico') ||
                (TABLE_NAME === 'refutar_errores' && col === 'id')) return;
            const cellValue = formatValue(row[col], col);
            html += `<td>${cellValue}</td>`;
        });
        
        // Determinar la clave principal según la tabla
        const primaryKey = TABLE_NAME === 'controles_reparto' ? 'id_control' : 
                          TABLE_NAME === 'coordenadas' ? 'id_coor' : 
                          TABLE_NAME === 'historicos' ? 'id_historico' : 'id';
        const rowId = row[primaryKey] || row[tableColumns[0]];
        html += `<td class="actions">
            <button class="btn btn-primary btn-sm" onclick='editRecord(${JSON.stringify(row).replace(/'/g, "&apos;")})'>✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteRecord(${rowId})">🗑️</button>
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
    
    // Crear enlace de Google Maps para coordenadas
    if (TABLE_NAME === 'coordenadas' && columnName === 'coordenada' && value) {
        const coordStr = String(value).trim();
        // Verificar si tiene formato de coordenadas (acepta varios formatos)
        if (coordStr.match(/^-?\d+(\.\d+)?[,\s]+-?\d+(\.\d+)?$/)) {
            // Normalizar formato para Google Maps: separar con coma y espacio
            const coords = coordStr.replace(/[,\s]+/g, ',').split(',');
            if (coords.length === 2) {
                const lat = coords[0].trim();
                const lng = coords[1].trim();
                const googleMapsCoords = `${lat}, ${lng}`;
                const googleMapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(googleMapsCoords)}`;
                return `<a href="${googleMapsUrl}" target="_blank" style="color: #3498db; text-decoration: none; font-weight: 500;" title="Abrir en Google Maps">📍 ${coordStr}</a>`;
            }
        }
        return coordStr;
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
        if (col === 'id' || col === 'id_control' || col === 'id_coor' || col === 'id_historico' || col === 'created_at' || col === 'updated_at') return;
        
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const label = document.createElement('label');
        label.textContent = formatColumnName(col);
        label.setAttribute('for', col);
        
        let input = document.createElement('input');
        input.type = 'text';
        input.id = col;
        input.name = col;
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        formFields.appendChild(formGroup);
    });
}

function editRecord(record) {
    try {
        document.getElementById('modalTitle').textContent = 'Editar Registro';
        // Determinar la clave principal según la tabla
        const primaryKey = TABLE_NAME === 'controles_reparto' ? 'id_control' : 
                          TABLE_NAME === 'coordenadas' ? 'id_coor' : 
                          TABLE_NAME === 'historicos' ? 'id_historico' : 'id';
        document.getElementById('recordId').value = record[primaryKey] || record[tableColumns[0]];
        generateFormFields();
        
        tableColumns.forEach(col => {
            const input = document.getElementById(col);
            if (input && record[col] !== null && record[col] !== undefined) {
                input.value = record[col];
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
        // Determinar la clave principal según la tabla
        const primaryKey = TABLE_NAME === 'controles_reparto' ? 'id_control' : 
                          TABLE_NAME === 'coordenadas' ? 'id_coor' : 
                          TABLE_NAME === 'historicos' ? 'id_historico' : 'id';
        const { error } = await supabase.from(TABLE_NAME).delete().eq(primaryKey, id);
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

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('dataForm')?.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const id = document.getElementById('recordId').value;
        const formData = {};
        
        tableColumns.forEach(col => {
            if (col === 'id' || col === 'id_control' || col === 'id_coor' || col === 'id_historico' || col === 'created_at' || col === 'updated_at') return;
            const input = document.getElementById(col);
            if (input) formData[col] = input.value || null;
        });
        
        try {
            if (id) {
                // Determinar la clave principal según la tabla
                const primaryKey = TABLE_NAME === 'controles_reparto' ? 'id_control' : 
                                  TABLE_NAME === 'coordenadas' ? 'id_coor' : 
                                  TABLE_NAME === 'historicos' ? 'id_historico' : 'id';
                const { error } = await supabase.from(TABLE_NAME).update(formData).eq(primaryKey, id);
                if (error) throw error;
                showMessage('Actualizado', 'success');
            } else {
                const { error } = await supabase.from(TABLE_NAME).insert([formData]);
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

function populateFilters(data) {
    const cicloFiltro = document.getElementById('filtro-ciclo');
    
    if (!cicloFiltro) return;
    
    // Limpiar opciones actuales
    cicloFiltro.innerHTML = '<option value="">Seleccione ciclo</option>';
    
    // Agregar opciones de ciclo del 1 al 20
    for (let i = 1; i <= 20; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Ciclo ${i}`;
        cicloFiltro.appendChild(option);
    }
}

async function applyFilters() {
    const cicloFiltro = document.getElementById('filtro-ciclo')?.value;
    const correríaFiltro = document.getElementById('filtro-correria')?.value;
    const tableContainer = document.getElementById('tableContainer');
    
    // Aplicar filtros solo si ambos están completos
    if (cicloFiltro && correríaFiltro && correríaFiltro.length === 4) {
        // Mostrar indicador de carga
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #3498db;"><div class="spinner" style="display: inline-block; margin-right: 10px;"></div>Buscando registros...</div>';
        
        try {
            // Consulta directa a Supabase con filtros
            const primaryKey = TABLE_NAME === 'controles_reparto' ? 'id_control' : 'id';
            const { data, error } = await supabase
                .from(TABLE_NAME)
                .select('*')
                .eq('ciclo', cicloFiltro)
                .eq('correria', correríaFiltro)
                .order(primaryKey, { ascending: false });
            
            if (error) throw error;
            
            if (data && data.length > 0) {
                renderTableFiltered(data);
            } else {
                tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e67e22;">📄 No se encontraron registros para Ciclo ' + cicloFiltro + ' y Correría ' + correríaFiltro + '</div>';
            }
        } catch (error) {
            console.error('Error al filtrar:', error);
            tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">❌ Error al buscar: ' + error.message + '</div>';
        }
    } else if (!cicloFiltro && !correríaFiltro) {
        // Si ambos están vacíos, cargar todos los datos desde Supabase
        loadData();
    } else {
        // Si están incompletos, mostrar mensaje de espera
        let mensaje = '';
        if (!cicloFiltro) {
            mensaje = '📋 Seleccione un ciclo';
        } else if (!correríaFiltro) {
            mensaje = '🔢 Ingrese la correría (4 números)';
        } else if (correríaFiltro.length < 4) {
            mensaje = `🔢 Correría incompleta (${correríaFiltro.length}/4 números)`;
        }
        tableContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: #3498db; font-size: 16px;">${mensaje}</div>`;
    }
}

function clearFilters() {
    const cicloFiltro = document.getElementById('filtro-ciclo');
    const correríaFiltro = document.getElementById('filtro-correria');
    
    if (cicloFiltro) cicloFiltro.value = '';
    if (correríaFiltro) correríaFiltro.value = '';
    
    // Recargar todos los datos desde Supabase
    loadData();
}

// Funciones específicas para filtro de instalación en coordenadas
function handleInstalacionInput(input) {
    // Solo permitir números
    let value = input.value.replace(/[^0-9]/g, '');
    
    // Limitar a 18 caracteres
    if (value.length > 18) {
        value = value.slice(0, 18);
    }
    
    input.value = value;
    
    // Habilitar/deshabilitar botón de búsqueda
    const btnBuscar = document.getElementById('btn-buscar');
    if (btnBuscar) {
        btnBuscar.disabled = value.length !== 18;
        btnBuscar.textContent = value.length === 18 ? '🔍 Buscar' : `🔍 Buscar (${value.length}/18)`;
    }
}

function handleInstalacionKeyPress(event) {
    // Si presiona Enter y tiene 18 dígitos, buscar
    if (event.key === 'Enter') {
        const instalacionFiltro = document.getElementById('filtro-instalacion')?.value;
        if (instalacionFiltro && instalacionFiltro.length === 18) {
            searchByInstalacion();
        }
    }
}

async function searchByInstalacion() {
    const instalacionFiltro = document.getElementById('filtro-instalacion')?.value;
    const tableContainer = document.getElementById('tableContainer');
    const btnBuscar = document.getElementById('btn-buscar');
    
    if (!instalacionFiltro || instalacionFiltro.length !== 18) {
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e67e22;">⚠️ Debe ingresar exactamente 18 dígitos para buscar</div>';
        return;
    }
    
    // Deshabilitar botón durante la búsqueda
    if (btnBuscar) {
        btnBuscar.disabled = true;
        btnBuscar.textContent = '⏳ Buscando...';
    }
    
    // Mostrar indicador de carga
    tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #3498db;"><div class="spinner" style="display: inline-block; margin-right: 10px;"></div>Buscando en toda la base de datos...</div>';
    
    try {
        // Consulta optimizada a Supabase con filtro de instalación
        const primaryKey = 'id_coor';
        
        // Intentar primero con búsqueda exacta
        let { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('instalacion', instalacionFiltro)
            .order(primaryKey, { ascending: false })
            .limit(1000);
        
        // Si falla con timeout, intentar con LIKE para ser más rápido
        if (error && error.message.includes('timeout')) {
            ({ data, error } = await supabase
                .from(TABLE_NAME)
                .select('*')
                .like('instalacion', `%${instalacionFiltro}%`)
                .order(primaryKey, { ascending: false })
                .limit(500));
        }
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            renderTableFiltered(data);
        } else {
            tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e67e22;">📄 No se encontraron registros para la instalación ' + instalacionFiltro + '</div>';
        }
    } catch (error) {
        console.error('Error al filtrar por instalación:', error);
        let errorMessage = 'Error al buscar: ' + error.message;
        
        // Mensajes específicos para errores comunes
        if (error.message.includes('timeout')) {
            errorMessage = 'La búsqueda tardó demasiado. Intente nuevamente o contacte al administrador.';
        } else if (error.message.includes('connection')) {
            errorMessage = 'Error de conexión. Verifique su conexión a internet.';
        }
        
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">❌ ' + errorMessage + '</div>';
    } finally {
        // Rehabilitar botón
        if (btnBuscar) {
            btnBuscar.disabled = false;
            btnBuscar.textContent = '🔍 Buscar';
        }
    }
}

function clearInstalacionFilter() {
    const instalacionFiltro = document.getElementById('filtro-instalacion');
    const btnBuscar = document.getElementById('btn-buscar');
    
    if (instalacionFiltro) instalacionFiltro.value = '';
    if (btnBuscar) {
        btnBuscar.disabled = true;
        btnBuscar.textContent = '🔍 Buscar';
    }
    
    // Recargar todos los datos desde Supabase
    loadData();
}

function handleCorreriaInput(input) {
    // Solo permitir números
    let value = input.value.replace(/[^0-9]/g, '');
    
    // Limitar a 4 caracteres
    if (value.length > 4) {
        value = value.slice(0, 4);
    }
    
    input.value = value;
    
    // Aplicar filtros automáticamente cuando tenga exactamente 4 números
    applyFilters();
}

// Funciones específicas para filtro de nro_instalacion en historicos
function handleNroInstalacionInput(input) {
    // Solo permitir números
    let value = input.value.replace(/[^0-9]/g, '');
    
    // Limitar a 18 caracteres
    if (value.length > 18) {
        value = value.slice(0, 18);
    }
    
    input.value = value;
    updateSearchButton();
}

function handleCicloChange() {
    updateSearchButton();
}

function updateSearchButton() {
    const cicloSelect = document.getElementById('filtro-cod-ciclo');
    const instalacionInput = document.getElementById('filtro-nro-instalacion');
    const btnBuscar = document.getElementById('btn-buscar-historicos');
    
    if (btnBuscar) {
        const cicloValido = cicloSelect && cicloSelect.value !== '';
        const instalacionValue = instalacionInput ? instalacionInput.value : '';
        const instalacionValida = instalacionValue.length === 18;
        
        // Habilitar botón si al menos un filtro está completo
        const habilitado = cicloValido || instalacionValida;
        btnBuscar.disabled = !habilitado;
        
        if (instalacionValue.length > 0 && instalacionValue.length < 18) {
            btnBuscar.textContent = `🔍 Buscar (${instalacionValue.length}/18)`;
        } else {
            btnBuscar.textContent = '🔍 Buscar';
        }
    }
}

function handleNroInstalacionKeyPress(event) {
    if (event.key === 'Enter') {
        const cicloSelect = document.getElementById('filtro-cod-ciclo');
        const instalacionInput = document.getElementById('filtro-nro-instalacion');
        const cicloValido = cicloSelect && cicloSelect.value !== '';
        const instalacionValida = instalacionInput && instalacionInput.value.length === 18;
        
        if (cicloValido || instalacionValida) {
            searchByHistoricos();
        }
    }
}

async function searchByHistoricos() {
    const cicloFiltro = document.getElementById('filtro-cod-ciclo')?.value;
    const nroInstalacionFiltro = document.getElementById('filtro-nro-instalacion')?.value;
    const tableContainer = document.getElementById('tableContainer');
    const btnBuscar = document.getElementById('btn-buscar-historicos');
    
    // Validar que al menos un filtro esté completo
    const cicloValido = cicloFiltro && cicloFiltro !== '';
    const instalacionValida = nroInstalacionFiltro && nroInstalacionFiltro.length === 18;
    
    if (!cicloValido && !instalacionValida) {
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e67e22;">⚠️ Debe seleccionar un ciclo o ingresar 18 dígitos de instalación para buscar</div>';
        return;
    }
    
    if (nroInstalacionFiltro && nroInstalacionFiltro.length !== 18 && nroInstalacionFiltro.length > 0) {
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e67e22;">⚠️ El número de instalación debe tener exactamente 18 dígitos</div>';
        return;
    }
    
    // Deshabilitar botón durante la búsqueda
    if (btnBuscar) {
        btnBuscar.disabled = true;
        btnBuscar.textContent = '⏳ Buscando...';
    }
    
    // Mostrar indicador de carga para búsqueda completa
    const filtrosActivos = [];
    if (cicloValido) filtrosActivos.push(`Ciclo: ${cicloFiltro}`);
    if (instalacionValida) filtrosActivos.push(`Instalación: ${nroInstalacionFiltro}`);
    
    const usingOptimalFilters = cicloValido && instalacionValida;
    const searchText = usingOptimalFilters ? '🎯 Búsqueda precisa' : '🔍 Búsqueda completa';
    const resultsText = usingOptimalFilters ? 'Buscando coincidencias exactas' : 'Consultando hasta 2000 registros';
    
    tableContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #3498db;">
            <div class="spinner" style="display: inline-block; margin-right: 10px;"></div>
            <div>${searchText}...</div>
            <div style="font-size: 12px; margin-top: 10px; color: #7f8c8d;">Buscando en base de datos...</div>
            <div style="font-size: 11px; margin-top: 5px; color: #95a5a6;">${filtrosActivos.join(' | ')}</div>
            <div style="font-size: 10px; margin-top: 8px; color: #bdc3c7;">${resultsText}</div>
        </div>
    `;
    
    try {
        // Consulta optimizada a Supabase con filtro de nro_instalacion
        const primaryKey = 'id_historico';
        
        // Construir consulta completa sin timeout artificial
        let query = supabase.from(TABLE_NAME).select('*');
        
        if (cicloValido) {
            query = query.eq('cod_ciclo', parseInt(cicloFiltro));
        }
        
        if (instalacionValida) {
            query = query.eq('nro_instalacion', nroInstalacionFiltro);
        }
        
        // Usar límite mayor para obtener más resultados, dejar que Supabase maneje el tiempo
        const searchPromise = query
            .order(primaryKey, { ascending: false })
            .limit(2000);
        
        let { data, error } = await searchPromise;
        
        // Si falla con timeout, intentar búsqueda más simple
        if (error && (error.message.includes('timeout') || error.message.includes('tiempo de espera'))) {
            const isOptimal = cicloValido && instalacionValida;
            const fallbackMsg = isOptimal ? 'Reintentando sin ordenamiento...' : 'Búsqueda más simple...';
            tableContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: #f39c12;"><div class="spinner" style="display: inline-block; margin-right: 10px;"></div>${fallbackMsg}</div>`;
            
            // Consulta sin ordenamiento para ser más rápida
            let fallbackQuery = supabase.from(TABLE_NAME).select('*');
            
            if (cicloValido) {
                fallbackQuery = fallbackQuery.eq('cod_ciclo', parseInt(cicloFiltro));
            }
            
            if (instalacionValida) {
                fallbackQuery = fallbackQuery.eq('nro_instalacion', nroInstalacionFiltro);
            }
            
            // Sin ordenamiento y límite menor para mayor velocidad
            ({ data, error } = await fallbackQuery.limit(1000));
        }
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            renderTableFiltered(data);
        } else {
            tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e67e22;">📄 No se encontraron registros para el N° Instalación ' + nroInstalacionFiltro + '</div>';
        }
    } catch (error) {
        console.error('Error al filtrar por nro_instalacion:', error);
        let errorMessage = 'Error al buscar: ' + error.message;
        
        // Mensajes específicos para errores comunes
        const cicloActivo = document.getElementById('filtro-cod-ciclo')?.value;
        const instalacionActiva = document.getElementById('filtro-nro-instalacion')?.value;
        const usandoAmbos = cicloActivo && instalacionActiva && instalacionActiva.length === 18;
        
        if (error.message.includes('timeout') || error.message.includes('tiempo de espera')) {
            if (usandoAmbos) {
                errorMessage = 'La búsqueda tardó demasiado. Posible problema de conectividad o la base de datos está muy ocupada.';
            } else if (cicloActivo || instalacionActiva) {
                errorMessage = 'Búsqueda muy lenta. Intente usar ambos filtros para una búsqueda más específica.';
            } else {
                errorMessage = 'Búsqueda muy lenta. Use filtros específicos para reducir la cantidad de datos a consultar.';
            }
        } else if (error.message.includes('connection')) {
            errorMessage = 'Error de conexión. Verifique su conexión a internet.';
        }
        
        let sugerencia = '';
        if (usandoAmbos) {
            sugerencia = '<br><small style="color: #95a5a6;">Ya está usando filtros óptimos. Problema posible de red o servidor.</small>';
        } else if (!cicloActivo && !instalacionActiva) {
            sugerencia = '<br><small style="color: #95a5a6;">Sugerencia: Use al menos un filtro para búsquedas más rápidas</small>';
        } else {
            sugerencia = '<br><small style="color: #95a5a6;">Sugerencia: Use ambos filtros (Ciclo + Instalación) para máxima velocidad</small>';
        }
        
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">❌ ' + errorMessage + sugerencia + '</div>';
    } finally {
        // Rehabilitar botón
        if (btnBuscar) {
            btnBuscar.disabled = false;
            btnBuscar.textContent = '🔍 Buscar';
        }
    }
}

function clearHistoricosFilters() {
    const cicloSelect = document.getElementById('filtro-cod-ciclo');
    const nroInstalacionFiltro = document.getElementById('filtro-nro-instalacion');
    const btnBuscar = document.getElementById('btn-buscar-historicos');
    
    if (cicloSelect) cicloSelect.value = '';
    if (nroInstalacionFiltro) nroInstalacionFiltro.value = '';
    if (btnBuscar) {
        btnBuscar.disabled = true;
        btnBuscar.textContent = '🔍 Buscar';
    }
    
    // Recargar todos los datos desde Supabase
    loadData();
}

// Mantener compatibilidad
function clearNroInstalacionFilter() {
    clearHistoricosFilters();
}

// Función para inicializar el desplegable de ciclos
function initializeCicloSelect() {
    const cicloSelect = document.getElementById('filtro-cod-ciclo');
    if (cicloSelect && cicloSelect.children.length <= 1) {
        for (let i = 1; i <= 20; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            cicloSelect.appendChild(option);
        }
    }
}
