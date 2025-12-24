// Configuración específica para la tabla de secuencia_lectura
const TABLE_NAME = 'secuencia_lectura';

document.addEventListener('DOMContentLoaded', function() {
    loadData();
});

async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    
    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';
    
    try {
        const primaryKey = 'id_secuencia';
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order(primaryKey, { ascending: false })
            .limit(100);
            
        // Debug: verificar datos obtenidos
        if (data && data.length > 0) {
            console.log('Primer registro completo:', data[0]);
            console.log('Total de columnas en el registro:', Object.keys(data[0]).length);
        }
        
        if (error) throw error;
        
        // No cargar datos inicialmente, mostrar mensaje para usar filtros
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #95a5a6; font-style: italic;">📋 Use los filtros para buscar registros específicos</div>';
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
    const allColumns = Object.keys(data[0]).filter(key => key !== 'id_secuencia');
    
    // Debug: mostrar columnas disponibles
    console.log('Todas las columnas encontradas:', Object.keys(data[0]));
    console.log('Columnas a mostrar (sin id_secuencia):', allColumns);
    
    let tableHTML = `
        <div class="table-wrapper" style="overflow-x: auto;">
            <table style="width: 100%; min-width: 1000px; border-collapse: collapse; font-size: 12px; background: white;">
                <thead>
                    <tr style="background: #5a6c7d; color: white;">`;
    
    // Agregar encabezados de columna
    allColumns.forEach(column => {
        const displayName = formatColumnName(column);
        tableHTML += `<th style="padding: 8px; text-align: left; font-weight: 500; font-size: 11px; text-transform: uppercase; border-right: 1px solid #4a5a6a;">${displayName}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';
    
    // Agregar filas de datos
    data.forEach((row, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
        tableHTML += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid #dee2e6;" onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='${bgColor}'">`;
        
        allColumns.forEach(column => {
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
    
    // Si son valores numéricos
    if ((column.includes('secuencia') || column.includes('orden') || column.includes('numero')) && !isNaN(value)) {
        return parseInt(value).toLocaleString();
    }
    
    // Truncar texto muy largo
    if (typeof value === 'string' && value.length > 30) {
        return `<span title="${value}">${value.substring(0, 27)}...</span>`;
    }
    
    return value;
}

// Funciones de filtrado
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

function updateSearchButton() {
    const direccionInput = document.getElementById('filtro-direccion');
    const instalacionInput = document.getElementById('filtro-nro-instalacion');
    const btnBuscar = document.getElementById('btn-buscar-secuencia');
    
    if (btnBuscar) {
        const direccionValida = direccionInput && direccionInput.value.trim().length >= 3;
        const instalacionValida = instalacionInput && instalacionInput.value.length >= 3;
        
        // Habilitar botón si al menos un filtro tiene contenido suficiente
        const habilitado = direccionValida || instalacionValida;
        btnBuscar.disabled = !habilitado;
        
        if (instalacionInput.value.length > 0 && instalacionInput.value.length < 18) {
            btnBuscar.textContent = `🔍 Buscar (${instalacionInput.value.length}/18)`;
        } else {
            btnBuscar.textContent = '🔍 Buscar';
        }
    }
}

async function searchByFilters() {
    const direccionFiltro = document.getElementById('filtro-direccion')?.value.trim();
    const nroInstalacionFiltro = document.getElementById('filtro-nro-instalacion')?.value;
    const tableContainer = document.getElementById('tableContainer');
    const btnBuscar = document.getElementById('btn-buscar-secuencia');
    
    // Validar que al menos un filtro tenga contenido
    const direccionValida = direccionFiltro && direccionFiltro.length >= 3;
    const instalacionValida = nroInstalacionFiltro && nroInstalacionFiltro.length >= 3;
    
    if (!direccionValida && !instalacionValida) {
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e67e22;">⚠️ Debe ingresar al menos 3 caracteres en dirección o instalación para buscar</div>';
        return;
    }
    
    // Deshabilitar botón durante la búsqueda
    if (btnBuscar) {
        btnBuscar.disabled = true;
        btnBuscar.textContent = '⏳ Buscando...';
    }
    
    // Mostrar indicador de carga
    const filtrosActivos = [];
    if (direccionValida) filtrosActivos.push(`Dirección: ${direccionFiltro}`);
    if (instalacionValida) filtrosActivos.push(`Instalación: ${nroInstalacionFiltro}`);
    
    tableContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #3498db;">
            <div class="spinner" style="display: inline-block; margin-right: 10px;"></div>
            <div>🔍 Buscando registros...</div>
            <div style="font-size: 12px; margin-top: 10px; color: #7f8c8d;">Aplicando filtros...</div>
            <div style="font-size: 11px; margin-top: 5px; color: #95a5a6;">${filtrosActivos.join(' | ')}</div>
        </div>
    `;
    
    try {
        const primaryKey = 'id_secuencia';
        
        // Debug: mostrar valores de filtros
        console.log('Filtros aplicados:', {
            direccionFiltro: direccionFiltro,
            direccionValida: direccionValida,
            nroInstalacionFiltro: nroInstalacionFiltro,
            instalacionValida: instalacionValida
        });
        
        // Construir consulta
        let query = supabase.from(TABLE_NAME).select('*');
        
        if (direccionValida) {
            console.log('Aplicando filtro de dirección:', direccionFiltro);
            query = query.ilike('direccion', `%${direccionFiltro}%`);
        }
        
        if (instalacionValida) {
            console.log('Aplicando filtro de instalación:', nroInstalacionFiltro);
            query = query.ilike('nro_instalacion', `%${nroInstalacionFiltro}%`);
        }
        
        // Ejecutar consulta sin ordenamiento para evitar timeout
        console.log('Ejecutando consulta en tabla:', TABLE_NAME);
        let { data, error } = await query.limit(100);
        
        console.log('Resultado de consulta:', { 
            registrosEncontrados: data ? data.length : 0, 
            error: error?.message 
        });
        
        if (error) {
            console.error('Error al filtrar secuencia_lectura:', error);
            let errorMessage = 'Error al buscar: ' + error.message;
            
            if (error.message.includes('timeout') || error.message.includes('canceling')) {
                errorMessage = 'Búsqueda muy lenta. Intente con filtros más específicos.';
            } else if (error.message.includes('connection')) {
                errorMessage = 'Error de conexión. Verifique su conexión a internet.';
            }
            
            tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">❌ ' + errorMessage + '</div>';
            return;
        }
        
        if (data && data.length > 0) {
            renderTable(data);
        } else {
            let filtroTexto = '';
            if (direccionValida && instalacionValida) {
                filtroTexto = `Dirección "${direccionFiltro}" e Instalación "${nroInstalacionFiltro}"`;
            } else if (direccionValida) {
                filtroTexto = `Dirección "${direccionFiltro}"`;
            } else if (instalacionValida) {
                filtroTexto = `Instalación "${nroInstalacionFiltro}"`;
            }
            tableContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: #e67e22;">📄 No se encontraron registros para ${filtroTexto}</div>`;
        }
    } catch (error) {
        console.error('Error al filtrar:', error);
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">❌ Error inesperado: ' + error.message + '</div>';
    } finally {
        // Rehabilitar botón
        if (btnBuscar) {
            btnBuscar.disabled = false;
            btnBuscar.textContent = '🔍 Buscar';
        }
    }
}

function clearFilters() {
    const direccionInput = document.getElementById('filtro-direccion');
    const instalacionInput = document.getElementById('filtro-nro-instalacion');
    const btnBuscar = document.getElementById('btn-buscar-secuencia');
    const tableContainer = document.getElementById('tableContainer');
    
    // Limpiar campos de filtro
    if (direccionInput) direccionInput.value = '';
    if (instalacionInput) instalacionInput.value = '';
    if (btnBuscar) {
        btnBuscar.disabled = true;
        btnBuscar.textContent = '🔍 Buscar';
    }
    
    // Limpiar completamente la tabla
    tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #95a5a6; font-style: italic;">📋 Use los filtros para buscar registros</div>';
}

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