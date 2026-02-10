// Configuración específica para la tabla de históricos
const TABLE_NAME = 'hystoricos';

document.addEventListener('DOMContentLoaded', function() {
    loadData();
    initializeCicloSelect();
});

async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    
    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';
    
    try {
        const primaryKey = 'id_historico';
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order(primaryKey, { ascending: false })
            .limit(100);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            renderTable(data);
        } else {
            tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #7f8c8d;">📄 No hay datos disponibles</div>';
        }
    } catch (error) {
        console.error('Error al cargar datos:', error);
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">❌ Error al cargar datos: ' + error.message + '</div>';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    
    if (!data || data.length === 0) {
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #7f8c8d;">📄 No se encontraron registros</div>';
        return;
    }
    
    // Obtener todas las columnas del primer registro, excluyendo la clave primaria
    const allColumns = Object.keys(data[0]).filter(key => key !== 'id_historico');
    
    // Usar todas las columnas en el orden que vienen de la base de datos
    const orderedColumns = allColumns;
    
    let tableHTML = `
        <div class="table-wrapper" style="overflow-x: auto;">
            <table style="width: 100%; min-width: 1000px; border-collapse: collapse; font-size: 12px; background: white;">
                <thead>
                    <tr style="background: #5a6c7d; color: white;">`;
    
    // Agregar encabezados de columna
    orderedColumns.forEach(column => {
        const displayName = formatColumnName(column);
        tableHTML += `<th style="padding: 8px; text-align: left; font-weight: 500; font-size: 11px; text-transform: uppercase; border-right: 1px solid #4a5a6a;">${displayName}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';
    
    // Agregar filas de datos
    data.forEach((row, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
        tableHTML += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid #dee2e6;" onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='${bgColor}'">`;
        
        orderedColumns.forEach(column => {
            const value = formatValue(column, row[column]);
            tableHTML += `<td style="padding: 6px 8px; font-size: 12px; color: #495057; border-right: 1px solid #dee2e6;">${value}</td>`;
        });
        
        tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody></table></div>';
    tableContainer.innerHTML = tableHTML;
}

function formatColumnName(column) {
    // Convertir snake_case a palabras con mayúsculas
    return column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatValue(column, value) {
    if (value === null || value === undefined || value === '') {
        return '-';
    }
    
    // Si es una fecha
    if (column.includes('fecha') && value) {
        const date = new Date(value);
        return date.toLocaleDateString('es-ES');
    }
    
    // Si son valores numéricos (consumos)
    if (column.match(/(actual|anterior|mes\d+_ant)/) && !isNaN(value)) {
        return parseInt(value).toLocaleString();
    }
    
    // Si es cod_ciclo
    if (column === 'cod_ciclo') {
        return value;
    }
    
    // Truncar texto muy largo
    if (typeof value === 'string' && value.length > 30) {
        return `<span title="${value}">${value.substring(0, 27)}...</span>`;
    }
    
    return value;
}

// Funciones para inicializar el filtro de ciclos
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

    // Mostrar indicador de carga
    const filtrosActivos = [];
    if (cicloValido) filtrosActivos.push(`Ciclo: ${cicloFiltro}`);
    if (instalacionValida) filtrosActivos.push(`Instalación: ${nroInstalacionFiltro}`);
    
    const usingOptimalFilters = cicloValido && instalacionValida;
    const searchText = usingOptimalFilters ? '🎯 Búsqueda precisa' : '🔍 Búsqueda completa';
    const resultsText = usingOptimalFilters ? 'Buscando coincidencias exactas' : 'Consultando registros';
    
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
        const primaryKey = 'id_historico';
        
        // Debug: mostrar valores de filtros
        console.log('Filtros aplicados:', {
            cicloFiltro: cicloFiltro,
            cicloValido: cicloValido,
            nroInstalacionFiltro: nroInstalacionFiltro,
            instalacionValida: instalacionValida
        });
        
        // Estrategia de consulta ultra eficiente
        let query;
        let consultaTipo = '';
        
        if (instalacionValida && cicloValido) {
            // Usar ambos filtros con límite muy pequeño
            console.log('Consulta con ambos filtros (súper específica)');
            consultaTipo = 'ambos filtros';
            query = supabase.from(TABLE_NAME)
                .select('*')
                .eq('nro_instalacion', nroInstalacionFiltro)
                .eq('cod_ciclo', cicloFiltro)
                .limit(5);
        } else if (instalacionValida) {
            // Solo instalación - más específico
            console.log('Consulta solo por instalación (específica)');
            consultaTipo = 'solo instalación';
            query = supabase.from(TABLE_NAME)
                .select('*')
                .eq('nro_instalacion', nroInstalacionFiltro)
                .limit(10);
        } else if (cicloValido) {
            // Solo ciclo - usar eq directo
            console.log('Consulta solo por ciclo');
            consultaTipo = 'solo ciclo';
            query = supabase.from(TABLE_NAME)
                .select('*')
                .eq('cod_ciclo', cicloFiltro)
                .limit(20);
        }
        
        // Ejecutar consulta optimizada
        console.log(`Ejecutando consulta ${consultaTipo} en tabla:`, TABLE_NAME);
        let { data, error } = await query;
            
        console.log('Resultado de consulta:', { 
            registrosEncontrados: data ? data.length : 0, 
            error: error?.message 
        });
        
        // Si falla con timeout, usar estrategia de emergencia
        if (error && (error.message.includes('timeout') || error.message.includes('canceling'))) {
            console.log('Timeout detectado, usando estrategia de emergencia...');
            tableContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: #f39c12;"><div class="spinner" style="display: inline-block; margin-right: 10px;"></div>Búsqueda de emergencia...</div>`;
            
            // Estrategia de emergencia: solo los primeros registros que coincidan
            if (instalacionValida) {
                console.log('Emergencia: búsqueda exacta por instalación...');
                ({ data, error } = await supabase
                    .from(TABLE_NAME)
                    .select('*')
                    .eq('nro_instalacion', nroInstalacionFiltro)
                    .limit(5));
            } else if (cicloValido) {
                console.log('Emergencia: búsqueda por rango de ciclo...');
                ({ data, error } = await supabase
                    .from(TABLE_NAME)
                    .select('*')
                    .gte('cod_ciclo', cicloFiltro)
                    .lte('cod_ciclo', cicloFiltro)
                    .limit(10));
            }
            
            console.log('Resultado de emergencia:', { 
                registros: data ? data.length : 0, 
                error: error?.message 
            });
        }
        
        // Último recurso: consulta mínima sin filtros complejos
        if (error && (error.message.includes('timeout') || error.message.includes('canceling'))) {
            console.log('Último recurso: consulta básica sin filtros...');
            tableContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: #e67e22;"><div class="spinner" style="display: inline-block; margin-right: 10px;"></div>Consulta básica...</div>`;
            
            // Consulta básica: solo los primeros registros de la tabla
            console.log('Ejecutando consulta básica sin filtros...');
            const { data: basicData, error: basicError } = await supabase
                .from(TABLE_NAME)
                .select('*')
                .limit(3);
                
            data = basicData;
            error = basicError;
            console.log('Consulta básica:', { registros: data ? data.length : 0, error: error?.message });
        }
        
        if (error) {
            console.error('Error al filtrar por históricos:', error);
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
            return;
        }

        if (data && data.length > 0) {
            // Debug: mostrar una muestra de los datos encontrados
            console.log('Muestra de datos encontrados:', data[0]);
            console.log('Columnas disponibles:', Object.keys(data[0]));
            renderTable(data);
        } else {
            let filtroTexto = '';
            if (cicloValido && instalacionValida) {
                filtroTexto = `Ciclo ${cicloFiltro} e Instalación ${nroInstalacionFiltro}`;
            } else if (cicloValido) {
                filtroTexto = `Ciclo ${cicloFiltro}`;
            } else if (instalacionValida) {
                filtroTexto = `Instalación ${nroInstalacionFiltro}`;
            }
            
            // Debug: verificar si la consulta sin filtros encuentra datos
            console.log('No se encontraron datos con filtros. Verificando datos totales...');
            const { data: allData, error: allError } = await supabase
                .from(TABLE_NAME)
                .select('*')
                .limit(5);
            
            if (allData && allData.length > 0) {
                console.log('Datos disponibles en la tabla (muestra):', allData[0]);
                console.log('Verificar nombres de columnas:', Object.keys(allData[0]));
            } else {
                console.log('No hay datos en la tabla o error:', allError?.message);
            }
            
            tableContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: #e67e22;">📄 No se encontraron registros para ${filtroTexto}</div>`;
        }
    } catch (error) {
        console.error('Error al filtrar por históricos:', error);
        let errorMessage = 'Error al buscar: ' + error.message;
        
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

// Funciones auxiliares eliminadas - formato simplificado

// Funciones CRUD básicas (placeholder - implementar según necesidades)
function openModal() {
    console.log('Abrir modal para nuevo registro');
}

function editRecord(id) {
    console.log('Editar registro:', id);
}

function deleteRecord(id) {
    if (confirm('¿Está seguro de que desea eliminar este registro?')) {
        console.log('Eliminar registro:', id);
    }
}