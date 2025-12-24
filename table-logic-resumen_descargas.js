// Configuración para Resumen de Descargas
// Esta vista muestra un resumen estadístico y no usa una tabla de Supabase directamente

let resumenData = {};
let tieneEvidenciasHoy = false;



// Cargar datos del resumen
async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    
    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';
    

    
    try {
        // Aquí se calculará la lógica de cada campo
        // Por ahora inicializamos con valores por defecto
        resumenData = {
            ciclo: '01',
            totalCorrerias: 0,
            correriasEjecutadas: 0,
            correriasPendientesDescargar: 0,
            ordenesTotales: 0,
            cantidadOrdenesDescargadas: 0,
            ordenesPendientesDescargar: 0,
            ordenesPendientesLegalizar: 0,
            porcentajeEjecutado: '0.00%',
            porcentajePendiente: '0.00%',
            mesFacturacion: 'ENERO',
            cicloRelecturas: '1',
            novedadesLectura: 'Sin Novedad',
            novedadesReparto: 'Sin Novedad',
            novedadesRelecturas: 'Sin Novedad'
        };
        
        // Aquí irá la lógica para obtener los datos reales
        await calcularResumen();
        
        // Verificar si hay evidencias con fecha de hoy
        await verificarEvidenciasHoy();
        
        renderTable();
    } catch (error) {
        console.error('Error cargando resumen:', error);
        tableContainer.innerHTML = '<div class="error">Error cargando resumen: ' + error.message + '</div>';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Función para calcular el resumen
async function calcularResumen() {
    try {

        
        // CICLO: Extraer dígitos 5 y 6 del primer dato de correria_mp de la tabla cmlec
        const { data: cmlecData, error: cmlecError } = await supabase
            .from('cmlec')
            .select('correria_mp')
            .limit(1);
        
        if (!cmlecError && cmlecData && cmlecData.length > 0 && cmlecData[0].correria_mp) {
            const correriaMp = cmlecData[0].correria_mp.toString();
            if (correriaMp.length >= 6) {
                resumenData.ciclo = correriaMp.substring(4, 6); // Dígitos 5 y 6 (índices 4 y 5)
            }
        }
        
        // TOTAL CORRERIAS: Contar el número de filas de la columna correria_mp de la tabla cmlec
        const { count: totalCorrerias, error: countError } = await supabase
            .from('cmlec')
            .select('correria_mp', { count: 'exact', head: true });
        
        if (!countError && totalCorrerias !== null) {
            resumenData.totalCorrerias = totalCorrerias;
        }
        
        // CORRERIAS EJECUTADAS: Contar el número de filas donde ordenes_descargar = 0
        const { count: correriasEjecutadas, error: ejecutadasError } = await supabase
            .from('cmlec')
            .select('ordenes_descargar', { count: 'exact', head: true })
            .eq('ordenes_descargar', 0);
        
        if (!ejecutadasError && correriasEjecutadas !== null) {
            resumenData.correriasEjecutadas = correriasEjecutadas;
        }
        
        // CORRERIAS PENDIENTES POR DESCARGAR: Total - Ejecutadas
        resumenData.correriasPendientesDescargar = resumenData.totalCorrerias - resumenData.correriasEjecutadas;
        
        // ORDENES TOTALES: Sumar toda la columna totales de la tabla control_descargas
        const queryTotales = supabase
            .from('control_descargas')
            .select('totales');
        
        const { data: controlDescargasData, error: controlError } = await queryTotales;
        
        if (!controlError && controlDescargasData) {
            console.log('Datos de control_descargas para totales:', controlDescargasData.length, 'registros');
            resumenData.ordenesTotales = controlDescargasData.reduce((sum, row) => {
                const valor = Number(row.totales) || 0;
                console.log('Total del registro:', row.totales, '-> convertido:', valor);
                return sum + valor;
            }, 0);
            console.log('Ordenes totales calculado:', resumenData.ordenesTotales);
        } else if (controlError) {
            console.error('Error en consulta de totales:', controlError);
        }
        
        // CANTIDAD ORDENES DESCARGADAS: Sumar la columna descargadas de la tabla control_descargas
        const queryDescargadas = supabase
            .from('control_descargas')
            .select('descargadas');
        
        const { data: descargadasData, error: descargadasError } = await queryDescargadas;
        
        if (!descargadasError && descargadasData) {
            resumenData.cantidadOrdenesDescargadas = descargadasData.reduce((sum, row) => {
                return sum + (Number(row.descargadas) || 0);
            }, 0);
        }
        
        // ORDENES PENDIENTES POR DESCARGAR: Ordenes Totales - Cantidad Ordenes Descargadas
        resumenData.ordenesPendientesDescargar = resumenData.ordenesTotales - resumenData.cantidadOrdenesDescargadas;
        
        // ORDENES PENDIENTES POR LEGALIZAR: Sumar la columna ordenes_legalizar de la tabla cmlec
        const { data: legalizarData, error: legalizarError } = await supabase
            .from('cmlec')
            .select('ordenes_legalizar');
        
        if (!legalizarError && legalizarData) {
            resumenData.ordenesPendientesLegalizar = legalizarData.reduce((sum, row) => {
                return sum + (Number(row.ordenes_legalizar) || 0);
            }, 0);
        }
        
        // PORCENTAJE EJECUTADO: (Cantidad Ordenes Descargadas / Ordenes Totales) * 100
        if (resumenData.ordenesTotales > 0) {
            const porcentaje = (resumenData.cantidadOrdenesDescargadas / resumenData.ordenesTotales) * 100;
            resumenData.porcentajeEjecutado = porcentaje.toFixed(2) + '%';
            
            // PORCENTAJE PENDIENTE: 100% - Porcentaje Ejecutado
            const porcentajePendiente = 100 - porcentaje;
            resumenData.porcentajePendiente = porcentajePendiente.toFixed(2) + '%';
        } else {
            resumenData.porcentajeEjecutado = '0.00%';
            resumenData.porcentajePendiente = '100.00%';
        }
        
        // CICLO RELECTURAS/INCONSISTENCIAS: Valores únicos de la columna ciclo de la tabla inconsistencias
        const { data: inconsistenciasData, error: inconsistenciasError } = await supabase
            .from('inconsistencias')
            .select('ciclo');
        
        if (!inconsistenciasError && inconsistenciasData) {
            const ciclosUnicos = [...new Set(inconsistenciasData
                .map(row => row.ciclo)
                .filter(ciclo => ciclo !== null && ciclo !== undefined && ciclo !== ''))]
                .sort((a, b) => a - b);
            
            resumenData.cicloRelecturas = ciclosUnicos.length > 0 ? ciclosUnicos.join(' - ') : '1';
        }
        
        // MES FACTURACION: Calcular según el ciclo y la fecha actual del sistema
        // Lógica: Ciclos 01-10 → mes siguiente, Ciclos 11-20 → mes actual
        const cicloNum = parseInt(resumenData.ciclo);
        const fechaActual = new Date();
        let mesFacturacion = fechaActual.getMonth(); // 0=enero, 11=diciembre
        
        // Si el ciclo está entre 01 y 10, el mes de facturación es el siguiente
        if (cicloNum >= 1 && cicloNum <= 10) {
            mesFacturacion = mesFacturacion + 1;
            // Si llegamos a diciembre + 1, volvemos a enero
            if (mesFacturacion > 11) {
                mesFacturacion = 0;
            }
        }
        
        // Convertir número de mes a nombre
        const nombresMeses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                              'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        resumenData.mesFacturacion = nombresMeses[mesFacturacion];
        
    } catch (error) {
        console.error('Error calculando resumen:', error);
    }
}

// Verificar si hay evidencias con fecha de hoy
async function verificarEvidenciasHoy() {
    try {
        const hoy = new Date();
        const year = hoy.getFullYear();
        const month = String(hoy.getMonth() + 1).padStart(2, '0');
        const day = String(hoy.getDate()).padStart(2, '0');
        const fechaHoy = `${year}-${month}-${day}`;
        
        const { data, error } = await supabase
            .from('evidencias')
            .select('id, fecha');
        
        if (!error && data) {
            // Filtrar manualmente los registros que coincidan con la fecha de hoy
            const evidenciasHoy = data.filter(item => {
                if (!item.fecha) return false;
                const fechaItem = new Date(item.fecha);
                const fechaItemStr = `${fechaItem.getFullYear()}-${String(fechaItem.getMonth() + 1).padStart(2, '0')}-${String(fechaItem.getDate()).padStart(2, '0')}`;
                return fechaItemStr === fechaHoy;
            });
            
            tieneEvidenciasHoy = evidenciasHoy.length > 0;
            console.log('Evidencias hoy:', evidenciasHoy.length, 'Fecha buscada:', fechaHoy);
        } else {
            tieneEvidenciasHoy = false;
        }
    } catch (error) {
        console.error('Error verificando evidencias:', error);
        tieneEvidenciasHoy = false;
    }
}

// Renderizar tabla de resumen
function renderTable() {
    const tableContainer = document.getElementById('tableContainer');
    
    let html = '<div style="overflow-x: auto;">';
    html += '<table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem; border: 2px solid #333;">';
    
    // Encabezados
    html += '<thead>';
    html += '<tr>';
    html += '<th style="padding: 0.8rem 0.5rem; border: 2px solid #333; font-weight: bold; min-width: 50px; background: #607d8b; color: #fff; text-align: center;">Ciclo</th>';
    html += '<th style="padding: 0.8rem 0.5rem; border: 2px solid #333; font-weight: bold; min-width: 80px; background: #607d8b; color: #fff; text-align: center;">Total<br>correrias</th>';
    html += '<th style="padding: 0.8rem 0.5rem; border: 2px solid #333; font-weight: bold; min-width: 90px; background: #607d8b; color: #fff; text-align: center;">Correrias<br>ejecutadas</th>';
    html += '<th style="padding: 0.8rem 0.5rem; border: 2px solid #333; font-weight: bold; min-width: 100px; background: #607d8b; color: #fff; text-align: center;">Correrias<br>pendientes por<br>descargar</th>';
    html += '<th style="padding: 0.8rem 0.5rem; border: 2px solid #333; font-weight: bold; min-width: 80px; background: #607d8b; color: #fff; text-align: center;">Ordenes<br>totales</th>';
    html += '<th style="padding: 0.8rem 0.5rem; border: 2px solid #333; font-weight: bold; min-width: 90px; background: #607d8b; color: #fff; text-align: center;">Cantidad<br>ordenes<br>descargadas</th>';
    html += '<th style="padding: 0.8rem 0.5rem; border: 2px solid #333; font-weight: bold; min-width: 100px; background: #607d8b; color: #fff; text-align: center;">Ordenes<br>pendiente por<br>descargar</th>';
    html += '<th style="padding: 0.8rem 0.5rem; border: 2px solid #333; font-weight: bold; min-width: 100px; background: #607d8b; color: #fff; text-align: center;">Ordenes<br>pendientes por<br>legalizar</th>';
    html += '<th style="padding: 0.8rem 0.5rem; border: 2px solid #333; font-weight: bold; min-width: 90px; background: #607d8b; color: #fff; text-align: center;">Porcentaje<br>ejecutado</th>';
    html += '<th style="padding: 0.8rem 0.5rem; border: 2px solid #333; font-weight: bold; min-width: 90px; background: #607d8b; color: #fff; text-align: center;">Porcentaje<br>pendiente</th>';
    html += '<th style="padding: 0.8rem 0.5rem; border: 2px solid #333; font-weight: bold; min-width: 80px; background: #607d8b; color: #fff; text-align: center;">Mes<br>facturación</th>';
    html += '<th style="padding: 0.8rem 0.5rem; border: 2px solid #333; font-weight: bold; min-width: 90px; background: #607d8b; color: #fff; text-align: center;">Ciclo<br>Relecturas /<br>inconsistencias</th>';
    html += '</tr>';
    html += '</thead>';
    
    // Fila de datos
    html += '<tbody>';
    html += '<tr style="background: #fff;">';
    html += `<td style="padding: 0.6rem 0.5rem; border: 2px solid #333; text-align: center;">${resumenData.ciclo}</td>`;
    html += `<td style="padding: 0.6rem 0.5rem; border: 2px solid #333; text-align: center;">${resumenData.totalCorrerias.toLocaleString()}</td>`;
    html += `<td style="padding: 0.6rem 0.5rem; border: 2px solid #333; text-align: center;">${resumenData.correriasEjecutadas.toLocaleString()}</td>`;
    html += `<td style="padding: 0.6rem 0.5rem; border: 2px solid #333; text-align: center;">${resumenData.correriasPendientesDescargar.toLocaleString()}</td>`;
    html += `<td style="padding: 0.6rem 0.5rem; border: 2px solid #333; text-align: center;">${resumenData.ordenesTotales.toLocaleString()}</td>`;
    html += `<td style="padding: 0.6rem 0.5rem; border: 2px solid #333; text-align: center;">${resumenData.cantidadOrdenesDescargadas.toLocaleString()}</td>`;
    html += `<td style="padding: 0.6rem 0.5rem; border: 2px solid #333; text-align: center;">${resumenData.ordenesPendientesDescargar.toLocaleString()}</td>`;
    html += `<td style="padding: 0.6rem 0.5rem; border: 2px solid #333; text-align: center;">${resumenData.ordenesPendientesLegalizar.toLocaleString()}</td>`;
    html += `<td style="padding: 0.6rem 0.5rem; border: 2px solid #333; text-align: center;">${resumenData.porcentajeEjecutado}</td>`;
    html += `<td style="padding: 0.6rem 0.5rem; border: 2px solid #333; text-align: center;">${resumenData.porcentajePendiente}</td>`;
    html += `<td style="padding: 0.6rem 0.5rem; border: 2px solid #333; text-align: center;">${resumenData.mesFacturacion}</td>`;
    html += `<td style="padding: 0.6rem 0.5rem; border: 2px solid #333; text-align: center;">${resumenData.cicloRelecturas}</td>`;
    html += '</tr>';
    html += '</tbody>';
    
    html += '</table>';
    html += '</div>';
    
    // Sección de novedades (debajo de la tabla)
    html += '<div style="margin-top: 2rem; max-width: 1200px; margin-left: auto; margin-right: auto;">';
    html += '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">';
    
    // Novedades Lectura
    html += '<div>';
    html += '<label style="display: block; font-weight: bold; margin-bottom: 0.5rem; color: #1e3a5f;">NOVEDADES LECTURA</label>';
    html += `<textarea id="novedadesLectura" class="form-control" style="width: 100%; min-height: 120px; resize: vertical; padding: 0.5rem; font-size: 0.9rem; border: 1px solid #ddd; border-radius: 4px;">${resumenData.novedadesLectura}</textarea>`;
    html += '</div>';
    
    // Novedades Reparto
    html += '<div>';
    html += '<label style="display: block; font-weight: bold; margin-bottom: 0.5rem; color: #1e3a5f;">NOVEDADES REPARTO</label>';
    html += `<textarea id="novedadesReparto" class="form-control" style="width: 100%; min-height: 120px; resize: vertical; padding: 0.5rem; font-size: 0.9rem; border: 1px solid #ddd; border-radius: 4px;">${resumenData.novedadesReparto}</textarea>`;
    html += '</div>';
    
    // Novedades Relecturas
    html += '<div>';
    html += '<label style="display: block; font-weight: bold; margin-bottom: 0.5rem; color: #1e3a5f;">NOVEDADES RELECTURAS</label>';
    html += `<textarea id="novedadesRelecturas" class="form-control" style="width: 100%; min-height: 120px; resize: vertical; padding: 0.5rem; font-size: 0.9rem; border: 1px solid #ddd; border-radius: 4px;">${resumenData.novedadesRelecturas}</textarea>`;
    html += '</div>';
    
    html += '</div>';
    html += '</div>';
    
    // Agregar botón de generar PDF si hay evidencias de hoy
    if (tieneEvidenciasHoy) {
        html += `
            <div style="margin-top: 20px; text-align: center;">
                <button class="btn btn-primary" onclick="generarPDFEvidencias()" style="padding: 10px 20px; font-size: 1rem;">
                    📄 Generar PDF Evidencias
                </button>
            </div>
        `;
    }
    
    tableContainer.innerHTML = html;
}

// Función para generar PDF de evidencias
async function generarPDFEvidencias() {
    try {
        // Mostrar mensaje de carga
        const loadingMsg = document.createElement('div');
        loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px 40px; border-radius: 10px; z-index: 10000;';
        loadingMsg.innerHTML = '📄 Generando PDF...';
        document.body.appendChild(loadingMsg);
        
        // Obtener evidencias de hoy
        const hoy = new Date();
        const year = hoy.getFullYear();
        const month = String(hoy.getMonth() + 1).padStart(2, '0');
        const day = String(hoy.getDate()).padStart(2, '0');
        const fechaHoy = `${year}-${month}-${day}`;
        
        const { data: evidencias, error } = await supabase
            .from('evidencias')
            .select('*')
            .order('fecha', { ascending: true });
        
        if (error) {
            throw new Error('Error al cargar evidencias: ' + error.message);
        }
        
        // Filtrar evidencias de hoy
        const evidenciasHoy = evidencias.filter(item => {
            if (!item.fecha) return false;
            const fechaItem = new Date(item.fecha);
            const fechaItemStr = `${fechaItem.getFullYear()}-${String(fechaItem.getMonth() + 1).padStart(2, '0')}-${String(fechaItem.getDate()).padStart(2, '0')}`;
            return fechaItemStr === fechaHoy;
        });
        
        if (evidenciasHoy.length === 0) {
            alert('No hay evidencias para generar PDF');
            document.body.removeChild(loadingMsg);
            return;
        }
        
        // Crear PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Título del documento
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('EVIDENCIAS DE LECTURA', 105, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Fecha: ${day}/${month}/${year}`, 105, 22, { align: 'center' });
        
        let yPosition = 35;
        
        // Procesar cada evidencia
        for (let i = 0; i < evidenciasHoy.length; i++) {
            const evidencia = evidenciasHoy[i];
            
            // Verificar si necesitamos una nueva página
            if (yPosition > 210) {
                doc.addPage();
                yPosition = 20;
            }
            
            const cardHeight = 80;
            const cardStartY = yPosition - 5;
            
            // Dibujar borde de tarjeta
            doc.setDrawColor(52, 152, 219);
            doc.setLineWidth(0.5);
            doc.rect(10, cardStartY, 190, cardHeight);
            
            // Título de la tarjeta
            doc.setFontSize(11);
            doc.setFont(undefined, 'bold');
            doc.text(`EVIDENCIA #${i + 1}`, 15, yPosition);
            
            let textYPosition = yPosition + 7;
            let textXPosition = 75; // Posición X para el texto (a la derecha de la foto)
            
            // Cargar y agregar foto primero (lado izquierdo)
            if (evidencia.foto) {
                try {
                    // Cargar imagen desde URL
                    const imgData = await cargarImagenComoBase64(evidencia.foto);
                    
                    // Crear imagen temporal para obtener dimensiones
                    const img = await obtenerDimensionesImagen(imgData);
                    
                    // Calcular dimensiones manteniendo aspect ratio
                    const maxWidth = 55;
                    const maxHeight = 70;
                    let imgWidth = maxWidth;
                    let imgHeight = (img.height / img.width) * maxWidth;
                    
                    // Si la altura excede el máximo, ajustar por altura
                    if (imgHeight > maxHeight) {
                        imgHeight = maxHeight;
                        imgWidth = (img.width / img.height) * maxHeight;
                    }
                    
                    // Centrar imagen verticalmente en la tarjeta
                    const imgY = cardStartY + (cardHeight - imgHeight) / 2;
                    
                    // Agregar imagen al PDF (lado izquierdo)
                    doc.addImage(imgData, 'JPEG', 12, imgY, imgWidth, imgHeight);
                } catch (imgError) {
                    console.error('Error cargando imagen:', imgError);
                    doc.setFontSize(8);
                    doc.setTextColor(255, 0, 0);
                    doc.text('Error al cargar foto', 15, cardStartY + 35);
                    doc.setTextColor(0, 0, 0);
                }
            }
            
            // Contenido de texto (lado derecho)
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            
            doc.text(`Instalación: ${evidencia.instalacion || 'N/A'}`, textXPosition, textYPosition);
            textYPosition += 6;
            
            // Dividir dirección si es muy larga
            const direccion = evidencia.direccion || 'N/A';
            if (direccion.length > 50) {
                const lineas = doc.splitTextToSize(`Dirección: ${direccion}`, 125);
                doc.text(lineas, textXPosition, textYPosition);
                textYPosition += lineas.length * 5;
            } else {
                doc.text(`Dirección: ${direccion}`, textXPosition, textYPosition);
                textYPosition += 6;
            }
            
            doc.text(`Correría: ${evidencia.correria || 'N/A'}`, textXPosition, textYPosition);
            textYPosition += 6;
            doc.text(`Lector: ${evidencia.lector || 'N/A'}`, textXPosition, textYPosition);
            textYPosition += 6;
            doc.text(`Servicio: ${evidencia.servicio || 'N/A'}`, textXPosition, textYPosition);
            textYPosition += 6;
            doc.text(`Lectura: ${evidencia.lectura || 'N/A'}`, textXPosition, textYPosition);
            textYPosition += 6;
            
            // Dividir descripción si es muy larga
            const descripcion = evidencia.descripcion || 'N/A';
            if (descripcion.length > 50) {
                const lineas = doc.splitTextToSize(`Descripción: ${descripcion}`, 125);
                doc.text(lineas, textXPosition, textYPosition);
            } else {
                doc.text(`Descripción: ${descripcion}`, textXPosition, textYPosition);
            }
            
            yPosition += cardHeight + 10;
        }
        
        // Descargar PDF
        doc.save(`Evidencias_${fechaHoy}.pdf`);
        
        document.body.removeChild(loadingMsg);
        alert(`✅ PDF generado con ${evidenciasHoy.length} evidencia(s)`);
        
    } catch (error) {
        console.error('Error generando PDF:', error);
        const loadingMsg = document.querySelector('div[style*="Generando PDF"]');
        if (loadingMsg && loadingMsg.parentNode) {
            document.body.removeChild(loadingMsg);
        }
        alert('❌ Error al generar PDF: ' + error.message);
    }
}

// Función auxiliar para cargar imagen como base64
async function cargarImagenComoBase64(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const dataURL = canvas.toDataURL('image/jpeg');
            resolve(dataURL);
        };
        
        img.onerror = function() {
            reject(new Error('No se pudo cargar la imagen'));
        };
        
        img.src = url;
    });
}

// Función auxiliar para obtener dimensiones de la imagen
async function obtenerDimensionesImagen(dataURL) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = function() {
            resolve({ width: img.width, height: img.height });
        };
        
        img.onerror = function() {
            reject(new Error('No se pudieron obtener las dimensiones de la imagen'));
        };
        
        img.src = dataURL;
    });
}

// Cargar datos al inicio
document.addEventListener('DOMContentLoaded', function() {
    loadData();
});

// Función para enviar email
async function enviarEmail() {
    try {
        // Mostrar mensaje de carga
        const loadingMsg = document.createElement('div');
        loadingMsg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); color: white; padding: 20px 40px; border-radius: 10px; z-index: 10000;';
        loadingMsg.innerHTML = '📊 Generando archivo Excel...';
        document.body.appendChild(loadingMsg);
        
        // Obtener datos de la tabla cmlec
        const { data: cmlecData, error: cmlecError } = await supabase
            .from('cmlec')
            .select('*')
            .order('id_llave', { ascending: true });
        
        if (cmlecError) {
            throw new Error('Error al obtener datos de CMLEC: ' + cmlecError.message);
        }
        
        // Crear archivo Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(cmlecData);
        XLSX.utils.book_append_sheet(wb, ws, 'CMLEC');
        
        // Generar nombre del archivo con fecha
        const now = new Date();
        const fecha = now.toLocaleDateString('es-ES').replace(/\//g, '-');
        const fileName = `CMLEC_${fecha}.xlsx`;
        
        // Descargar archivo Excel
        XLSX.writeFile(wb, fileName);
        
        // Actualizar mensaje
        loadingMsg.innerHTML = '✅ Excel descargado. Abriendo email...';
        
        // Esperar un momento antes de abrir el email
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Preparar fecha y hora
        const fechaHora = now.toLocaleDateString('es-ES') + ' ' + now.toLocaleTimeString('es-ES');
        
        // Obtener valores de los textareas y selects
        const novedadesLectura = document.getElementById('novedadesLectura')?.value || '';
        const novedadesReparto = document.getElementById('novedadesReparto')?.value || '';
        const novedadesRelecturas = document.getElementById('novedadesRelecturas')?.value || '';
        const mesFacturacion = document.getElementById('mesFacturacion')?.value || resumenData.mesFacturacion;
        
        // Crear asunto del email
        const asuntoEmail = `INMEL_Cierre_Operación_Ciclo_${resumenData.ciclo || '01'} - ${mesFacturacion}`;
        
        // Crear tabla en formato texto simple
        const tablaTexto = `
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
  Ciclo: ${resumenData.ciclo || '01'}
  Total Correrias: ${resumenData.totalCorrerias || 0}
  Correrias Ejecutadas: ${resumenData.correriasEjecutadas || 0}
  Correrias Pendientes por Descargar: ${resumenData.correriasPendientesDescargar || 0}
  Ordenes Totales: ${resumenData.ordenesTotales || 0}
  Cantidad Ordenes Descargadas: ${resumenData.cantidadOrdenesDescargadas || 0}
  Ordenes Pendientes por Descargar: ${resumenData.ordenesPendientesDescargar || 0}
  Ordenes Pendientes por Legalizar: ${resumenData.ordenesPendientesLegalizar || 0}
  Porcentaje Ejecutado: ${resumenData.porcentajeEjecutado || '0.00%'}
  Porcentaje Pendiente: ${resumenData.porcentajePendiente || '0.00%'}
  Mes Facturación: ${mesFacturacion}
  Ciclo Relecturas/Inconsistencias: ${resumenData.cicloRelecturas || '1'}
═══════════════════════════════════════════════════════════════════════════════════════════════════════════════`;
        
        // Crear el cuerpo del mensaje con los datos del resumen
        const mensajeTexto = 
`1. Se notifica el cierre de la operación.
Se realizaron las descargas de Ciclo ${resumenData.ciclo || '01'} de Lectura.
Un total de ${resumenData.correriasEjecutadas || 0} correrías de ${resumenData.totalCorrerias || 0}
El ${resumenData.porcentajeEjecutado || '0.00%'} de Medidores para un total de ${resumenData.cantidadOrdenesDescargadas || 0} de ${resumenData.ordenesTotales || 0}
En CMLEC quedan pendientes por legalizar ${resumenData.ordenesPendientesLegalizar || 0} órdenes
${tablaTexto}

2. Ciclo de relecturas ${resumenData.cicloRelecturas || '1'}.

3. Novedades de lectura: ${novedadesLectura}

4. Novedades de reparto: ${novedadesReparto}

5. Novedades de relecturas: ${novedadesRelecturas}

Si el punto (3,4,5) tienen novedades, el detalle y evidencias fotográficas estarán inmersas dentro del pdf.

Atentamente.`;
        
        // Abrir cliente de email con datos prellenados (codificar el body y subject)
        const mailto = 'juan.jaramillo.valencia@epm.com.co';
        const cc = 'daniel.sotelo@epm.com.co,Sol.Marquez@epm.com.co,wilmar.agudelo@epm.com.co,miguel.escobar@icintegral.co,Lady.Molina@epm.com.co,santiago.florez@inmel.co,victor.ramirez@epm.com.co,yonathan.zambrano@epm.com.co,heilder.martinez@epm.com.co,erik.bustamante@epm.com.co,andres.herrera@epm.com.co,yoneison.pineda@epm.com.co,Jesus.Escobar@epm.com.co,juan.castaneda.garcia@epm.com.co,john.hincapie@icintegral.co';
        const mailtoLink = `mailto:${mailto}?cc=${cc}&subject=${encodeURIComponent(asuntoEmail)}&body=${encodeURIComponent(mensajeTexto)}`;
        window.location.href = mailtoLink;
        
        // Remover mensaje de carga
        document.body.removeChild(loadingMsg);
        
    } catch (error) {
        console.error('Error al preparar email:', error);
        const loadingMsg = document.querySelector('div[style*="Generando archivo"]');
        if (loadingMsg && loadingMsg.parentNode) {
            document.body.removeChild(loadingMsg);
        }
        alert('❌ Error al preparar el email: ' + error.message);
    }
}

// Función para abrir modal de estadísticas
function abrirModalEstadisticas() {
    const modal = document.getElementById('modalEstadisticas');
    const modalBody = document.getElementById('modalEstadisticasBody');
    const modalCiclo = document.getElementById('modalCiclo');
    
    modalCiclo.textContent = resumenData.ciclo;
    
    // Calcular porcentajes
    const porcentajeCorrerias = resumenData.totalCorrerias > 0 
        ? (resumenData.correriasEjecutadas / resumenData.totalCorrerias * 100).toFixed(2)
        : 0;
    const porcentajeOrdenes = resumenData.ordenesTotales > 0
        ? (resumenData.cantidadOrdenesDescargadas / resumenData.ordenesTotales * 100).toFixed(2)
        : 0;
    
    const html = `
        <div style="padding: 1.5rem;">
            <!-- Sección Correrias -->
            <div style="margin-bottom: 2rem; padding: 1.5rem; background: #2c3e50; border-radius: 12px; color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.15); border-left: 5px solid #3498db;">
                <h4 style="margin: 0 0 1rem 0; font-size: 1.3rem;">📦 Correrias</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div style="text-align: center; background: #34495e; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: bold;">${resumenData.totalCorrerias.toLocaleString()}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Total</div>
                    </div>
                    <div style="text-align: center; background: #34495e; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: bold; color: #2ecc71;">${resumenData.correriasEjecutadas.toLocaleString()}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Ejecutadas</div>
                    </div>
                    <div style="text-align: center; background: #34495e; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: bold; color: #e74c3c;">${resumenData.correriasPendientesDescargar.toLocaleString()}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Pendientes</div>
                    </div>
                </div>
                <div style="background: #34495e; border-radius: 10px; height: 30px; overflow: visible; position: relative;">
                    <div style="background: #2ecc71; height: 100%; width: ${porcentajeCorrerias}%; transition: width 0.5s ease; border-radius: 10px;"></div>
                    <div style="position: absolute; top: 0; right: 8px; height: 100%; display: flex; align-items: center; font-weight: bold; font-size: 0.9rem; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.7);">
                        ${porcentajeCorrerias}%
                    </div>
                </div>
            </div>

            <!-- Sección Órdenes -->
            <div style="margin-bottom: 2rem; padding: 1.5rem; background: #34495e; border-radius: 12px; color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.15); border-left: 5px solid #9b59b6;">
                <h4 style="margin: 0 0 1rem 0; font-size: 1.3rem;">📋 Órdenes</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div style="text-align: center; background: #2c3e50; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: bold;">${resumenData.ordenesTotales.toLocaleString()}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Total</div>
                    </div>
                    <div style="text-align: center; background: #2c3e50; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: bold; color: #2ecc71;">${resumenData.cantidadOrdenesDescargadas.toLocaleString()}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Descargadas</div>
                    </div>
                    <div style="text-align: center; background: #2c3e50; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: bold; color: #e74c3c;">${resumenData.ordenesPendientesDescargar.toLocaleString()}</div>
                        <div style="font-size: 0.9rem; opacity: 0.9;">Pendientes</div>
                    </div>
                </div>
                <div style="background: #2c3e50; border-radius: 10px; height: 30px; overflow: visible; position: relative;">
                    <div style="background: #2ecc71; height: 100%; width: ${porcentajeOrdenes}%; transition: width 0.5s ease; border-radius: 10px;"></div>
                    <div style="position: absolute; top: 0; right: 8px; height: 100%; display: flex; align-items: center; font-weight: bold; font-size: 0.9rem; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.7);">
                        ${porcentajeOrdenes}%
                    </div>
                </div>
            </div>

            <!-- Resumen General -->
            <div style="padding: 1.5rem; background: #f5f5f5; border-radius: 12px; color: #333; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 1px solid #ddd;">
                <h4 style="margin: 0 0 1rem 0; font-size: 1.3rem; color: #555;">📊 Resumen General</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div style="background: white; padding: 1rem; border-radius: 8px; border-left: 4px solid #2ecc71; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                        <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.3rem;">Porcentaje Ejecutado</div>
                        <div style="font-size: 2rem; font-weight: bold; color: #2ecc71;">${resumenData.porcentajeEjecutado}</div>
                    </div>
                    <div style="background: white; padding: 1rem; border-radius: 8px; border-left: 4px solid #e74c3c; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                        <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.3rem;">Porcentaje Pendiente</div>
                        <div style="font-size: 2rem; font-weight: bold; color: #e74c3c;">${resumenData.porcentajePendiente}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modalBody.innerHTML = html;
    modal.style.display = 'flex';
}

// Función para cerrar modal de estadísticas
function cerrarModalEstadisticas() {
    const modal = document.getElementById('modalEstadisticas');
    modal.style.display = 'none';
}
