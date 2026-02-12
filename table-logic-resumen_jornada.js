// Lógica específica para Resumen Jornada
const PRIMARY_KEY = 'supervisor';
// TABLE_NAME y TABLE_TITLE se definen en el HTML

// Variables globales
let supervisoresData = [];
let isLoading = false;

// Función para cargar datos
async function loadData() {
    console.log('🔄 Cargando datos de supervisores desde', TABLE_NAME);
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    
    if (!loadingIndicator || !tableContainer) {
        console.error('❌ Elementos DOM no encontrados');
        return;
    }
    
    if (isLoading) {
        console.log('⚠️ Ya hay una carga en proceso');
        return;
    }
    
    try {
        isLoading = true;
        loadingIndicator.style.display = 'block';
        tableContainer.innerHTML = '';
        
        console.log('📡 Consultando Supabase para obtener supervisores únicos...');
        
        // Obtener todos los registros de la tabla base para procesar los supervisores
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('supervisor, registro_salida')
            .limit(5000);
        
        if (error) {
            console.error('❌ Error de Supabase:', error);
            throw error;
        }
        
        console.log('✅ Datos obtenidos:', data?.length || 0, 'registros');
        
        // Procesar datos para obtener supervisores únicos y sus conteos
        const supervisorCount = {};
        const supervisorRegistrados = {};
        let totalValidRecords = 0;
        
        if (data && data.length > 0) {
            console.log('📋 Procesando', data.length, 'registros...');
            data.forEach(row => {
                const supervisor = row.supervisor;
                if (supervisor && supervisor !== null && supervisor !== undefined && supervisor.toString().trim() !== '') {
                    const supervisorName = supervisor.toString().trim();
                    supervisorCount[supervisorName] = (supervisorCount[supervisorName] || 0) + 1;
                    
                    // Inicializar contador de registrados si no existe
                    if (!supervisorRegistrados[supervisorName]) {
                        supervisorRegistrados[supervisorName] = 0;
                    }
                    
                    // Contar registrados (que tengan dato en registro_salida)
                    if (row.registro_salida && row.registro_salida.toString().trim() !== '') {
                        supervisorRegistrados[supervisorName]++;
                    }
                    
                    totalValidRecords++;
                }
            });
            console.log('✅ Registros válidos procesados:', totalValidRecords);
            console.log('👥 Supervisores únicos encontrados:', Object.keys(supervisorCount).length);
        } else {
            console.log('⚠️ No se encontraron datos en la tabla');
        }
        
        // Convertir a array y hacer consultas específicas por supervisor
        const supervisoresList = Object.entries(supervisorCount);
        
        // OPTIMIZACIÓN: Obtener TODOS los datos de control_descargas en UNA SOLA consulta
        console.log('🔍 Consultando tabla control_descargas completa...');
        const { data: descargasData, error: descargasError } = await supabase
            .from('control_descargas')
            .select('supervisor, pendientes');
        
        if (descargasError) {
            console.error('❌ Error al consultar control_descargas:', descargasError);
        }
        
        // Procesar datos de descargas por supervisor en JavaScript
        const descargasPorSupervisor = {};
        if (descargasData && descargasData.length > 0) {
            descargasData.forEach(row => {
                const sup = row.supervisor;
                if (!sup) return;
                
                if (!descargasPorSupervisor[sup]) {
                    descargasPorSupervisor[sup] = { confirmadas: 0, pendientes: 0 };
                }
                
                const pendientes = Number(row.pendientes) || 0;
                if (pendientes === 0) {
                    descargasPorSupervisor[sup].confirmadas++;
                } else {
                    descargasPorSupervisor[sup].pendientes++;
                }
            });
        }
        console.log('✅ Descargas procesadas para', Object.keys(descargasPorSupervisor).length, 'supervisores');
        
        supervisoresData = [];
        
        for (const [supervisor, cantidad] of supervisoresList) {
            const registrados = supervisorRegistrados[supervisor] || 0;
            const pendientes = cantidad - registrados;
            const porcentajeRegistrado = cantidad > 0 ? Math.round((registrados / cantidad) * 100) : 0;
            
            // Obtener datos de descargas desde el objeto procesado
            const descargas = descargasPorSupervisor[supervisor] || { confirmadas: 0, pendientes: 0 };
            const confirmadas = descargas.confirmadas;
            const pendientesDescargas = descargas.pendientes;
            
            // Calcular porcentaje descargado
            const totalDescargas = confirmadas + pendientesDescargas;
            const porcentajeDescargado = totalDescargas > 0 ? Math.round((confirmadas / totalDescargas) * 100) : 0;
            
            supervisoresData.push({
                supervisor: supervisor,
                cantidad: cantidad,
                registrados: registrados,
                pendientes: pendientes,
                porcentajeRegistrado: porcentajeRegistrado,
                descargasConfirmadas: confirmadas,
                descargasPendientes: pendientesDescargas,
                porcentajeDescargado: porcentajeDescargado,
                porcentaje: totalValidRecords > 0 ? Math.round((cantidad / totalValidRecords) * 100) : 0
            });
        }
        
        // Ordenar por supervisor
        supervisoresData.sort((a, b) => a.supervisor.localeCompare(b.supervisor));
        
        console.log('📊 Supervisores procesados:', supervisoresData.length);
        console.log('📈 Datos:', supervisoresData);
        
        renderTable();
        
    } catch (error) {
        console.error('❌ Error al cargar datos:', error);
        console.error('📋 Detalles del error:', error);
        
        let errorMessage = 'Error desconocido';
        if (error.message) {
            errorMessage = error.message;
        }
        
        tableContainer.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 2rem; color: #dc3545;">
                <h3>❌ Error al cargar los datos</h3>
                <p><strong>Mensaje:</strong> ${errorMessage}</p>
                <p><strong>Tabla:</strong> ${TABLE_NAME}</p>
                <button onclick="loadData()" class="btn btn-primary" style="margin-top: 1rem;">🔄 Reintentar</button>
            </div>
        `;
    } finally {
        console.log('🔄 Finalizando carga...');
        isLoading = false;
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}

// Función para renderizar tabla
function renderTable() {
    const tableContainer = document.getElementById('tableContainer');
    
    if (supervisoresData.length === 0) {
        tableContainer.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 3rem;">
                <h3>📭 No hay datos</h3>
                <p>No se encontraron supervisores registrados</p>
                <button onclick="loadData()" class="btn btn-primary">🔄 Actualizar</button>
            </div>
        `;
        return;
    }
    
    // Calcular totales para todas las columnas
    const totalRegistros = supervisoresData.reduce((sum, item) => sum + item.cantidad, 0);
    const totalRegistrados = supervisoresData.reduce((sum, item) => sum + item.registrados, 0);
    const totalPendientes = supervisoresData.reduce((sum, item) => sum + item.pendientes, 0);
    const totalDescargasConfirmadas = supervisoresData.reduce((sum, item) => sum + item.descargasConfirmadas, 0);
    const totalDescargasPendientes = supervisoresData.reduce((sum, item) => sum + item.descargasPendientes, 0);
    
    // Calcular promedios de porcentajes
    const promedioRegistrado = supervisoresData.length > 0 
        ? Math.round(supervisoresData.reduce((sum, item) => sum + item.porcentajeRegistrado, 0) / supervisoresData.length) 
        : 0;
    const promedioDescargado = supervisoresData.length > 0 
        ? Math.round(supervisoresData.reduce((sum, item) => sum + item.porcentajeDescargado, 0) / supervisoresData.length) 
        : 0;
    
    let tableHTML = `
        <div class="table-info" style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <span class="record-count">👥 ${supervisoresData.length} supervisores únicos</span>
            <span class="record-count">📊 ${totalRegistros} registros totales</span>
        </div>
        <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #475569;">
                        <th style="padding: 0.75rem; border: 1px solid #475569; text-align: left; color: #f1f5f9; font-weight: bold;">👤 Supervisor</th>
                        <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">📊 Cantidad</th>
                        <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">✅ Registrados</th>
                        <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">⏳ Pendientes por Registrar</th>
                        <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">📈 Porcentaje Registrado</th>
                        <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">⬇️ Descargas Confirmadas</th>
                        <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">⏰ Descargas Pendientes</th>
                        <th style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #f1f5f9; font-weight: bold;">📊 Porcentaje Descargado</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    supervisoresData.forEach((supervisor, index) => {        
        tableHTML += `
            <tr style="background: ${index % 2 === 0 ? '#1e293b' : '#334155'};">
                <td style="padding: 0.75rem; border: 1px solid #475569; font-weight: bold; color: #e2e8f0;">
                    ${supervisor.supervisor}
                </td>
                <td style="padding: 0.75rem; border: 1px solid #475569; text-align: center; font-weight: bold; color: #cbd5e1;">
                    ${supervisor.cantidad.toLocaleString()}
                </td>
                <td style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #22c55e; font-weight: bold;">
                    ${supervisor.registrados.toLocaleString()}
                </td>
                <td style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: ${supervisor.pendientes > 0 ? '#ef4444' : '#22c55e'}; font-weight: bold;">
                    ${supervisor.pendientes.toLocaleString()}
                </td>
                <td style="padding: 0.75rem; border: 1px solid #475569; text-align: center;">
                    <div style="display: flex; align-items: center; justify-content: center; flex-direction: column;">
                        <div style="background: #475569; border-radius: 10px; overflow: hidden; width: 80px; height: 18px; margin-bottom: 4px; position: relative;">
                            <div style="background: ${supervisor.porcentajeRegistrado >= 80 ? '#22c55e' : supervisor.porcentajeRegistrado >= 50 ? '#eab308' : '#ef4444'}; height: 100%; width: ${supervisor.porcentajeRegistrado}%; transition: width 0.5s ease; border-radius: 10px;"></div>
                        </div>
                        <span style="font-size: 0.75rem; font-weight: bold; color: ${supervisor.porcentajeRegistrado >= 80 ? '#22c55e' : supervisor.porcentajeRegistrado >= 50 ? '#eab308' : '#ef4444'};">
                            ${supervisor.porcentajeRegistrado}%
                        </span>
                    </div>
                </td>
                <td style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: #3b82f6; font-weight: bold;">
                    ${supervisor.descargasConfirmadas.toLocaleString()}
                </td>
                <td style="padding: 0.75rem; border: 1px solid #475569; text-align: center; color: ${supervisor.descargasPendientes > 0 ? '#eab308' : '#22c55e'}; font-weight: bold;">
                    ${supervisor.descargasPendientes.toLocaleString()}
                </td>
                <td style="padding: 0.75rem; border: 1px solid #475569; text-align: center;">
                    <div style="display: flex; align-items: center; justify-content: center; flex-direction: column;">
                        <div style="background: #475569; border-radius: 10px; overflow: hidden; width: 80px; height: 18px; margin-bottom: 4px; position: relative;">
                            <div style="background: ${supervisor.porcentajeDescargado >= 80 ? '#22c55e' : supervisor.porcentajeDescargado >= 50 ? '#eab308' : '#ef4444'}; height: 100%; width: ${supervisor.porcentajeDescargado}%; transition: width 0.5s ease; border-radius: 10px;"></div>
                        </div>
                        <span style="font-size: 0.75rem; font-weight: bold; color: ${supervisor.porcentajeDescargado >= 80 ? '#22c55e' : supervisor.porcentajeDescargado >= 50 ? '#eab308' : '#ef4444'};">
                            ${supervisor.porcentajeDescargado}%
                        </span>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
            </table>
        </div>
        
        <!-- Resumen estadístico -->
        <div style="margin-top: 2rem; padding: 1rem; background: #334155; border-radius: 0.5rem; border-left: 4px solid #3b82f6;">
            <h5 style="margin: 0 0 1rem 0; color: #f1f5f9;">📈 Resumen Estadístico - Totales</h5>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; color: #e2e8f0;">
                <div>
                    <strong style="color: #f1f5f9;">👥 Total Supervisores:</strong> ${supervisoresData.length}
                </div>
                <div>
                    <strong style="color: #f1f5f9;">📊 Total Cantidad:</strong> ${totalRegistros.toLocaleString()}
                </div>
                <div>
                    <strong style="color: #f1f5f9;">✅ Total Registrados:</strong> <span style="color: #22c55e;">${totalRegistrados.toLocaleString()}</span>
                </div>
                <div>
                    <strong style="color: #f1f5f9;">⏳ Total Pendientes Registrar:</strong> <span style="color: ${totalPendientes > 0 ? '#ef4444' : '#22c55e'};">${totalPendientes.toLocaleString()}</span>
                </div>
                <div>
                    <strong style="color: #f1f5f9;">📈 Promedio % Registrado:</strong> <span style="color: ${promedioRegistrado >= 80 ? '#22c55e' : promedioRegistrado >= 50 ? '#eab308' : '#ef4444'};">${promedioRegistrado}%</span>
                </div>
                <div>
                    <strong style="color: #f1f5f9;">⬇️ Total Descargas Confirmadas:</strong> <span style="color: #3b82f6;">${totalDescargasConfirmadas.toLocaleString()}</span>
                </div>
                <div>
                    <strong style="color: #f1f5f9;">⏰ Total Descargas Pendientes:</strong> <span style="color: ${totalDescargasPendientes > 0 ? '#eab308' : '#22c55e'};">${totalDescargasPendientes.toLocaleString()}</span>
                </div>
                <div>
                    <strong style="color: #f1f5f9;">📊 Promedio % Descargado:</strong> <span style="color: ${promedioDescargado >= 80 ? '#22c55e' : promedioDescargado >= 50 ? '#eab308' : '#ef4444'};">${promedioDescargado}%</span>
                </div>
            </div>
        </div>
    `;
    
    tableContainer.innerHTML = tableHTML;
}

// Función para formatear valores
function formatValue(value, columnName) {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (typeof value === 'number') return value.toLocaleString();
    
    const str = String(value);
    return str.length > 50 ? str.substring(0, 50) + '...' : str;
}

// Función para manejar errores
function handleError(error, context) {
    console.error(`❌ Error ${context}:`, error);
    const message = error.message || 'Error desconocido';
    alert(`Error ${context}: ${message}`);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando aplicación de Resumen Jornada...');
    
    // Check if supabase is available
    if (!window.supabase) {
        console.error('❌ Supabase no disponible');
        const tableContainer = document.getElementById('tableContainer');
        if (tableContainer) {
            tableContainer.innerHTML = '<div style="color: red; text-align: center; padding: 2rem;">❌ Error: Supabase no está disponible</div>';
        }
        return;
    }
    
    console.log('✅ Supabase disponible');
    console.log('🔧 Configuración:', { TABLE_NAME, PRIMARY_KEY });
    
    // Add a small delay to ensure everything is loaded
    setTimeout(() => {
        console.log('⏰ Iniciando carga de datos...');
        loadData();
    }, 100);
});

// Función para exportar múltiples tablas a Excel
async function exportarTablas() {
    try {
        // Mostrar mensaje de carga
        const loadingMsg = document.createElement('div');
        loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px 40px; border-radius: 10px; z-index: 10000; font-size: 1.1rem;';
        loadingMsg.innerHTML = '📊 Generando archivo Excel...';
        document.body.appendChild(loadingMsg);
        
        // Crear un nuevo workbook
        const wb = XLSX.utils.book_new();
        
        // Lista de tablas a exportar desde Supabase
        const tablas = [
            { nombre: 'base', sheetName: 'Base' },
            { nombre: 'programacion_lectura', sheetName: 'Programacion Lectura' },
            { nombre: 'control_descargas', sheetName: 'Control Descargas' },
            { nombre: 'cmlec', sheetName: 'CMLEC' }
        ];
        
        // Exportar cada tabla desde Supabase
        for (const tabla of tablas) {
            loadingMsg.innerHTML = `📊 Exportando tabla: ${tabla.sheetName}...`;
            
            // Consultar todos los datos de la tabla
            const { data, error } = await supabase
                .from(tabla.nombre)
                .select('*');
            
            if (error) {
                console.error(`Error al obtener datos de ${tabla.nombre}:`, error);
                alert(`❌ Error al obtener datos de ${tabla.nombre}: ${error.message}`);
                continue;
            }
            
            if (data && data.length > 0) {
                const ws = XLSX.utils.json_to_sheet(data);
                XLSX.utils.book_append_sheet(wb, ws, tabla.sheetName);
                console.log(`✅ Exportados ${data.length} registros de ${tabla.nombre}`);
            } else {
                console.log(`⚠️ No hay datos en la tabla ${tabla.nombre}`);
            }
        }
        
        // Agregar hoja con el resumen de jornada (datos procesados)
        loadingMsg.innerHTML = '📊 Exportando Resumen Jornada...';
        if (supervisoresData && supervisoresData.length > 0) {
            const ws = XLSX.utils.json_to_sheet(supervisoresData);
            XLSX.utils.book_append_sheet(wb, ws, 'Resumen Jornada');
            console.log(`✅ Exportados ${supervisoresData.length} supervisores en Resumen Jornada`);
        } else {
            console.log('⚠️ No hay datos de supervisores para exportar');
        }
        
        // Generar nombre del archivo con fecha actual
        const fecha = new Date();
        const fechaStr = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
        const fileName = `Export_Tablas_${fechaStr}.xlsx`;
        
        // Descargar el archivo
        loadingMsg.innerHTML = '💾 Descargando archivo...';
        XLSX.writeFile(wb, fileName);
        
        // Remover mensaje de carga
        document.body.removeChild(loadingMsg);
        
        // Mostrar mensaje de éxito
        const successMsg = document.createElement('div');
        successMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(34, 197, 94, 0.95); color: white; padding: 20px 40px; border-radius: 10px; z-index: 10000; font-size: 1.1rem;';
        successMsg.innerHTML = '✅ Exportación completada';
        document.body.appendChild(successMsg);
        
        setTimeout(() => {
            document.body.removeChild(successMsg);
        }, 2000);
        
    } catch (error) {
        console.error('Error al exportar tablas:', error);
        const loadingMsg = document.querySelector('div[style*="Generando archivo"]');
        if (loadingMsg && loadingMsg.parentNode) {
            document.body.removeChild(loadingMsg);
        }
        alert('❌ Error al exportar tablas: ' + error.message);
    }
}

// Función para abrir modal compacto
function abrirModalCompacto() {
    const modal = document.getElementById('modalCompacto');
    const modalBody = document.getElementById('modalCompactoBody');
    
    if (supervisoresData.length === 0) {
        alert('⚠️ No hay datos para mostrar. Por favor actualiza primero.');
        return;
    }
    
    // Calcular totales
    const totalCantidad = supervisoresData.reduce((sum, item) => sum + item.cantidad, 0);
    const totalRegistrados = supervisoresData.reduce((sum, item) => sum + item.registrados, 0);
    const totalPendientes = supervisoresData.reduce((sum, item) => sum + item.pendientes, 0);
    const totalConfirmadas = supervisoresData.reduce((sum, item) => sum + item.descargasConfirmadas, 0);
    const totalPendientesDesc = supervisoresData.reduce((sum, item) => sum + item.descargasPendientes, 0);
    
    const promedioRegistrado = totalCantidad > 0 ? Math.round((totalRegistrados / totalCantidad) * 100) : 0;
    const totalDescargas = totalConfirmadas + totalPendientesDesc;
    const promedioDescargado = totalDescargas > 0 ? Math.round((totalConfirmadas / totalDescargas) * 100) : 0;
    
    let html = `
        <div style="font-size: 0.6rem;">
            <table style="width: auto; border-collapse: collapse; border: 2px solid #475569; margin: 0 auto;">
                <thead>
                    <tr style="background: #475569; color: white;">
                        <th style="padding: 0.2rem 0.15rem; border: 1px solid #475569; font-size: 0.6rem; text-align: center; width: 50px;">Supervisor</th>
                        <th style="padding: 0.2rem 0.15rem; border: 1px solid #475569; font-size: 0.6rem; text-align: center; width: 35px;">Cantidad</th>
                        <th style="padding: 0.2rem 0.15rem; border: 1px solid #475569; font-size: 0.6rem; text-align: center; width: 35px;">Registrados</th>
                        <th style="padding: 0.2rem 0.15rem; border: 1px solid #475569; font-size: 0.6rem; text-align: center; width: 35px;">Pend.<br>Registrar</th>
                        <th style="padding: 0.2rem 0.15rem; border: 1px solid #475569; font-size: 0.6rem; text-align: center; width: 35px;">%<br>Registrado</th>
                        <th style="padding: 0.2rem 0.15rem; border: 1px solid #475569; font-size: 0.6rem; text-align: center; width: 35px;">Desc.<br>Confirmadas</th>
                        <th style="padding: 0.2rem 0.15rem; border: 1px solid #475569; font-size: 0.6rem; text-align: center; width: 35px;">Desc.<br>Pendientes</th>
                        <th style="padding: 0.2rem 0.15rem; border: 1px solid #475569; font-size: 0.6rem; text-align: center; width: 35px;">%<br>Descargado</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    supervisoresData.forEach((sup, index) => {
        html += `
            <tr style="background: ${index % 2 === 0 ? '#1e293b' : '#334155'};">
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569; font-weight: bold; font-size: 0.6rem; width: 50px; color: #e2e8f0;">${sup.supervisor}</td>
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569; text-align: center; font-size: 0.6rem; width: 35px; color: #cbd5e1;">${sup.cantidad}</td>
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569; text-align: center; font-size: 0.6rem; color: #22c55e; font-weight: bold; width: 35px;">${sup.registrados}</td>
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569; text-align: center; font-size: 0.6rem; color: ${sup.pendientes > 0 ? '#ef4444' : '#22c55e'}; font-weight: bold; width: 35px;">${sup.pendientes}</td>
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569; text-align: center; font-size: 0.6rem; font-weight: bold; width: 35px; color: #e2e8f0;">${sup.porcentajeRegistrado}%</td>
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569; text-align: center; font-size: 0.6rem; color: #22c55e; font-weight: bold; width: 35px;">${sup.descargasConfirmadas}</td>
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569; text-align: center; font-size: 0.6rem; color: ${sup.descargasPendientes > 0 ? '#ef4444' : '#22c55e'}; font-weight: bold; width: 35px;">${sup.descargasPendientes}</td>
                <td style="padding: 0.15rem 0.2rem; border: 1px solid #475569; text-align: center; font-size: 0.6rem; font-weight: bold; width: 35px; color: #e2e8f0;">${sup.porcentajeDescargado}%</td>
            </tr>
        `;
    });
    
    // Fila de totales
    html += `
                <tr style="background: #475569; color: white; font-weight: bold;">
                    <td style="padding: 0.2rem 0.2rem; border: 2px solid #475569; text-align: center; font-size: 0.65rem; width: 50px;">TOTALES</td>
                    <td style="padding: 0.2rem 0.15rem; border: 2px solid #475569; text-align: center; font-size: 0.65rem; width: 35px;">${totalCantidad}</td>
                    <td style="padding: 0.2rem 0.15rem; border: 2px solid #475569; text-align: center; font-size: 0.65rem; width: 35px;">${totalRegistrados}</td>
                    <td style="padding: 0.2rem 0.15rem; border: 2px solid #475569; text-align: center; font-size: 0.65rem; width: 35px;">${totalPendientes}</td>
                    <td style="padding: 0.2rem 0.15rem; border: 2px solid #475569; text-align: center; font-size: 0.65rem; width: 35px;">${promedioRegistrado}%</td>
                    <td style="padding: 0.2rem 0.15rem; border: 2px solid #475569; text-align: center; font-size: 0.65rem; width: 35px;">${totalConfirmadas}</td>
                    <td style="padding: 0.2rem 0.15rem; border: 2px solid #475569; text-align: center; font-size: 0.65rem; width: 35px;">${totalPendientesDesc}</td>
                    <td style="padding: 0.2rem 0.15rem; border: 2px solid #475569; text-align: center; font-size: 0.65rem; width: 35px;">${promedioDescargado}%</td>
                </tr>
            </tbody>
        </table>
        
        <div style="margin-top: 0.8rem; text-align: center; color: #94a3b8; font-size: 0.65rem;">
            💡 Tip: Usa la tecla "Impr Pant" o captura de pantalla para compartir por WhatsApp
        </div>
    </div>
    `;
    
    modalBody.innerHTML = html;
    modal.style.display = 'flex';
}

// Función para cerrar modal compacto
function cerrarModalCompacto() {
    const modal = document.getElementById('modalCompacto');
    modal.style.display = 'none';
}