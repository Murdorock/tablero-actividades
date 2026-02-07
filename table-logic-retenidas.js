// Configuración de la tabla
const TABLE_NAME = 'consulta_retenidos';
const BATCH_SIZE = 1000; // Registros por lote
let excelData = null;

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    // Configurar input de archivo
    const fileInput = document.getElementById('excelFileInput');
    fileInput.addEventListener('change', handleFileSelect);
    
    // Configurar drag & drop
    const dropZone = document.getElementById('dropZone');
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#3498db';
        dropZone.style.background = '#e8f4f8';
    });
    
    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#bdc3c7';
        dropZone.style.background = '#f8f9fa';
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#bdc3c7';
        dropZone.style.background = '#f8f9fa';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelect({ target: fileInput });
        }
    });
    
    // Cargar estadísticas iniciales
    obtenerEstadisticas();
});

// Manejar selección de archivo
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Mostrar información del archivo
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);
    document.getElementById('fileInfo').style.display = 'block';
    
    // Leer archivo
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Obtener la primera hoja
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // Convertir a JSON
            excelData = XLSX.utils.sheet_to_json(firstSheet);
            
            // Mostrar total de filas
            document.getElementById('totalRows').textContent = excelData.length.toLocaleString();
            document.getElementById('uploadBtn').disabled = false;
            
            showStatus(`✅ Archivo cargado: ${excelData.length.toLocaleString()} filas detectadas`, 'success');
            
        } catch (error) {
            console.error('Error al leer el archivo:', error);
            showStatus('❌ Error al leer el archivo Excel', 'error');
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// Procesar y subir datos
async function processAndUpload() {
    if (!excelData || excelData.length === 0) {
        showStatus('⚠️ No hay datos para cargar', 'warning');
        return;
    }
    
    // Confirmar acción
    const confirmMsg = `¿Está seguro de cargar ${excelData.length.toLocaleString()} registros a la tabla ${TABLE_NAME}?`;
    if (!confirm(confirmMsg)) return;
    
    // Deshabilitar botón
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.disabled = true;
    
    // Mostrar progreso
    document.getElementById('importProgress').style.display = 'block';
    
    try {
        const totalRows = excelData.length;
        let processedRows = 0;
        let errorCount = 0;
        const startTime = Date.now();
        
        // Procesar en lotes
        for (let i = 0; i < totalRows; i += BATCH_SIZE) {
            const batch = excelData.slice(i, i + BATCH_SIZE);
            
            // Transformar datos al formato de Supabase
            const transformedBatch = batch.map(row => ({
                instalacion: row.instalacion ? String(row.instalacion).trim() : null,
                contrato: row.contrato ? String(row.contrato).trim() : null,
                retenidas: row.retenidas ? String(row.retenidas).trim() : null,
                personalizado: row.personalizado ? String(row.personalizado).trim() : null
            }));
            
            // Insertar lote
            try {
                const { data, error } = await supabase
                    .from(TABLE_NAME)
                    .insert(transformedBatch);
                
                if (error) {
                    console.error('Error en lote:', error);
                    errorCount += batch.length;
                }
                
            } catch (error) {
                console.error('Error al insertar lote:', error);
                errorCount += batch.length;
            }
            
            // Actualizar progreso
            processedRows += batch.length;
            const progress = Math.min((processedRows / totalRows) * 100, 100);
            updateProgress(progress, processedRows, totalRows, startTime);
            
            // Pequeña pausa para no saturar
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Finalizar
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        if (errorCount === 0) {
            showStatus(
                `✅ Carga completada exitosamente: ${processedRows.toLocaleString()} registros en ${duration}s`,
                'success'
            );
        } else {
            showStatus(
                `⚠️ Carga completada con errores: ${(processedRows - errorCount).toLocaleString()} exitosos, ${errorCount.toLocaleString()} fallidos`,
                'warning'
            );
        }
        
        // Actualizar estadísticas
        setTimeout(() => {
            obtenerEstadisticas();
        }, 1000);
        
    } catch (error) {
        console.error('Error durante la carga:', error);
        showStatus('❌ Error durante la carga de datos', 'error');
    } finally {
        uploadBtn.disabled = false;
    }
}

// Actualizar barra de progreso
function updateProgress(percentage, processed, total, startTime) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const progressDetails = document.getElementById('progressDetails');
    
    progressBar.style.width = percentage + '%';
    progressText.textContent = percentage.toFixed(1) + '%';
    
    // Calcular tiempo estimado
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processed / elapsed;
    const remaining = total - processed;
    const eta = remaining / rate;
    
    progressDetails.textContent = 
        `${processed.toLocaleString()} / ${total.toLocaleString()} registros | ` +
        `Velocidad: ${Math.round(rate)} reg/s | ` +
        `ETA: ${formatTime(eta)}`;
}

// Obtener estadísticas de la tabla
async function obtenerEstadisticas() {
    try {
        // Contar registros
        const { count, error } = await supabase
            .from(TABLE_NAME)
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error('Error al obtener estadísticas:', error);
            document.getElementById('totalRecords').textContent = 'Error';
        } else {
            document.getElementById('totalRecords').textContent = count ? count.toLocaleString() : '0';
        }
        
        // Actualizar fecha
        document.getElementById('lastUpdate').textContent = new Date().toLocaleString('es-ES');
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('totalRecords').textContent = 'Error';
    }
}

// Limpiar toda la tabla
async function limpiarTabla() {
    const confirmMsg = '⚠️ ADVERTENCIA: Esta acción eliminará TODOS los registros de la tabla. ¿Está seguro?';
    if (!confirm(confirmMsg)) return;
    
    const confirmMsg2 = '⚠️ ÚLTIMA CONFIRMACIÓN: Se eliminarán todos los datos. ¿Continuar?';
    if (!confirm(confirmMsg2)) return;
    
    try {
        showStatus('🔄 Limpiando tabla...', 'info');
        
        // Eliminar todos los registros
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .neq('id_retenidos', '00000000-0000-0000-0000-000000000000'); // Esto eliminará todos
        
        if (error) {
            console.error('Error al limpiar tabla:', error);
            showStatus('❌ Error al limpiar la tabla', 'error');
        } else {
            showStatus('✅ Tabla limpiada exitosamente', 'success');
            obtenerEstadisticas();
        }
        
    } catch (error) {
        console.error('Error:', error);
        showStatus('❌ Error al limpiar la tabla', 'error');
    }
}

// Mostrar mensajes de estado
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('importStatus');
    statusDiv.style.display = 'block';
    statusDiv.textContent = message;
    
    // Colores según tipo
    const colors = {
        success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724' },
        error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24' },
        warning: { bg: '#fff3cd', border: '#ffeaa7', text: '#856404' },
        info: { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460' }
    };
    
    const color = colors[type] || colors.info;
    statusDiv.style.background = color.bg;
    statusDiv.style.borderLeft = `4px solid ${color.border}`;
    statusDiv.style.color = color.text;
    statusDiv.style.padding = '1rem';
    statusDiv.style.borderRadius = '4px';
}

// Formatear tamaño de archivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Formatear tiempo
function formatTime(seconds) {
    if (!isFinite(seconds)) return '---';
    
    if (seconds < 60) {
        return Math.round(seconds) + 's';
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return `${mins}m ${secs}s`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
    }
}
