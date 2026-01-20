// Modal para cargar datos por texto (restaurado)
function mostrarModalCargarPorTexto() {
    let modal = document.getElementById('modalCargarTexto');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalCargarTexto';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '9999';
        modal.innerHTML = `
            <div style="background: #fff; padding: 30px; border-radius: 10px; min-width: 350px; max-width: 95vw; box-shadow: 0 8px 32px rgba(0,0,0,0.25); z-index:10000; position:relative;">
                <h3>Cargar datos por texto</h3>
                <div style="margin-bottom:10px;">
                    <textarea id="textoCarga" rows="8" style="width:100%; min-width:300px; max-width:500px;"></textarea>
                </div>
                <div id="cargarTextoMsg" style="color:#c0392b; margin-bottom:10px;"></div>
                <div style="text-align:right;">
                    <button type="button" class="btn btn-primary" onclick="procesarCargaPorTexto()">Cargar</button>
                    <button type="button" class="btn btn-secondary" onclick="document.getElementById('modalCargarTexto').remove()">Cancelar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}
// Exponer la función al ámbito global
window.mostrarModalCargarPorTexto = mostrarModalCargarPorTexto;
// Función principal para generar el PDF de registro de formación
async function generarPDFRegistroFormacion(datosExtra) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('jsPDF no está cargado.');
        return;
    }

    // Agrupar registros por código
    const registros = (window.currentData || currentData || []).filter(r => r && r.nombre_completo);
    const codigosUnicos = Array.from(new Set(registros.map(r => r.codigo))).filter(Boolean);
    const doc = new window.jspdf.jsPDF();
    let primeraHoja = true;
    for (const codigo of codigosUnicos) {
        const registrosCodigo = registros.filter(r => r.codigo === codigo);
        // Ordenar por nombre_completo o como prefieras
        registrosCodigo.sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || ''));
        const registrosPorPagina = 15;
        const totalPaginas = Math.ceil(registrosCodigo.length / registrosPorPagina) || 1;
        let numeroGlobal = 1;
        for (let pagina = 0; pagina < totalPaginas; pagina++) {
            if (!primeraHoja) doc.addPage();
            primeraHoja = false;
            let registro = registrosCodigo[0] || {};
            let nombreInstructor = registro.instructor || '';
            let y = 12;
            const pageWidth = doc.internal.pageSize.getWidth();
            const usableWidth = pageWidth - 28;
            const colWidths = [usableWidth * 0.20, usableWidth * 0.40, usableWidth * 0.15, usableWidth * 0.25];
            let x = 14;
            doc.setDrawColor(0,0,0);
            doc.setLineWidth(0.2);
            doc.rect(x, y, colWidths[0], 16);
            try {
                if (typeof logoUTIC !== 'undefined' && logoUTIC) {
                    const padding = 2;
                    const logoWidth = colWidths[0] - 2 * padding;
                    const logoHeight = 16 - 2 * padding;
                    doc.addImage(logoUTIC, 'PNG', x + padding, y + padding, logoWidth, logoHeight);
                } else {
                    doc.setFontSize(16);
                    doc.setFont('helvetica', 'bold');
                    doc.text('UT.iC', x + 4, y + 10);
                    doc.setFontSize(6);
                    doc.setFont('helvetica', 'normal');
                    const icWidth = doc.getTextWidth('iC');
                    const integralWidth = doc.getTextWidth('INTEGRAL');
                    const utWidth = doc.getTextWidth('UT.');
                    const icStart = x + 4 + utWidth;
                    const integralX = icStart + (icWidth/2) - (integralWidth/2);
                    doc.text('INTEGRAL', integralX, y + 15);
                }
            } catch (e) {
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.text('UT.iC', x + 4, y + 10);
                doc.setFontSize(6);
                doc.setFont('helvetica', 'normal');
                const icWidth = doc.getTextWidth('iC');
                const integralWidth = doc.getTextWidth('INTEGRAL');
                const utWidth = doc.getTextWidth('UT.');
                const icStart = x + 4 + utWidth;
                const integralX = icStart + (icWidth/2) - (integralWidth/2);
                doc.text('INTEGRAL', integralX, y + 15);
            }
            x += colWidths[0];
            doc.rect(x, y, colWidths[1], 16);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('REGISTRO DE FORMACIÓN', x + colWidths[1]/2, y + 10, { align: 'center', baseline: 'middle' });
            x += colWidths[1];
            doc.rect(x, y, colWidths[2], 16);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('SCF-H003-9', x + colWidths[2]/2, y + 6, { align: 'center' });
            doc.text('REV.0', x + colWidths[2]/2, y + 13, { align: 'center' });
            x += colWidths[2];
            doc.rect(x, y, colWidths[3], 16);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            const pagText = `Pag ${pagina + 1} de ${totalPaginas}`;
            doc.text(pagText, x + colWidths[3] - 3, y + 10, { align: 'right', baseline: 'middle' });
            const finalX = x + colWidths[3];
            doc.setDrawColor(0,0,0);
            doc.setLineWidth(0.2);
            doc.line(finalX, y, finalX, y + 16);
            y += 20;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            const lineSpacing = 5;
            doc.setFont('helvetica', 'bold');
            doc.text('FECHA (D/M/A):', 14, y);
            doc.setFont('helvetica', 'normal');
            let fechaFormateada = '___/___/___';
            if (registro.fecha) {
                const dateParts = registro.fecha.split('T')[0].split('-');
                if (dateParts.length === 3) {
                    fechaFormateada = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
                }
            }
            doc.text(fechaFormateada, 44, y);
            doc.line(44, y + 1, 44 + doc.getTextWidth(fechaFormateada), y + 1);
            doc.setFont('helvetica', 'bold');
            doc.text('TIPO (marque con "X"):', 75, y);
            doc.setFont('helvetica', 'normal');
            doc.text('ENTRENAMIENTO', 120, y);
            let entrenamientoDato = datosExtra.tipo === 'ENTRENAMIENTO' ? 'X' : '_____';
            const entrenamientoLabelWidth = doc.getTextWidth('ENTRENAMIENTO ');
            doc.text(entrenamientoDato, 120 + entrenamientoLabelWidth, y);
            doc.text('CAPACITACIÓN', 155, y);
            let capacitacionDato = datosExtra.tipo === 'CAPACITACIÓN' ? 'X' : '_____';
            const capacitacionLabelWidth = doc.getTextWidth('CAPACITACIÓN ');
            let capXOffset = datosExtra.tipo === 'CAPACITACIÓN' ? 3 : 0;
            doc.text(capacitacionDato, 155 + capacitacionLabelWidth + capXOffset, y);
            y += lineSpacing;
            doc.setFont('helvetica', 'bold');
            doc.text('CÓDIGO:', 14, y);
            doc.setFont('helvetica', 'normal');
            doc.text(codigo, 36, y);
            doc.line(36, y + 1, 36 + doc.getTextWidth(codigo), y + 1);
            doc.setFont('helvetica', 'bold');
            doc.text('INSTRUCTOR:', 75, y);
            doc.setFont('helvetica', 'normal');
            const nombreInst = nombreInstructor || '________________________';
            doc.text(nombreInst, 105, y);
            doc.line(105, y + 1, 105 + doc.getTextWidth(nombreInst), y + 1);
            y += lineSpacing;
            doc.setFont('helvetica', 'bold');
            doc.text('INTERNO', 14, y);
            doc.setFont('helvetica', 'normal');
            let internoDato = datosExtra.modalidad === 'INTERNO' ? 'X' : '_____';
            doc.text(internoDato, 38, y);
            doc.setFont('helvetica', 'bold');
            doc.text('EXTERNO', 65, y);
            doc.setFont('helvetica', 'normal');
            let externoDato = datosExtra.modalidad === 'EXTERNO' ? 'X' : '_____';
            doc.text(externoDato, 90, y);
            doc.setFont('helvetica', 'bold');
            doc.text('DURACIÓN (horas):', 120, y);
            doc.setFont('helvetica', 'normal');
            const duracion = datosExtra.duracion || '____';
            doc.text(duracion, 160, y);
            doc.text('hrs', 160 + doc.getTextWidth(duracion) + 2, y);
            y += lineSpacing;
            doc.setFont('helvetica', 'bold');
            doc.text('TEMA CAPACITACIÓN:', 14, y);
            doc.setFont('helvetica', 'normal');
            const tema = registro.tema || datosExtra.tema || '__________________________________________';
            doc.text(tema, 60, y);
            doc.line(60, y + 1, 60 + doc.getTextWidth(tema), y + 1);
            doc.setFont('helvetica', 'bold');
            const areaLabelX = 60 + doc.getTextWidth(tema) + 10;
            doc.text('ÁREA:', areaLabelX, y);
            doc.setFont('helvetica', 'normal');
            const area = datosExtra.area || '________________________';
            doc.text(area, areaLabelX + 18, y);
            doc.line(areaLabelX + 18, y + 1, areaLabelX + 18 + doc.getTextWidth(area), y + 1);
            y += 4;

            // --- DATOS DE LA TABLA: solo filas con datos reales, sin huecos ---
            const tableData = [];
            const asistentesPagina = [];
            const start = pagina * registrosPorPagina;
            const end = Math.min(start + registrosPorPagina, registrosCodigo.length);
            const filasReales = end - start;
            const filasMinimas = 5;
            const filasTotales = Math.max(filasReales, filasMinimas);
            const refAsistente = (start < registrosCodigo.length) ? registrosCodigo[start] : {};
            for (let i = 0; i < filasTotales; i++) {
                const idx = start + i;
                const asistente = (idx < registrosCodigo.length) ? registrosCodigo[idx] : {};
                let descripcion = '';
                if (i === 0) {
                    descripcion = refAsistente.tema ? `TEMA: ${refAsistente.tema}` : (datosExtra.tema ? `TEMA: ${datosExtra.tema}` : '');
                } else if (i === 1) {
                    descripcion = refAsistente.origen ? `ORIGEN: ${refAsistente.origen}` : (datosExtra.origen ? `ORIGEN: ${datosExtra.origen}` : '');
                } else if (i === 2) {
                    descripcion = refAsistente.objetivo ? `OBJETIVO: ${refAsistente.objetivo}` : (datosExtra.objetivo ? `OBJETIVO: ${datosExtra.objetivo}` : '');
                } else if (i === 3) {
                    descripcion = refAsistente.aspectos ? `ASPECTOS: ${refAsistente.aspectos}` : (datosExtra.aspectos ? `ASPECTOS: ${datosExtra.aspectos}` : '');
                }
                const esUltimaFilaPagina = (i === filasTotales - 1);
                if (esUltimaFilaPagina) {
                    let realizado = (datosExtra.realizado || '').toUpperCase();
                    let siMarcado = realizado === 'SI' ? 'X' : ' ';
                    let noMarcado = realizado === 'NO' ? 'X' : ' ';
                    let resultado = datosExtra.resultado || '';
                    descripcion =
                        'EVALUACIÓN\n\n' +
                        'Se realizó:  Si [' + siMarcado + ']   No [' + noMarcado + ']\n' +
                        'Resultado: ' + resultado;
                }
                tableData.push([
                    descripcion,
                    (idx < registrosCodigo.length) ? numeroGlobal : '',
                    asistente.nombre_completo || '',
                    asistente.cedula || '',
                    asistente.cargo || '',
                    asistente.firma || '',
                    asistente.codigo_lec || ''
                ]);
                asistentesPagina.push(asistente);
                if (idx < registrosCodigo.length) numeroGlobal++;
            }
            doc.autoTable({
                startY: y,
                head: [['DESCRIPCIÓN', '#', 'NOMBRE COMPLETO', 'CÉDULA', 'CARGO', 'FIRMA', 'CÓDIGO']],
                body: tableData,
                theme: 'grid',
                styles: {
                    fontSize: 5.5,
                    cellPadding: 0.2,
                    valign: 'middle',
                    lineWidth: 0.1,
                    lineColor: [0, 0, 0],
                    minCellHeight: 10,
                    cellHeight: 10,
                    overflow: 'linebreak'
                },
                headStyles: {
                    fillColor: [96, 125, 139],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center',
                    valign: 'middle',
                    minCellHeight: 10,
                    cellHeight: 10,
                    fontSize: 6.5
                },
                columnStyles: {
                    0: { cellWidth: usableWidth * 0.25, fontStyle: 'bold', valign: 'top', fontSize: 5.5 },
                    1: { halign: 'center', cellWidth: 5, valign: 'middle' },
                    2: { cellWidth: usableWidth * 0.30, valign: 'middle', fontSize: 5.5 },
                    3: { halign: 'center', cellWidth: 18, valign: 'middle', fontSize: 5.5 },
                    4: { halign: 'center', cellWidth: 25, valign: 'middle', fontSize: 5.5 },
                    5: { halign: 'center', cellWidth: 22, valign: 'middle' },
                    6: { halign: 'center', cellWidth: 15, valign: 'middle', fontSize: 5.5 }
                },
                willDrawCell: function(data) {
                    if (data.column.index === 5 && data.section === 'body') {
                        data.cell.text = [];
                    }
                },
                didDrawCell: function(data) {
                    if (data.section === 'body' && data.column.index === 0) {
                        data.cell.styles.lineWidth = {top: 0.1, right: 0, bottom: 0, left: 0.1};
                    }
                    if (data.column.index === 5 && data.section === 'body') {
                        const asistente = asistentesPagina[data.row.index];
                        if (asistente && asistente.nombre_completo) {
                            const firmaUrl = asistente.firma;
                            if (firmaUrl && firmaUrl.startsWith('http')) {
                                const cell = data.cell;
                                const padding = 0.3;
                                const maxImgWidth = cell.width - (padding * 2);
                                const maxImgHeight = cell.height - (padding * 2);
                                const yOffset = padding;
                                try {
                                    doc.addImage(
                                        firmaUrl,
                                        'PNG',
                                        cell.x + padding,
                                        cell.y + yOffset,
                                        maxImgWidth,
                                        maxImgHeight,
                                        undefined,
                                        'NONE'
                                    );
                                } catch (e) {
                                    console.error('Error al cargar firma:', e);
                                }
                            }
                        }
                    }
                },
                margin: { left: 14, right: 14 }
            });
            const pageHeight = doc.internal.pageSize.getHeight();
            const footerY = pageHeight - 8;
            doc.line(14, footerY, 80, footerY);
            doc.setFontSize(7);
            doc.text('FIRMA DEL INSTRUCTOR', 30, footerY + 4);
            if (registro.firma_sup && typeof registro.firma_sup === 'string' && registro.firma_sup.startsWith('http')) {
                try {
                    doc.addImage(
                        registro.firma_sup,
                        'PNG',
                        14,
                        footerY - 14,
                        60,
                        12
                    );
                } catch (e) {
                    console.error('Error al cargar la firma del instructor:', e);
                }
            }
        }
    }
    doc.save('registro_formacion.pdf');
}
// Importar logo UTIC (asegúrate de que el archivo esté incluido en el HTML antes de este script si usas <script> tags)
// Si usas módulos ES6, puedes usar: import { logoUTIC } from './logoUTIC.js';
// Si usas <script> clásico, solo asegúrate de que logoUTIC.js esté antes de este archivo en el HTML.
// Modal para capturar datos antes de generar PDF
function mostrarModalDatosPDF() {
    let modal = document.getElementById('modalDatosPDF');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalDatosPDF';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.background = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '9999';
        modal.innerHTML = `
            <div style="background: #fff; padding: 30px; border-radius: 10px; min-width: 350px; max-width: 95vw; box-shadow: 0 8px 32px rgba(0,0,0,0.25); z-index:10000; position:relative;">
                <h3>Datos para el PDF</h3>
                <form id="formDatosPDF">
                    <div style="margin-bottom:10px;">
                        <label>Tipo:</label>
                        <label><input type="radio" name="tipo" value="ENTRENAMIENTO"> ENTRENAMIENTO</label>
                        <label><input type="radio" name="tipo" value="CAPACITACIÓN"> CAPACITACIÓN</label>
                    </div>
                    <div style="margin-bottom:10px;">
                        <label>Modalidad:</label>
                        <label><input type="radio" name="modalidad" value="INTERNO"> INTERNO</label>
                        <label><input type="radio" name="modalidad" value="EXTERNO"> EXTERNO</label>
                    </div>
                    <div style="margin-bottom:10px;">
                        <label>Duración (horas):</label>
                        <input type="number" name="duracion" min="0" style="width:80px;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label>Área:</label>
                        <input type="text" name="area" style="width:200px;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label>Resultado evaluación:</label>
                        <input type="text" name="resultado" style="width:200px;">
                    </div>
                    <div style="margin-bottom:10px;">
                        <label>¿Se realizó?:</label>
                        <label><input type="radio" name="realizado" value="SI"> SI</label>
                        <label><input type="radio" name="realizado" value="NO"> NO</label>
                    </div>
                    <div style="text-align:right;">
                        <button type="button" class="btn btn-primary" onclick="generarPDFAsync()">Generar PDF</button>
                        <button type="button" class="btn btn-secondary" onclick="document.getElementById('modalDatosPDF').remove()">Cancelar</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

// Función global para abrir el modal desde el botón
function generarPDF() {
    mostrarModalDatosPDF();
}

// Función global para generar el PDF usando los datos del modal
async function generarPDFAsync() {
    // Obtener el formulario del modal
    const form = document.getElementById('formDatosPDF');
    if (!form) return;

    // Leer los datos del formulario
    const formData = new FormData(form);
    const datosExtra = {
        tipo: formData.get('tipo') || '',
        modalidad: formData.get('modalidad') || '',
        duracion: formData.get('duracion') || '',
        area: formData.get('area') || '',
        resultado: formData.get('resultado') || '',
        realizado: formData.get('realizado') || ''
    };

    // Cerrar el modal
    document.getElementById('modalDatosPDF').remove();

    // Lógica de generación de PDF principal
    if (typeof window.generarPDFRegistroFormacion === 'function') {
        // Si existe una función modular, úsala
        await window.generarPDFRegistroFormacion(datosExtra);
    } else if (typeof generarPDFRegistroFormacion === 'function') {
        // O si está en el scope global
        await generarPDFRegistroFormacion(datosExtra);
    } else {
        // Si no existe, mostrar alerta
        alert('No se encontró la función de generación de PDF.');
    }
}

// Procesar y cargar los datos pegados por texto
async function procesarCargaPorTexto() {
    const textarea = document.getElementById('textoCarga');
    const msgDiv = document.getElementById('cargarTextoMsg');
    if (!textarea) return;
    const texto = textarea.value.trim();
    if (!texto) {
        msgDiv.textContent = 'Pega los datos primero.';
        return;
    }
    // Separar líneas y columnas por tabulación
    const filas = texto.split(/\r?\n/).filter(l => l.trim() !== '');
    if (filas.length === 0) {
        msgDiv.textContent = 'No se detectaron filas.';
        return;
    }
    // Leer encabezados
    const columnas = filas[0].split('\t').map(c => c.trim());
    const datos = [];
    // Obtener todos los numero_formulario existentes para evitar duplicados
    let existentes = new Set();
    try {
        const { data: existentesData } = await supabase
            .from('registro_formacion')
            .select('numero_formulario');
        if (existentesData) {
            existentesData.forEach(row => {
                if (row.numero_formulario) existentes.add(row.numero_formulario.toString());
            });
        }
    } catch (e) {}

    function generarNumeroUnico() {
        let num;
        do {
            num = Math.floor(1000 + Math.random() * 9000).toString();
        } while (existentes.has(num));
        existentes.add(num);
        return num;
    }

    for (let i = 1; i < filas.length; i++) {
        const celdas = filas[i].split('\t');
        if (celdas.length !== columnas.length) continue;
        let obj = {};
        for (let j = 0; j < columnas.length; j++) {
            let valor = celdas[j].trim();
            // Si es la columna fecha y tiene formato dd-mm-yyyy o dd/mm/yyyy, convertir a yyyy-mm-dd
            if (columnas[j].toLowerCase() === 'fecha') {
                if (valor.match(/^\d{2}-\d{2}-\d{4}$/)) {
                    const [d, m, y] = valor.split('-');
                    valor = `${y}-${m}-${d}`;
                } else if (valor.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                    const [d, m, y] = valor.split('/');
                    valor = `${y}-${m}-${d}`;
                }
            }
            obj[columnas[j]] = valor;
        }
        // Asignar numero_formulario único de 4 dígitos
        obj['numero_formulario'] = generarNumeroUnico();
        datos.push(obj);
    }
    if (datos.length === 0) {
        msgDiv.textContent = 'No se detectaron datos válidos.';
        return;
    }
    // Insertar en Supabase
    try {
        const { error } = await supabase.from('registro_formacion').insert(datos);
        if (error) {
            msgDiv.textContent = 'Error al cargar: ' + error.message;
        } else {
            msgDiv.style.color = '#27ae60';
            msgDiv.textContent = 'Datos cargados correctamente.';
            setTimeout(() => {
                document.getElementById('modalCargarTexto').remove();
                loadData();
            }, 1200);
        }
    } catch (e) {
        msgDiv.textContent = 'Error inesperado: ' + e.message;
    }
}
// Función para descargar plantilla Excel en formato XLSX
function descargarPlantillaExcel() {
    // Columnas requeridas
    const columnas = [
        'fecha',
        'tema',
        'origen',
        'objetivo',
        'aspectos',
        'codigo'
    ];
    // Crear una hoja con solo los encabezados
    const ws = XLSX.utils.aoa_to_sheet([columnas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla_registro_formacion.xlsx');
}
// Lógica para la tabla registro_formacion
let tableColumns = [];

// Exponer funciones al ámbito global para los botones
window.descargarPlantillaExcel = descargarPlantillaExcel;
window.exportarFiltradoExcel = exportarFiltradoExcel;
window.procesarCargaPorTexto = procesarCargaPorTexto;
// Exportar datos filtrados a Excel (XLS)
function exportarFiltradoExcel() {
    // Usar los datos filtrados actuales
    if (!currentData || currentData.length === 0) {
        alert('No hay datos para exportar.');
        return;
    }
    // Preparar encabezados y datos
    // Columnas a ocultar en el Excel exportado
    const columnasOcultas = ['firma', 'pdf', 'firma_sup'];
    const columnas = tableColumns.filter(col => col !== 'id' && !columnasOcultas.includes(col));
    const datos = currentData.map(row => columnas.map(col => row[col]));
    // Crear hoja de Excel
    const ws = XLSX.utils.aoa_to_sheet([
        columnas,
        ...datos
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtrado');
    XLSX.writeFile(wb, 'registro_formacion_filtrado.xlsx');
}
let currentData = [];
let allData = [];
let currentPage = 1;
const itemsPerPage = 50;

document.addEventListener('DOMContentLoaded', function() {
    loadData();
});

async function loadData() {
    try {
        const { data, error } = await supabase
            .from('registro_formacion')
            .select('*')
            .order('id', { ascending: false });
        
        if (error) throw error;
        
        allData = data || [];
        currentData = allData;
        
        if (currentData.length > 0) {
            // Orden personalizado de columnas
            const preferredOrder = [
                'numero_formulario',
                'fecha',
                'tema',
                'origen',
                'objetivo',
                'aspectos',
                'codigo'
            ];
            const allKeys = Object.keys(currentData[0]);
            // Primero los preferidos, luego el resto (sin duplicar)
            tableColumns = [
                ...preferredOrder,
                ...allKeys.filter(k => !preferredOrder.includes(k) && k !== 'id'),
                ...allKeys.filter(k => !preferredOrder.includes(k) && k === 'id') // id al final si existe
            ];
            populateFilterColumns();
            renderTable();
            renderPagination();
        } else {
            document.getElementById('tableBody').innerHTML = '<tr><td colspan="100" style="text-align: center; padding: 40px; color: #7f8c8d;">No hay registros en esta tabla</td></tr>';
        }
        
    } catch (error) {
        console.error('Error al cargar datos:', error);
        alert('Error al cargar datos: ' + error.message);
    }
}

function populateFilterColumns() {
    const filterColumn = document.getElementById('filterColumn');
    filterColumn.innerHTML = '<option value="">Todas las columnas</option>';
    
    tableColumns.forEach(col => {
        if (col !== 'id') {
            filterColumn.innerHTML += `<option value="${col}">${formatColumnName(col)}</option>`;
        }
    });
}

function formatColumnName(col) {
    return col
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

function renderTable() {
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    let bodyHTML = '';
    // Renderizar encabezados
    // Columnas a ocultar en la tabla HTML
    const columnasOcultas = ['firma', 'pdf', 'firma_sup'];
    let headHTML = '<tr>';
    tableColumns.forEach(col => {
        if (col !== 'id' && !columnasOcultas.includes(col)) {
            headHTML += `<th>${formatColumnName(col)}</th>`;
        }
    });
    headHTML += '<th>Acciones</th></tr>';
    tableHead.innerHTML = headHTML;

    // Renderizar datos paginados
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = currentData.slice(startIndex, endIndex);

    paginatedData.forEach((row, index) => {
        bodyHTML += '<tr>';
        tableColumns.forEach(col => {
            if (col !== 'id' && !columnasOcultas.includes(col)) {
                const cellValue = formatValue(row[col], col);
                bodyHTML += `<td>${cellValue}</td>`;
            }
        });
        bodyHTML += `<td class="actions">
            <button class="btn btn-primary btn-sm" onclick='editRecord(${JSON.stringify(row).replace(/'/g, "&apos;")})'>✏️ Editar</button>
        </td></tr>`;
    });

    tableBody.innerHTML = bodyHTML;
}


function formatValue(value, columnName) {
    if (value === null || value === undefined) return '<span style="color: #95a5a6;">-</span>';
    
    // Formatear fechas
    if (columnName.toLowerCase().includes('fecha') || columnName.toLowerCase().includes('date')) {
        // Si es string en formato ISO, extraer solo la fecha
        if (typeof value === 'string' && value.includes('-')) {
            const dateParts = value.split('T')[0].split('-');
            if (dateParts.length === 3) {
                return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
            }
        }
        // Si es objeto Date
        const date = new Date(value);
        if (!isNaN(date)) {
            return date.toLocaleDateString('es-ES');
        }
    }
    
    // Formatear booleanos
    if (typeof value === 'boolean') {
        return value ? '✅ Sí' : '❌ No';
    }
    
    // Truncar textos largos
    if (typeof value === 'string' && value.length > 100) {
        return `<span title="${value.replace(/"/g, '&quot;')}">${value.substring(0, 100)}...</span>`;
    }
    
    return value;
}

function renderPagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(currentData.length / itemsPerPage);
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination-container">';
    html += `<button class="btn btn-secondary btn-sm" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">← Anterior</button>`;
    html += `<span style="margin: 0 15px;">Página ${currentPage} de ${totalPages}</span>`;
    html += `<button class="btn btn-secondary btn-sm" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">Siguiente →</button>`;
    html += '</div>';
    
    pagination.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    renderTable();
    renderPagination();
}

function applyFilter() {
    const searchText = document.getElementById('filterSearch').value.toLowerCase();
    const filterColumn = document.getElementById('filterColumn').value;
    
    if (!searchText) {
        currentData = allData;
    } else {
        currentData = allData.filter(row => {
            if (filterColumn) {
                const value = row[filterColumn];
                return value && value.toString().toLowerCase().includes(searchText);
            } else {
                return Object.values(row).some(value => 
                    value && value.toString().toLowerCase().includes(searchText)
                );
            }
        });
    }
    
    currentPage = 1;
    renderTable();
    renderPagination();
}

function clearFilter() {
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterColumn').value = '';
    currentData = allData;
            // ...aquí va el código de creación y despliegue del modal...
    // Fila superior tipo tabla con 4 columnas (ajuste para no sobrepasar hoja)
    let y = 12;
    const pageWidth = doc.internal.pageSize.getWidth();
    // Margen izquierdo y derecho de 14, área útil:
    const usableWidth = pageWidth - 28;
    // Proporciones aproximadas: logo 20%, título 40%, código 15%, paginación 25%
    const colWidths = [usableWidth * 0.20, usableWidth * 0.40, usableWidth * 0.15, usableWidth * 0.25];
    let x = 14;

    // 1. Logo UTIC INTEGRAL (imagen)
    doc.setDrawColor(0,0,0);
    doc.setLineWidth(0.2);
    doc.rect(x, y, colWidths[0], 16);
    try {
        if (typeof logoUTIC !== 'undefined' && logoUTIC) {
            // Margen interno para no pegar el logo a los bordes
            const padding = 2;
            const logoWidth = colWidths[0] - 2 * padding;
            const logoHeight = 16 - 2 * padding;
            doc.addImage(logoUTIC, 'PNG', x + padding, y + padding, logoWidth, logoHeight);
        } else {
            // Fallback: texto si no hay logo cargado
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('UT.iC', x + 4, y + 10);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            const icWidth = doc.getTextWidth('iC');
            const integralWidth = doc.getTextWidth('INTEGRAL');
            const utWidth = doc.getTextWidth('UT.');
            const icStart = x + 4 + utWidth;
            const integralX = icStart + (icWidth/2) - (integralWidth/2);
            doc.text('INTEGRAL', integralX, y + 15);
        }
    } catch (e) {
        // Si hay error, mostrar texto
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('UT.iC', x + 4, y + 10);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        const icWidth = doc.getTextWidth('iC');
        const integralWidth = doc.getTextWidth('INTEGRAL');
        const utWidth = doc.getTextWidth('UT.');
        const icStart = x + 4 + utWidth;
        const integralX = icStart + (icWidth/2) - (integralWidth/2);
        doc.text('INTEGRAL', integralX, y + 15);
    }


    // 2. Título
    x += colWidths[0];
    doc.rect(x, y, colWidths[1], 16);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('REGISTRO DE FORMACIÓN', x + colWidths[1]/2, y + 10, { align: 'center', baseline: 'middle' });

    // 3. Código y revisión (alineado a la derecha y con más espacio)
    x += colWidths[1];
    doc.rect(x, y, colWidths[2], 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('SCF-H003-9', x + colWidths[2]/2, y + 6, { align: 'center' });
    doc.text('REV.0', x + colWidths[2]/2, y + 13, { align: 'center' });

    // 4. Paginación (alineado a la derecha, mejor separación)
    x += colWidths[2];
    doc.rect(x, y, colWidths[3], 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    // Mostrar número de página real y total
    const pagText = `Pag ${numeroPagina} de ${totalPaginas}`;
    doc.text(pagText, x + colWidths[3] - 3, y + 10, { align: 'right', baseline: 'middle' });

    // Dibujar línea vertical final para cerrar la fila (altura completa de la celda)
    const finalX = x + colWidths[3];
    doc.setDrawColor(0,0,0);
    doc.setLineWidth(0.2);
    doc.line(finalX, y, finalX, y + 16);

    // Reset X para el resto del contenido
    y += 20;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    // === CABECERA DETALLADA (ORDEN Y FUENTE REDUCIDA) ===
    doc.setFontSize(8);
    const lineSpacing = 5; // interlineado aún más reducido
    // Línea 1: FECHA y TIPO (más compacto, solo subrayado en FECHA)
    doc.setFont('helvetica', 'bold');
    doc.text('FECHA (D/M/A):', 14, y);
    doc.setFont('helvetica', 'normal');
    let fechaFormateada = '___/___/___';
    if (registro.fecha) {
        const dateParts = registro.fecha.split('T')[0].split('-');
        if (dateParts.length === 3) {
            fechaFormateada = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
        }
    }
    doc.text(fechaFormateada, 44, y);
    doc.line(44, y + 1, 44 + doc.getTextWidth(fechaFormateada), y + 1);

    doc.setFont('helvetica', 'bold');
    doc.text('TIPO (marque con "X"):', 75, y);
    doc.setFont('helvetica', 'normal');
    doc.text('ENTRENAMIENTO', 120, y);
    let entrenamientoDato = datosExtra.tipo === 'ENTRENAMIENTO' ? 'X' : '_____';
    const entrenamientoLabelWidth = doc.getTextWidth('ENTRENAMIENTO ');
    doc.text(entrenamientoDato, 120 + entrenamientoLabelWidth, y);
    // Sin subrayado
    doc.text('CAPACITACIÓN', 155, y);
    let capacitacionDato = datosExtra.tipo === 'CAPACITACIÓN' ? 'X' : '_____';
    const capacitacionLabelWidth = doc.getTextWidth('CAPACITACIÓN ');
    let capXOffset = datosExtra.tipo === 'CAPACITACIÓN' ? 3 : 0;
    doc.text(capacitacionDato, 155 + capacitacionLabelWidth + capXOffset, y);
    // Sin subrayado

    y += lineSpacing;
    // Línea 2: CÓDIGO e INSTRUCTOR (subrayado solo en valores)
    doc.setFont('helvetica', 'bold');
    doc.text('CÓDIGO:', 14, y);
    doc.setFont('helvetica', 'normal');
    const codigo = registro.codigo || '________';
    doc.text(codigo, 36, y);
    doc.line(36, y + 1, 36 + doc.getTextWidth(codigo), y + 1);

    doc.setFont('helvetica', 'bold');
    doc.text('INSTRUCTOR:', 75, y);
    doc.setFont('helvetica', 'normal');
    const nombreInst = nombreInstructor || '________________________';
    doc.text(nombreInst, 105, y);
    doc.line(105, y + 1, 105 + doc.getTextWidth(nombreInst), y + 1);

    y += lineSpacing;
    // Línea 3: INTERNO, EXTERNO, DURACIÓN (subrayado solo en valores de duración)
    doc.setFont('helvetica', 'bold');
    doc.text('INTERNO', 14, y);
    doc.setFont('helvetica', 'normal');
    let internoDato = datosExtra.modalidad === 'INTERNO' ? 'X' : '_____';
    doc.text(internoDato, 38, y);
    // Sin subrayado

    doc.setFont('helvetica', 'bold');
    doc.text('EXTERNO', 65, y);
    doc.setFont('helvetica', 'normal');
    let externoDato = datosExtra.modalidad === 'EXTERNO' ? 'X' : '_____';
    doc.text(externoDato, 90, y);
    // Sin subrayado

    doc.setFont('helvetica', 'bold');
    doc.text('DURACIÓN (horas):', 120, y);
    doc.setFont('helvetica', 'normal');
    const duracion = datosExtra.duracion || '____';
    doc.text(duracion, 160, y);
    doc.text('hrs', 160 + doc.getTextWidth(duracion) + 2, y);
    doc.line(160, y + 1, 160 + doc.getTextWidth(duracion), y + 1);

    y += lineSpacing;
    // Línea 4: TEMA CAPACITACIÓN y ÁREA (subrayado solo en valores)
    doc.setFont('helvetica', 'bold');
    doc.text('TEMA CAPACITACIÓN:', 14, y);
    doc.setFont('helvetica', 'normal');
    const tema = registro.tema || datosExtra.tema || '__________________________________________';
    doc.text(tema, 60, y);
    doc.line(60, y + 1, 60 + doc.getTextWidth(tema), y + 1);

    doc.setFont('helvetica', 'bold');
    // Acercar el campo ÁREA a continuación del tema
    const areaLabelX = 60 + doc.getTextWidth(tema) + 10;
    doc.text('ÁREA:', areaLabelX, y);
    doc.setFont('helvetica', 'normal');
    const area = datosExtra.area || '________________________';
    doc.text(area, areaLabelX + 18, y);

    // Dejar espacio extra antes de la tabla (menos espacio)
    y += 4;
    

        // Preparar datos para la tabla
        const tableData = [];
        // Mostrar asistentes (de 4 a 15 filas por hoja)
        for (let i = 0; i < datosPagina.length; i++) {
            const asistente = datosPagina[i] || {};
            const numeroGlobal = offsetRegistro + i + 1;
            // Si es la última fila de la última página, poner el bloque de evaluación en DESCRIPCIÓN
            if (pagina === totalPaginas - 1 && i === datosPagina.length - 1) {
                let evalText = 'EVALUACIÓN\n\nSe realizó:   Si   □    No   □\n\nResultado:';
                tableData.push([
                    evalText,
                    numeroGlobal,
                    asistente.nombre_completo || '',
                    asistente.cedula || '',
                    asistente.cargo || '',
                    asistente.firma || '',
                    asistente.codigo_lec || ''
                ]);
            } else {
                tableData.push([
                    '',
                    numeroGlobal,
                    asistente.nombre_completo || '',
                    asistente.cedula || '',
                    asistente.cargo || '',
                    asistente.firma || '',
                    asistente.codigo_lec || ''
                ]);
            }
        }
    
    doc.autoTable({
        startY: y,
        head: [['DESCRIPCIÓN', '#', 'NOMBRE COMPLETO', 'CÉDULA', 'CARGO', 'FIRMA', 'CÓDIGO']],
        body: tableData,
        theme: 'grid',
        styles: {
            fontSize: 5.5,
            cellPadding: 0.2,
            valign: 'middle',
            lineWidth: 0.1,
            lineColor: [0, 0, 0],
            minCellHeight: 10,
            cellHeight: 10,
            overflow: 'linebreak'
        },
        headStyles: {
            fillColor: [96, 125, 139],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            minCellHeight: 10,
            cellHeight: 10,
            fontSize: 6.5
        },
        columnStyles: {
            0: { cellWidth: 28, fontStyle: 'bold', valign: 'top', fontSize: 5.5 },
            1: { halign: 'center', cellWidth: 7, valign: 'middle' },
            2: { cellWidth: 52, valign: 'middle', fontSize: 5.5 },
            3: { halign: 'center', cellWidth: 20, valign: 'middle', fontSize: 5.5 },
            4: { halign: 'center', cellWidth: 26, valign: 'middle', fontSize: 5.5 },
            5: { halign: 'center', cellWidth: 20, valign: 'middle' },
            6: { halign: 'center', cellWidth: 18, valign: 'middle', fontSize: 5.5 }
        },
        willDrawCell: function(data) {
            // Para la columna FIRMA, limpiar el texto de la URL
            if (data.column.index === 5 && data.section === 'body') {
                data.cell.text = [];
            }
        },
        didDrawCell: function(data) {
            // Insertar imágenes de firma en la columna FIRMA (índice 5)
            if (data.column.index === 5 && data.section === 'body') {
                const asistente = datosPagina[data.row.index];
                const firmaUrl = asistente?.firma;
                if (firmaUrl && firmaUrl.startsWith('http')) {
                    const cell = data.cell;
                    const padding = 0.3;
                    const maxImgWidth = cell.width - (padding * 2);
                    const maxImgHeight = cell.height - (padding * 2);
                    const yOffset = padding;
                    try {
                        doc.addImage(
                            firmaUrl,
                            'PNG',
                            cell.x + padding,
                            cell.y + yOffset,
                            maxImgWidth,
                            maxImgHeight,
                            undefined,
                            'NONE'
                        );
                    } catch (e) {
                        console.error('Error al cargar firma:', e);
                    }
                }
            }
        },
        margin: { left: 14, right: 14 }
    });
    
    // Firma del instructor en todas las páginas - en pie de página
    const pageHeight = doc.internal.pageSize.getHeight();
    const footerY = pageHeight - 8; // Mucho más cerca del borde inferior
    doc.line(14, footerY, 80, footerY);
    doc.setFontSize(7);
    doc.text('FIRMA DEL INSTRUCTOR', 30, footerY + 4);

    // Mostrar imagen de la firma del instructor si existe la URL en registro.firma_sup
    if (registro.firma_sup && typeof registro.firma_sup === 'string' && registro.firma_sup.startsWith('http')) {
        try {
            // Ajustar tamaño y posición de la imagen de la firma
            doc.addImage(
                registro.firma_sup,
                'PNG',
                14, // x
                footerY - 14, // y (justo encima de la línea)
                60, // ancho
                12 // alto
            );
        } catch (e) {
            console.error('Error al cargar la firma del instructor:', e);
        }
    }
}