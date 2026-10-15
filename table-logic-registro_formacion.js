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
            <div style="background: #f8fafc; color: #0f172a; padding: 30px; border-radius: 10px; min-width: 350px; max-width: 95vw; box-shadow: 0 8px 32px rgba(0,0,0,0.25); z-index:10000; position:relative; border: 1px solid #cbd5e1;">
                <h3 style="color: #1e293b; margin: 0 0 14px 0; font-weight: 700;">Cargar datos por texto</h3>
                <div style="margin-bottom:10px;">
                    <textarea id="textoCarga" rows="8" style="width:100%; min-width:300px; max-width:500px; background: #ffffff; color: #0f172a; border: 1px solid #64748b; border-radius: 6px; padding: 10px;"></textarea>
                </div>
                <div id="cargarTextoMsg" style="color:#b91c1c; margin-bottom:10px; font-weight: 600;"></div>
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
const columnasOcultasVista = [
    'firma',
    'pdf',
    'firma_sup',
    'numero_formulario',
    'codigo',
    'origen',
    'objetivo',
    'aspectos',
    'cedula',
    'cargo'
];

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

function toggleGuideMenu(event) {
    event.preventDefault();
    event.stopPropagation();

    const guideDropdown = document.getElementById('guideDropdown');
    if (!guideDropdown) return;

    guideDropdown.style.display = guideDropdown.style.display === 'block' ? 'none' : 'block';
}

function closeGuideMenu() {
    const guideDropdown = document.getElementById('guideDropdown');
    if (!guideDropdown) return;
    guideDropdown.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('click', function(event) {
        const guideMenu = document.getElementById('guideMenu');
        if (guideMenu && !guideMenu.contains(event.target)) {
            closeGuideMenu();
        }
    });

    // Búsqueda en vivo por Tema (con autocompletado): filtra mientras se escribe
    // o al seleccionar una sugerencia del datalist.
    const filterTema = document.getElementById('filterTema');
    if (filterTema) {
        filterTema.addEventListener('input', function() {
            applyFilter();
        });
    }

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
            populateTemasDatalist();
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
        if (col !== 'id' && !columnasOcultasVista.includes(col)) {
            filterColumn.innerHTML += `<option value="${col}">${formatColumnName(col)}</option>`;
        }
    });
}

// Llena el datalist de autocompletado con los temas únicos disponibles.
function populateTemasDatalist() {
    const datalist = document.getElementById('temasDatalist');
    if (!datalist) return;

    const temasUnicos = Array.from(new Set(
        (allData || [])
            .map(r => (r && r.tema ? r.tema.toString().trim() : ''))
            .filter(t => t !== '')
    )).sort((a, b) => a.localeCompare(b));

    datalist.innerHTML = temasUnicos
        .map(tema => `<option value="${tema.replace(/"/g, '&quot;')}"></option>`)
        .join('');
}

function formatColumnName(col) {
    return col
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

function renderTable() {
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');

        // Encabezados de la tabla de estadísticas
    tableHead.innerHTML = '<tr>' +
        '<th style="width: 120px;">Fecha</th>' +
        '<th>Tema</th>' +
        '<th style="width: 200px; text-align: center;">Funcionarios Registrados</th>' +
        '</tr>';

    // Agrupar por fecha (de más reciente a más antigua)
    const grupos = agruparEstadisticasPorFecha(currentData);

    if (grupos.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: #7f8c8d;">No hay registros en esta tabla</td></tr>';
        return;
    }

    let bodyHTML = '';

    grupos.forEach(grupo => {
        const totalTemasFecha = grupo.temas.length;
        // Fila cabecera de la fecha
        bodyHTML += '<tr class="stat-date-row">' +
            '<td colspan="3" style="background: #1e293b; color: #fff; font-weight: 700; padding: 10px 12px; font-size: 14px;">' +
            '📅 ' + formatearFecha(grupo.fecha) +
            ' <span style="font-weight: 400; opacity: 0.8;">(' + totalTemasFecha + ' tema' + (totalTemasFecha === 1 ? '' : 's') + ')</span>' +
            '</td></tr>';

        grupo.temas.forEach(tema => {
            bodyHTML += '<tr>' +
                '<td style="color: #94a3b8; font-size: 12px;">' + formatearFecha(grupo.fecha) + '</td>' +
                '<td style="font-weight: 600; color: #ffffff;">' + (tema.tema || '-') + '</td>' +
                '<td style="text-align: center; font-weight: 700; color: ' + (tema.codigos.length > 0 ? '#4ade80' : '#94a3b8') + '; font-size: 16px;">' +
                tema.codigos.length +
                '</td>' +
                '</tr>';
        });
    });

    tableBody.innerHTML = bodyHTML;
}

// Agrupa los registros por fecha (desc) y dentro de cada fecha por tema (valor único),
// determinando cuántos codigo_lec únicos están asociados a cada tema.
function agruparEstadisticasPorFecha(registros) {
    const porFecha = new Map();

    (registros || []).forEach(row => {
        if (!row) return;
        const fecha = (row.fecha || '').toString().split('T')[0];
        const temaRaw = (row.tema || '').toString().trim();
        const codigoLec = (row.codigo_lec || '').toString().trim();

        if (!porFecha.has(fecha)) {
            porFecha.set(fecha, new Map());
        }
        const porTema = porFecha.get(fecha);

        if (!porTema.has(temaRaw)) {
            porTema.set(temaRaw, new Set());
        }
        // Solo agregamos códigos lector válidos (no vacíos, no el literal "null")
        if (codigoLec && codigoLec.toLowerCase() !== 'null') {
            porTema.get(temaRaw).add(codigoLec);
        }
    });

    // Convertir a array ordenado por fecha descendente
    const grupos = [];
    Array.from(porFecha.keys())
        .sort((a, b) => (b || '').localeCompare(a || ''))
        .forEach(fecha => {
            const porTema = porFecha.get(fecha);
            const temas = Array.from(porTema.keys())
                .sort((a, b) => (a || '').localeCompare(b || ''))
                .map(tema => ({
                    tema: tema,
                    codigos: Array.from(porTema.get(tema)).sort()
                }));
            grupos.push({ fecha: fecha, temas: temas });
        });

    return grupos;
}

// Formatea una fecha ISO (yyyy-mm-dd) a dd/mm/yyyy
function formatearFecha(fecha) {
    if (!fecha) return '-';
    const partes = fecha.split('T')[0].split('-');
    if (partes.length === 3) {
        return partes[2] + '/' + partes[1] + '/' + partes[0];
    }
    return fecha;
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
    // La vista de estadísticas muestra todos los temas agrupados por fecha,
    // por lo que no requiere paginación de filas.
    const pagination = document.getElementById('pagination');
    if (pagination) pagination.innerHTML = '';
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

function applyFilter() {
    const searchText = document.getElementById('filterSearch').value.toLowerCase();
    const filterColumn = document.getElementById('filterColumn').value;
    const temaFilter = (document.getElementById('filterTema')?.value || '').toLowerCase().trim();
    
    if (!searchText && !temaFilter) {
        currentData = allData;
    } else {
        currentData = allData.filter(row => {
            // Filtro por Tema (buscador con autocompletado)
            if (temaFilter) {
                const tema = (row.tema || '').toString().toLowerCase();
                if (!tema.includes(temaFilter)) return false;
            }

            // Filtro general por texto
            if (!searchText) return true;

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
    const filterTema = document.getElementById('filterTema');
    if (filterTema) filterTema.value = '';
    currentData = allData;
    currentPage = 1;
    renderTable();
    renderPagination();
}