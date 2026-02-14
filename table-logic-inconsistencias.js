// Table logic especializado para inconsistencias con estadísticas de revisores
const PRIMARY_KEY = 'id'; // Asumiendo que la tabla tiene un campo id como primary key
const TABLE_NAME = 'inconsistencias';
const TABLE_TITLE = '⚠️ Inconsistencias';

// Variables globales
let fullData = []; // TODOS los registros para estadísticas y operaciones
let tableData = []; // Subconjunto visible en la tabla
const VIEW_LIMIT = 20; // Límite de filas visibles en la tabla
let currentPage = 1; // Página actual
let currentDataSource = []; // Fuente actual (fullData o filtrado)
let columns = [];
let isEditing = false;
let currentEditId = null;
let estadisticasData = {};
let columnasRealesTabla = []; // Para almacenar las columnas reales de la tabla

const HIDDEN_TABLE_COLUMNS = new Set([
    'cod_tipo_consumo',
    'codigo_tipo',
    'lectura_anterior',
    'lectura_tres_meses',
    'lectura_3_meses',
    'lectura_cuatro_meses',
    'lectura_4_meses',
    'serie',
    'motivo_revision',
    'orden',
    'servicio_suscrito',
    'periodo_facturacion',
    'coordenada_instalacion',
    'coordenadas_instalacion',
    'causa_lectura_observacion',
    'causa_observacion',
    'observacion_adicional_real',
    'alfanumerica_revisor',
    'lectura_real',
    'correcciones_en_sistema',
    'geolocalizacion',
    'firma_revisor',
    'advertencia_revisor',
    'ciclo'
]);

function shouldHideInInconsistenciasTable(columnName) {
    return HIDDEN_TABLE_COLUMNS.has(columnName) || columnName.includes('fecha') || columnName.includes('foto');
}

// Filtro de búsqueda para la tabla
window.filterTable = function() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    if (!Array.isArray(fullData)) return;
    const filteredAll = fullData.filter(row => {
        return Object.values(row).some(val => (val || '').toString().toLowerCase().includes(search));
    });
    currentDataSource = filteredAll;
    currentPage = 1;
    updateTableSlice();
    renderTable(tableData);
}

// Función para cargar datos
async function loadData() {
    console.log('🔄 Cargando datos de', TABLE_NAME);
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    
    if (!loadingIndicator || !tableContainer) {
        console.error('❌ Elementos DOM no encontrados');
        return;
    }
    
    try {
        loadingIndicator.style.display = 'block';
        tableContainer.innerHTML = '';
        
        console.log('📡 Consultando Supabase (todos los registros)...');
        // 1) Obtener conteo total de registros
        const { count, error: countError } = await supabase
            .from(TABLE_NAME)
            .select(PRIMARY_KEY, { count: 'exact', head: true });

        if (countError) {
            console.error('❌ Error obteniendo conteo:', countError);
            throw countError;
        }

        const total = count || 0;
        console.log('📦 Total de registros en BD:', total);

        // 2) Paginar y traer todos los registros en lotes (evita límite de 1000)
        const batchSize = 1000;
        let allData = [];

        for (let from = 0; from < total; from += batchSize) {
            const to = Math.min(from + batchSize - 1, total - 1);
            console.log(`🔄 Descargando lote ${from}-${to}...`);
            const { data: batch, error: batchError } = await supabase
                .from(TABLE_NAME)
                .select('*')
                .order(PRIMARY_KEY, { ascending: false })
                .range(from, to);

            if (batchError) {
                console.error('❌ Error obteniendo lote:', batchError);
                throw batchError;
            }

            allData = allData.concat(batch || []);
        }

        console.log('✅ Datos cargados:', allData.length, 'registros');
        fullData = allData;
        currentDataSource = fullData;
        currentPage = 1;
        updateTableSlice();
        
        if (tableData.length > 0) {
            // Detectar columnas reales de la tabla
            columnasRealesTabla = Object.keys(fullData[0]);
            console.log('📋 Columnas reales detectadas en la tabla:', columnasRealesTabla);
            
            columns = columnasRealesTabla.filter(col => col !== PRIMARY_KEY);
        } else {
            console.log('⚠️ No hay datos en la tabla para detectar columnas');
        }
        
        // Calcular estadísticas
        calcularEstadisticas();
        
        renderTable();
        
    } catch (error) {
        console.error('❌ Error al cargar datos:', error);
        tableContainer.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 2rem; color: #dc3545;">
                <h3>❌ Error al cargar los datos</h3>
                <p>${error.message}</p>
                <button onclick="loadData()" class="btn btn-primary" style="margin-top: 1rem;">🔄 Reintentar</button>
            </div>
        `;
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Función para calcular estadísticas de revisores
function calcularEstadisticas() {
    console.log('📊 Calculando estadísticas de revisores...');
    estadisticasData = {};
    
    // Obtener todos los revisores únicos
    const revisores = [...new Set(fullData
        .map(row => row.nombre_revisor)
        .filter(nombre => nombre && nombre.trim() !== '')
    )];
    
    console.log('👥 Revisores encontrados:', revisores);
    
    revisores.forEach(revisor => {
        // Contar total de registros asignados al revisor
        const totalAsignados = fullData.filter(row => row.nombre_revisor === revisor).length;
        
        // Contar registros con PDF (revisiones completadas)
        const conPdf = fullData.filter(row => 
            row.nombre_revisor === revisor && 
            row.pdf && 
            row.pdf.trim() !== ''
        ).length;
        
        // Calcular porcentaje de avance
        const porcentajeAvance = totalAsignados > 0 ? Math.round((conPdf / totalAsignados) * 100) : 0;
        
        estadisticasData[revisor] = {
            totalAsignados,
            conPdf,
            sinPdf: totalAsignados - conPdf,
            porcentajeAvance
        };
    });
    
    console.log('📈 Estadísticas calculadas:', estadisticasData);
}

// Función para renderizar tabla
function getTotalPages() {
    return Math.max(1, Math.ceil((currentDataSource?.length || 0) / VIEW_LIMIT));
}

function updateTableSlice() {
    const start = (currentPage - 1) * VIEW_LIMIT;
    tableData = (currentDataSource || []).slice(start, start + VIEW_LIMIT);
}

window.goToPage = function(page) {
    const total = getTotalPages();
    currentPage = Math.min(Math.max(1, page), total);
    updateTableSlice();
    renderTable(tableData);
}

window.prevPage = function() { window.goToPage(currentPage - 1); }
window.nextPage = function() { window.goToPage(currentPage + 1); }

function getCiclosUnicos() {
    return [...new Set(fullData
        .map(row => row.ciclo ?? row.CICLO)
        .filter(ciclo => ciclo !== null && ciclo !== undefined && String(ciclo).trim() !== '')
        .map(ciclo => String(ciclo).trim())
    )]
        .sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }));
}

function updateCiclosInfoField() {
    const ciclosInfo = document.getElementById('ciclosInfo');
    if (!ciclosInfo) return;
    const ciclosUnicos = getCiclosUnicos();
    ciclosInfo.textContent = `Ciclos: ${ciclosUnicos.length > 0 ? ciclosUnicos.join(', ') : '-'}`;
}

function updateInconsistenciasStickyOffsets() {
    const wrapper = document.querySelector('.inconsistencias-table-wrapper');
    if (!wrapper) return;

    const searchRow = wrapper.querySelector('.sticky-search-row');
    const tableInfo = wrapper.querySelector('.sticky-table-info');

    const searchHeight = searchRow ? searchRow.offsetHeight : 0;
    const infoHeight = tableInfo ? tableInfo.offsetHeight : 0;

    wrapper.style.setProperty('--sticky-search-height', `${searchHeight}px`);
    wrapper.style.setProperty('--sticky-info-height', `${infoHeight}px`);
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

window.toggleAlfanumericaLector = function(event, linkElement, fullEncoded, shortEncoded) {
    event.preventDefault();
    const previewElement = linkElement.previousElementSibling;
    if (!previewElement) return;

    const fullText = decodeURIComponent(fullEncoded);
    const shortText = decodeURIComponent(shortEncoded);
    const expanded = previewElement.dataset.expanded === 'true';

    if (expanded) {
        previewElement.textContent = shortText;
        previewElement.dataset.expanded = 'false';
        linkElement.textContent = 'Ver más..';
    } else {
        previewElement.textContent = fullText;
        previewElement.dataset.expanded = 'true';
        linkElement.textContent = 'Ver menos';
    }
}

function renderTable() {
    const tableContainer = document.getElementById('tableContainer');
    // Permitir pasar datos filtrados
    let data = Array.isArray(arguments[0]) ? arguments[0] : tableData;
    const visibleColumns = columns.filter(col => !shouldHideInInconsistenciasTable(col));
    updateCiclosInfoField();

    if (data.length === 0) {
        tableContainer.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 3rem;">
                <h3>📭 No hay registros</h3>
                <p>No se encontraron inconsistencias registradas</p>
                <button onclick="openCreateModal()" class="btn btn-primary">➕ Agregar Registro</button>
            </div>
        `;
        return;
    }
    const totalPages = getTotalPages();
    const startIndex = (currentPage - 1) * VIEW_LIMIT + (data.length > 0 ? 1 : 0);
    const endIndex = (currentPage - 1) * VIEW_LIMIT + data.length;
    const prevDisabled = currentPage === 1 ? 'disabled' : '';
    const nextDisabled = currentPage === totalPages ? 'disabled' : '';
    let tableHTML = `
        <div class="table-info sticky-table-info" style="margin-bottom: 0; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span class="record-count">📊 Mostrando ${startIndex}-${endIndex} de ${currentDataSource.length} registros ${currentDataSource !== fullData ? `(filtrado de ${fullData.length})` : ''}</span>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <button onclick="prevPage()" class="btn btn-secondary" ${prevDisabled}>◀️ Anterior</button>
                <span>Página ${currentPage} de ${totalPages}</span>
                <button onclick="nextPage()" class="btn btn-secondary" ${nextDisabled}>Siguiente ▶️</button>
            </div>
            <div style="display: flex; align-items: center; min-width: 180px; justify-content: flex-end;">
                <button onclick="openEstadisticasModal()" class="btn btn-info" style="background: #17a2b8; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer;">📈 Ver Estadísticas</button>
            </div>
        </div>
        <table class="data-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
    `;
    visibleColumns.forEach(col => {
        tableHTML += `<th style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: left; color: #212529; font-weight: bold;">${formatColumnName(col)}</th>`;
    });
    tableHTML += '<th style="padding: 0.75rem; border: 1px solid #dee2e6; color: #212529; font-weight: bold;">Acciones</th></tr></thead><tbody>';
    data.forEach(row => {
        tableHTML += '<tr>';
        visibleColumns.forEach(col => {
            let value = row[col];
            // Formateo específico para inconsistencias
            if (col === 'nombre_revisor' && value) {
                const stats = estadisticasData[value];
                if (stats) {
                    value = `${value} <span style="font-size: 0.8em; color: #6c757d;">(${stats.porcentajeAvance}%)</span>`;
                }
            } else if (col === 'alfanumerica_lector' && value) {
                const fullText = String(value);
                const shortText = fullText.slice(0, 4);
                if (fullText.length > 4) {
                    const fullEncoded = encodeURIComponent(fullText);
                    const shortEncoded = encodeURIComponent(shortText);
                    value = `<span data-expanded="false">${escapeHtml(shortText)}</span> <a href="#" onclick="toggleAlfanumericaLector(event, this, '${fullEncoded}', '${shortEncoded}')">Ver más..</a>`;
                } else {
                    value = escapeHtml(fullText);
                }
            } else if (col === 'pdf') {
                value = value && value.trim() !== '' ? 
                    '<span style="color: #28a745;">✅ Completado</span>' : 
                    '<span style="color: #dc3545;">❌ Pendiente</span>';
            } else if (value === null || value === undefined || value === '') {
                value = '<span style="color: #6c757d;">-</span>';
            }
            tableHTML += `<td style="padding: 0.75rem; border: 1px solid #dee2e6;">${value}</td>`;
        });
        tableHTML += `
            <td style="padding: 0.75rem; border: 1px solid #dee2e6;">
                <button onclick="openEditModal(${row[PRIMARY_KEY]})" class="btn-action" style="margin-right: 0.25rem; padding: 0.25rem 0.5rem; background: #007bff; color: white; border: none; border-radius: 0.25rem; cursor: pointer;">✏️</button>
                <button onclick="deleteRecord(${row[PRIMARY_KEY]})" class="btn-action" style="padding: 0.25rem 0.5rem; background: #dc3545; color: white; border: none; border-radius: 0.25rem; cursor: pointer;">🗑️</button>
            </td>
        `;
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table>';
    tableContainer.innerHTML = tableHTML;
    updateInconsistenciasStickyOffsets();
}

window.addEventListener('resize', updateInconsistenciasStickyOffsets);

// Función para abrir modal de estadísticas
function openEstadisticasModal() {
    let estadisticasHTML = `
        <div class="estadisticas-content">
            <h3 style="color: #f1f5f9;">📈 Estadísticas de Revisores</h3>
            <div class="estadisticas-grid" style="display: grid; gap: 1rem; margin-top: 1rem;">
    `;
    
    // Calcular totales generales
    const totalRegistros = fullData.length;
    const totalConPdf = fullData.filter(row => row.pdf && row.pdf.trim() !== '').length;
    const totalSinPdf = totalRegistros - totalConPdf;
    const promedioAvance = totalRegistros > 0 ? Math.round((totalConPdf / totalRegistros) * 100) : 0;
    
    // Resumen general
    estadisticasHTML += `
        <div class="estadistica-card" style="background: #1e293b; padding: 1rem; border-radius: 0.5rem; border-left: 4px solid #64748b; border: 1px solid #334155;">
            <h4 style="color: #e2e8f0;">📊 Resumen General</h4>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-top: 0.5rem; color: #e2e8f0;">
                <div><strong style="color: #cbd5e1;">Total Registros:</strong> ${totalRegistros}</div>
                <div><strong style="color: #cbd5e1;">Avance General:</strong> ${promedioAvance}%</div>
                <div><strong style="color: #28a745;">Con PDF:</strong> <span style="color: #28a745;">${totalConPdf}</span></div>
                <div><strong style="color: #dc3545;">Sin PDF:</strong> <span style="color: #dc3545;">${totalSinPdf}</span></div>
            </div>
        </div>
    `;
    
    // Estadísticas por revisor (ordenadas por nombre de menor a mayor)
    Object.entries(estadisticasData)
        .sort((a, b) => a[0].localeCompare(b[0], 'es', { sensitivity: 'base' }))
        .forEach(([revisor, stats]) => {
            const colorBarra = stats.porcentajeAvance >= 80 ? '#28a745' : 
                             stats.porcentajeAvance >= 50 ? '#ffc107' : '#dc3545';
            
            estadisticasHTML += `
                <div class="estadistica-card" style="background: #1e293b; padding: 1rem; border-radius: 0.5rem; border: 1px solid #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.25);">
                    <h4 style="margin: 0 0 0.5rem 0; color: #cbd5e1;">👤 ${revisor}</h4>
                    
                    <div style="margin-bottom: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                            <span style="color: #e2e8f0; font-weight: 500;">Avance:</span>
                            <strong style="color: ${colorBarra};">${stats.porcentajeAvance}%</strong>
                        </div>
                        <div style="background: #334155; border-radius: 0.25rem; overflow: hidden;">
                            <div style="background: ${colorBarra}; height: 0.5rem; width: ${stats.porcentajeAvance}%; transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; font-size: 0.875rem; color: #e2e8f0;">
                        <div><strong style="color: #cbd5e1;">Total:</strong> ${stats.totalAsignados}</div>
                        <div><strong style="color: #28a745;">Con PDF:</strong> ${stats.conPdf}</div>
                        <div><strong style="color: #dc3545;">Pendientes:</strong> ${stats.sinPdf}</div>
                    </div>
                </div>
            `;
        });
    
    estadisticasHTML += `
            </div>
            <div class="modal-footer" style="margin-top: 1.5rem; text-align: right; border-top: 1px solid #334155; padding-top: 0.75rem;">
                <button onclick="closeEstadisticasModal()" class="btn btn-secondary" style="padding: 0.5rem 1rem; border: none; border-radius: 0.25rem; cursor: pointer;">Cerrar</button>
            </div>
        </div>
    `;
    
    // Crear modal de estadísticas
    const estadisticasModal = document.createElement('div');
    estadisticasModal.id = 'estadisticasModal';
    estadisticasModal.className = 'modal';
    estadisticasModal.style.cssText = `
        display: block;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(2,6,23,0.75);
    `;
    
    estadisticasModal.innerHTML = `
        <div class="modal-content" style="
            background: linear-gradient(to bottom, #0f172a, #111827);
            color: #e2e8f0;
            margin: 2% auto;
            padding: 1.5rem;
            border: 1px solid #334155;
            width: 90%;
            max-width: 800px;
            border-radius: 0.5rem;
            max-height: 90vh;
            overflow-y: auto;
        ">${estadisticasHTML}</div>
    `;

    document.body.style.overflow = 'hidden';
    document.body.appendChild(estadisticasModal);
}

function closeEstadisticasModal() {
    const estadisticasModal = document.getElementById('estadisticasModal');
    if (estadisticasModal) {
        document.body.removeChild(estadisticasModal);
    }
    document.body.style.overflow = '';
}

function formatColumnName(columnName) {
    const nameMap = {
        'direccion': 'Dirección',
        'instalacion': 'Instalación',
        'tipo_consumo': 'Tipo Consumo',
        'cod_tipo_consumo': 'Código Tipo',
        'serie': 'Serie',
        'lectura_actual': 'Lectura Actual',
        'lectura_anterior': 'Lectura Anterior',
        'lectura_tres_meses': 'Lectura 3 Meses',
        'lectura_cuatro_meses': 'Lectura 4 Meses',
        'motivo_revision': 'Motivo Revisión',
        'municipio': 'Municipio',
        'ciclo': 'Ciclo',
        'orden': 'Orden',
        'servicio_suscrito': 'Servicio Suscrito',
        'correria': 'Correría',
        'categoria': 'Categoría',
        'fecha_lectura_anterior': 'Fecha Lectura Anterior',
        'fecha_lectura_actual': 'Fecha Lectura Actual',
        'periodo_facturacion': 'Período Facturación',
        'causa_lectura_observacion': 'Causa Observación',
        'observacion_adicional': 'Observación Adicional',
        'alfanumerica_lector': 'Alfanumérica Lector',
        'lector': 'Lector',
        'nombre_revisor': 'Revisor',
        'pdf': 'PDF',
        'fecha_revision': 'Fecha Revisión',
        'estado': 'Estado',
        'tipo_inconsistencia': 'Tipo',
        'descripcion': 'Descripción',
        'observaciones': 'Observaciones',
        'prioridad': 'Prioridad'
    };
    return nameMap[columnName] || columnName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Modal functions
function openCreateModal() {
    isEditing = false;
    currentEditId = null;
    document.getElementById('modalTitle').textContent = 'Nueva Inconsistencia';
    document.getElementById('recordId').value = '';
    generateForm();
    document.getElementById('dataModal').style.display = 'block';
}

function openEditModal(id) {
    isEditing = true;
    currentEditId = id;
    document.getElementById('modalTitle').textContent = 'Editar Inconsistencia';
    document.getElementById('recordId').value = id;
    
    const record = tableData.find(item => item[PRIMARY_KEY] === id);
    if (record) {
        generateForm(record);
        document.getElementById('dataModal').style.display = 'block';
    }
}

function generateForm(data = null) {
    const formFields = document.getElementById('formFields');
    let formHTML = '';
    
    columns.forEach(column => {
        if (column === PRIMARY_KEY && !isEditing) return;
        
        const value = data ? data[column] || '' : '';
        const fieldId = `field_${column}`;
        const label = formatColumnName(column);
        const readonly = column === PRIMARY_KEY && isEditing ? 'readonly' : '';
        
        if (column === 'tipo_inconsistencia') {
            formHTML += `
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="${fieldId}" style="display: block; margin-bottom: 0.25rem; font-weight: bold;">${label}:</label>
                    <select id="${fieldId}" name="${column}" class="form-control" style="width: 100%; padding: 0.375rem 0.75rem; border: 1px solid #ced4da; border-radius: 0.25rem;">
                        <option value="">Seleccionar tipo...</option>
                        <option value="lectura" ${value === 'lectura' ? 'selected' : ''}>📊 Error de Lectura</option>
                        <option value="datos" ${value === 'datos' ? 'selected' : ''}>📋 Error de Datos</option>
                        <option value="sistema" ${value === 'sistema' ? 'selected' : ''}>💻 Error de Sistema</option>
                        <option value="usuario" ${value === 'usuario' ? 'selected' : ''}>👤 Error de Usuario</option>
                    </select>
                </div>
            `;
        } else if (column === 'prioridad') {
            formHTML += `
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="${fieldId}" style="display: block; margin-bottom: 0.25rem; font-weight: bold;">${label}:</label>
                    <select id="${fieldId}" name="${column}" class="form-control" style="width: 100%; padding: 0.375rem 0.75rem; border: 1px solid #ced4da; border-radius: 0.25rem;">
                        <option value="">Seleccionar prioridad...</option>
                        <option value="alta" ${value === 'alta' ? 'selected' : ''}>🔴 Alta</option>
                        <option value="media" ${value === 'media' ? 'selected' : ''}>🟡 Media</option>
                        <option value="baja" ${value === 'baja' ? 'selected' : ''}>🟢 Baja</option>
                    </select>
                </div>
            `;
        } else if (column === 'descripcion' || column === 'observaciones') {
            formHTML += `
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="${fieldId}" style="display: block; margin-bottom: 0.25rem; font-weight: bold;">${label}:</label>
                    <textarea id="${fieldId}" name="${column}" class="form-control" rows="3" style="width: 100%; padding: 0.375rem 0.75rem; border: 1px solid #ced4da; border-radius: 0.25rem;" placeholder="Escriba aquí...">${value}</textarea>
                </div>
            `;
        } else if (column.includes('fecha')) {
            formHTML += `
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="${fieldId}" style="display: block; margin-bottom: 0.25rem; font-weight: bold;">${label}:</label>
                    <input type="date" id="${fieldId}" name="${column}" value="${value}" class="form-control" style="width: 100%; padding: 0.375rem 0.75rem; border: 1px solid #ced4da; border-radius: 0.25rem;">
                </div>
            `;
        } else {
            const inputType = column === PRIMARY_KEY ? 'number' : 'text';
            formHTML += `
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label for="${fieldId}" style="display: block; margin-bottom: 0.25rem; font-weight: bold;">${label}:</label>
                    <input type="${inputType}" id="${fieldId}" name="${column}" value="${value}" class="form-control" style="width: 100%; padding: 0.375rem 0.75rem; border: 1px solid #ced4da; border-radius: 0.25rem;" ${readonly}>
                </div>
            `;
        }
    });
    
    formFields.innerHTML = formHTML;
}

function closeModal() {
    document.getElementById('dataModal').style.display = 'none';
    document.getElementById('dataForm').reset();
}

// Form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    console.log('📝 Enviando formulario...');
    
    const formData = new FormData(e.target);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        if (value !== '') {
            data[key] = value;
        }
    }
    
    try {
        if (isEditing) {
            console.log('🔄 Actualizando registro:', currentEditId);
            const { error } = await supabase
                .from(TABLE_NAME)
                .update(data)
                .eq(PRIMARY_KEY, currentEditId);
            
            if (error) throw error;
        } else {
            console.log('➕ Creando nuevo registro');
            const { error } = await supabase
                .from(TABLE_NAME)
                .insert([data]);
            
            if (error) throw error;
        }
        
        console.log('✅ Operación exitosa');
        closeModal();
        loadData();
        
    } catch (error) {
        console.error('❌ Error al guardar:', error);
        alert('Error: ' + error.message);
    }
}

// Delete record
async function deleteRecord(id) {
    if (!confirm('¿Está seguro de que desea eliminar este registro?')) {
        return;
    }
    
    try {
        console.log('🗑️ Eliminando registro:', id);
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq(PRIMARY_KEY, id);
        
        if (error) throw error;
        
        console.log('✅ Registro eliminado');
        loadData();
        
    } catch (error) {
        console.error('❌ Error al eliminar:', error);
        alert('Error: ' + error.message);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando aplicación de inconsistencias...');
    
    // Check if supabase is available
    if (!window.supabase) {
        console.error('❌ Supabase no disponible');
        const tableContainer = document.getElementById('tableContainer');
        if (tableContainer) {
            tableContainer.innerHTML = '<div style="color: red; text-align: center; padding: 2rem;">❌ Error: Supabase no está disponible</div>';
        }
        return;
    }
    
    // Add form submit handler
    const form = document.getElementById('dataForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
        console.log('✅ Event listener agregado al formulario');
    }
    
    // Close modals when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('dataModal');
        const estadisticasModal = document.getElementById('estadisticasModal');
        const csvModal = document.getElementById('csvModal');
        const csvTextoModal = document.getElementById('csvTextoModal');
        
        if (event.target === modal) {
            closeModal();
        } else if (event.target === estadisticasModal) {
            closeEstadisticasModal();
        } else if (event.target === csvModal) {
            cerrarModalCSV();
        } else if (event.target === csvTextoModal) {
            cerrarModalTextoCSV();
        }
    };
    
    // Load initial data
    loadData();
});

// Función para descargar plantilla Excel de ejemplo
function descargarPlantillaExcel() {
    console.log('📋 Generando plantilla Excel de ejemplo...');
    
    // Datos de ejemplo para la plantilla
    const datosEjemplo = [
        {
            direccion: 'Calle 123 #45-67',
            instalacion: '059818400000440000',
            tipo_consumo: 'Residencial',
            cod_tipo_consumo: 'R1',
            serie: 'MED001234',
            lectura_actual: '15678',
            lectura_anterior: '15523',
            lectura_tres_meses: '15367',
            lectura_cuatro_meses: '15201',
            motivo_revision: 'Inspeccionar causa/observacion y lectura real',
            municipio: 'Envigado',
            ciclo: '1',
            orden: '001',
            servicio_suscrito: 'Gas',
            correria: '10001728380',
            categoria: 'Residencial',
            fecha_lectura_anterior: '10/11/2024',
            fecha_lectura_actual: '10/12/2024',
            periodo_facturacion: '202412',
            causa_lectura_observacion: 'Medidor con falla en display',
            observacion_adicional: 'Requiere cambio de medidor',
            alfanumerica_lector: 'LP001',
            lector: 'LEC_154',
            nombre_revisor: 'AUX_003',
            pdf: '',
            fecha_revision: '',
            estado: 'pendiente',
            tipo_inconsistencia: 'lectura',
            descripcion: 'Inconsistencia en lectura de medidor',
            observaciones: 'Requiere revisión técnica',
            prioridad: 'media'
        }
    ];
    
    // Columnas para la plantilla (excluyendo campos auto-generados y de control interno)
    const columnas = [
        'direccion',
        'instalacion', 
        'tipo_consumo',
        'cod_tipo_consumo',
        'serie',
        'lectura_actual',
        'lectura_anterior',
        'lectura_tres_meses',
        'lectura_cuatro_meses',
        'motivo_revision',
        'municipio',
        'ciclo',
        'orden',
        'servicio_suscrito',
        'correria',
        'categoria',
        'fecha_lectura_anterior',
        'fecha_lectura_actual',
        'periodo_facturacion',
        'causa_lectura_observacion',
        'observacion_adicional',
        'alfanumerica_lector',
        'lector',
        'nombre_revisor'
    ];
    
    // Crear datos para Excel
    const datosExcel = datosEjemplo.map(fila => {
        const filaExcel = {};
        columnas.forEach(columna => {
            filaExcel[columna] = fila[columna] || '';
        });
        return filaExcel;
    });
    
    // Crear libro de trabajo Excel
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datosExcel, { header: columnas });
    
    // Ajustar ancho de columnas
    const colWidths = columnas.map(col => ({ wch: Math.max(col.length, 15) }));
    ws['!cols'] = colWidths;
    
    // Agregar la hoja al libro
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Inconsistencias');
    
    // Descargar el archivo
    XLSX.writeFile(wb, 'plantilla_inconsistencias_ejemplo.xlsx');
    
    // Mostrar información sobre la plantilla
    alert(`📋 Plantilla Excel descargada correctamente!
    
📌 La plantilla incluye:
• 1 ejemplo completo de inconsistencia
• ${columnas.length} columnas con todos los campos disponibles
• Formatos correctos para cada tipo de dato

💡 Campos importantes:
• direccion: Dirección completa del medidor
• instalacion: Número de instalación único (REQUERIDO)
• serie: Serie del medidor
• lecturas: Actual, anterior, tres y cuatro meses atrás
• fechas: Formato DD/MM/YYYY
• nombre_revisor: Revisor asignado
• tipo_inconsistencia: lectura, datos, sistema, usuario
• prioridad: alta, media, baja
• estado: pendiente, en_proceso, completado

✅ Columnas opcionales se pueden dejar vacías
✅ Solo 'direccion' e 'instalacion' son requeridas
✅ Copie los datos desde Excel y péguelos en el botón Cargar CSV`);
    
    console.log('✅ Plantilla Excel generada y descargada');
}

// Función para exportar toda la tabla a Excel real (.xlsx)
async function exportarExcel() {
    console.log('📊 Exportando datos completos a Excel...');
    
    try {
        // Verificar que SheetJS esté disponible
        if (typeof XLSX === 'undefined') {
            alert('❌ Error: Librería Excel no disponible. Recargue la página.');
            return;
        }
        
        // Mostrar indicador de carga
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
        
        // Obtener TODOS los datos de la tabla sin límite
        console.log('📡 Obteniendo todos los registros de Supabase...');
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order(PRIMARY_KEY, { ascending: false });
        
        if (error) {
            console.error('❌ Error al obtener datos:', error);
            throw error;
        }
        
        if (!data || data.length === 0) {
            alert('⚠️ No hay datos para exportar');
            return;
        }
        
        console.log(`📊 Procesando ${data.length} registros para Excel...`);
        
        // Obtener todas las columnas
        const todasLasColumnas = Object.keys(data[0]);
        
        // Preparar datos limpios para Excel
        const datosLimpios = data.map(fila => {
            const filaLimpia = {};
            todasLasColumnas.forEach(col => {
                let valor = fila[col];
                // Manejar valores null/undefined
                if (valor === null || valor === undefined) {
                    valor = '';
                }
                filaLimpia[col] = valor;
            });
            return filaLimpia;
        });
        
        // Crear libro de Excel
        const workbook = XLSX.utils.book_new();
        
        // Crear hoja de cálculo con los datos originales
        const worksheet = XLSX.utils.json_to_sheet(datosLimpios, {
            origin: 'A1'
        });
        
        // Reemplazar los encabezados manualmente con nombres formateados
        todasLasColumnas.forEach((col, index) => {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: index });
            if (worksheet[cellAddress]) {
                worksheet[cellAddress].v = formatColumnName(col);
            }
        });
        
        // Configurar ancho de columnas automático
        const columnWidths = todasLasColumnas.map(col => {
            const maxLength = Math.max(
                formatColumnName(col).length,
                ...data.slice(0, 100).map(row => {
                    const value = row[col];
                    return value ? value.toString().length : 0;
                })
            );
            return { width: Math.min(Math.max(maxLength + 2, 10), 50) };
        });
        
        worksheet['!cols'] = columnWidths;
        
        // Aplicar estilo a los encabezados
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            if (worksheet[cellAddress]) {
                worksheet[cellAddress].s = {
                    font: { bold: true, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: { rgb: "366092" } },
                    alignment: { horizontal: "center" }
                };
            }
        }
        
        // Agregar hoja al libro
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Inconsistencias');
        
        // Generar nombre de archivo con fecha y hora
        const ahora = new Date();
        const fechaHora = ahora.toISOString().slice(0, 19).replace(/[T:]/g, '_');
        const nombreArchivo = `inconsistencias_completa_${fechaHora}.xlsx`;
        
        // Descargar archivo Excel
        XLSX.writeFile(workbook, nombreArchivo);
        
        // Mostrar confirmación
        alert(`✅ Archivo Excel generado correctamente!

📊 Archivo: ${nombreArchivo}
📈 Registros exportados: ${data.length}
📋 Columnas incluidas: ${todasLasColumnas.length}
📁 Formato: Excel (.xlsx)

💡 El archivo se ha descargado y puede abrirse en Excel`);
        
        console.log(`✅ Exportación Excel completada: ${data.length} registros en formato .xlsx`);
        
    } catch (error) {
        console.error('❌ Error en exportación:', error);
        alert('❌ Error al exportar: ' + error.message);
    } finally {
        // Ocultar indicador de carga
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}

// Variables globales para el modal CSV
let archivoCSVCargado = null;
let datosCSVPreview = null;
let textoCSVActual = '';

// Función para abrir modal de carga CSV con textarea
function abrirCargaCSV() {
    console.log('📁 Abriendo modal de carga CSV directa...');
    abrirModalTextoCSV();
}

// Función para resetear el modal CSV
function resetearModalCSV() {
    document.getElementById('fileSelectionArea').style.display = 'block';
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('progressArea').style.display = 'none';
    document.getElementById('previewArea').style.display = 'none';
    document.getElementById('uploadBtn').disabled = true;
    document.getElementById('modalCsvInput').value = '';
    archivoCSVCargado = null;
    datosCSVPreview = null;
}

// Función para abrir selector de archivo desde el modal
function abrirSelectorArchivo() {
    const fileInput = document.getElementById('modalCsvInput');
    if (fileInput) {
        fileInput.click();
    }
}

// Función para cargar archivo en el modal
async function cargarArchivoEnModal(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    
    console.log('📁 Cargando archivo en modal:', file.name);
    
    // Validar que sea un archivo CSV
    if (!file.name.toLowerCase().endsWith('.csv')) {
        alert('❌ Error: Por favor seleccione un archivo CSV válido');
        resetearModalCSV();
        return;
    }
    
    archivoCSVCargado = file;
    
    try {
        // Mostrar información del archivo
        mostrarInfoArchivo(file);
        
        // Leer y procesar archivo para preview
        const texto = await leerArchivoComoTexto(file);
        const { datos, errores } = parsearCSV(texto);
        
        datosCSVPreview = { datos, errores, textoOriginal: texto };
        
        // Mostrar preview
        mostrarPreview(datos, errores);
        
        // Habilitar botón de carga si hay datos válidos
        document.getElementById('uploadBtn').disabled = datos.length === 0;
        
    } catch (error) {
        console.error('❌ Error procesando archivo:', error);
        alert('❌ Error al procesar el archivo: ' + error.message);
        resetearModalCSV();
    }
}

// Función para mostrar información del archivo
function mostrarInfoArchivo(file) {
    const fileInfo = document.getElementById('fileInfo');
    const fileDetails = document.getElementById('fileDetails');
    
    const sizeKB = Math.round(file.size / 1024);
    const sizeText = sizeKB > 1024 ? `${Math.round(sizeKB / 1024)} MB` : `${sizeKB} KB`;
    
    fileDetails.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
            <div><strong>📄 Nombre:</strong> ${file.name}</div>
            <div><strong>📏 Tamaño:</strong> ${sizeText}</div>
            <div><strong>📅 Modificado:</strong> ${new Date(file.lastModified).toLocaleDateString()}</div>
            <div><strong>🔧 Tipo:</strong> ${file.type || 'CSV'}</div>
        </div>
    `;
    
    fileInfo.style.display = 'block';
}

// Función para mostrar preview de datos
function mostrarPreview(datos, errores) {
    const previewArea = document.getElementById('previewArea');
    const previewContent = document.getElementById('previewContent');
    
    let previewHTML = '';
    
    // Mostrar errores si los hay
    if (errores.length > 0) {
        previewHTML += `
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 0.25rem; padding: 0.75rem; margin-bottom: 1rem;">
                <h6 style="color: #856404; margin: 0 0 0.5rem 0;">⚠️ Errores encontrados (${errores.length}):</h6>
                <div style="max-height: 100px; overflow-y: auto; font-size: 0.875rem;">
                    ${errores.slice(0, 10).map(error => `<div style="color: #856404;">• ${error}</div>`).join('')}
                    ${errores.length > 10 ? `<div style="color: #856404; font-style: italic;">...y ${errores.length - 10} errores más</div>` : ''}
                </div>
            </div>
        `;
    }
    
    // Mostrar resumen de datos
    if (datos.length > 0) {
        const primerasFilas = datos.slice(0, 5);
        const columnas = Object.keys(datos[0]);
        
        previewHTML += `
            <div style="margin-bottom: 1rem;">
                <h6 style="color: #495057; margin: 0 0 0.5rem 0;">✅ Datos válidos encontrados: ${datos.length} registros</h6>
                <div style="font-size: 0.875rem; color: #6c757d;">Mostrando los primeros ${primerasFilas.length} registros:</div>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                    <thead>
                        <tr style="background: #e9ecef;">
                            ${columnas.map(col => `<th style="padding: 0.5rem; border: 1px solid #dee2e6; text-align: left; font-weight: bold;">${formatColumnName(col)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${primerasFilas.map(fila => `
                            <tr>
                                ${columnas.map(col => {
                                    let valor = fila[col] || '';
                                    if (valor.length > 30) valor = valor.substring(0, 30) + '...';
                                    return `<td style="padding: 0.5rem; border: 1px solid #dee2e6;">${valor}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${datos.length > 5 ? `<div style="margin-top: 0.5rem; font-size: 0.875rem; color: #6c757d; text-align: center;">...y ${datos.length - 5} registros más</div>` : ''}
        `;
    }
    
    previewContent.innerHTML = previewHTML;
    previewArea.style.display = 'block';
}

// Función para iniciar la carga CSV desde el modal
async function iniciarCargaCSV() {
    if (!datosCSVPreview || !datosCSVPreview.datos) {
        alert('❌ No hay datos para cargar');
        return;
    }
    
    const { datos, errores } = datosCSVPreview;
    
    // Mostrar confirmación con resumen
    let mensaje = `📁 Se van a cargar ${datos.length} registros.`;
    if (errores.length > 0) {
        mensaje += `\n⚠️ Se ignorarán ${errores.length} registros con errores.`;
    }
    mensaje += `\n\n⚠️ Esta operación puede tomar varios minutos.\n¿Desea continuar?`;
    
    const confirmar = confirm(mensaje);
    if (!confirmar) {
        return;
    }
    
    try {
        // Mostrar área de progreso
        document.getElementById('progressArea').style.display = 'block';
        document.getElementById('uploadBtn').disabled = true;
        document.getElementById('cancelBtn').disabled = true;
        
        // Insertar datos con progreso
        await insertarDatosConProgreso(datos);
        
        // Cerrar modal y recargar datos
        cerrarModalCSV();
        loadData();
        
        alert(`✅ Carga completada exitosamente!\n📊 ${datos.length} registros procesados`);
        
    } catch (error) {
        console.error('❌ Error en carga:', error);
        alert('❌ Error durante la carga: ' + error.message);
    } finally {
        document.getElementById('uploadBtn').disabled = false;
        document.getElementById('cancelBtn').disabled = false;
        document.getElementById('progressArea').style.display = 'none';
    }
}

// Función para cerrar modal CSV
function cerrarModalCSV() {
    const modal = document.getElementById('csvModal');
    if (modal) {
        modal.style.display = 'none';
        resetearModalCSV();
    }
}

// Función para procesar archivo CSV seleccionado (mantenida para compatibilidad)
async function procesarArchivoCSV(event) {
    // Redirigir al modal
    abrirCargaCSV();
}

// Función para leer archivo como texto
function leerArchivoComoTexto(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Error leyendo el archivo'));
        reader.readAsText(file, 'UTF-8');
    });
}

// Función para parsear CSV
function parsearCSV(texto) {
    console.log('🔍 Parseando contenido CSV...');
    
    const lineas = texto.split('\n').map(linea => linea.trim()).filter(linea => linea.length > 0);
    
    if (lineas.length < 2) {
        throw new Error('El archivo debe contener al menos una fila de encabezados y una de datos');
    }
    
    // Detectar el delimitador automáticamente (coma o tabulación)
    const primeraLinea = lineas[0];
    let delimitador = ',';
    
    // Contar comas y tabulaciones en la primera línea
    const numComas = (primeraLinea.match(/,/g) || []).length;
    const numTabs = (primeraLinea.match(/\t/g) || []).length;
    
    // Si hay más tabulaciones que comas, usar tabulación como delimitador
    if (numTabs > numComas) {
        delimitador = '\t';
        console.log('✅ Delimitador detectado: TABULACIÓN (datos de Excel)');
    } else {
        console.log('✅ Delimitador detectado: COMA (CSV estándar)');
    }
    
    // Parsear encabezados con el delimitador detectado
    const encabezados = parsearFilaCSV(lineas[0], delimitador);
    console.log('📝 Encabezados detectados:', encabezados);
    
    // Obtener columnas válidas - usar las reales si están disponibles, o la lista completa como fallback
    let columnasConocidas = [];
    
    if (columnasRealesTabla.length > 0) {
        // Usar las columnas reales detectadas de la tabla
        columnasConocidas = columnasRealesTabla.filter(col => col !== PRIMARY_KEY);
        console.log('✅ Usando columnas reales de la tabla para validación:', columnasConocidas);
    } else {
        // Fallback: usar todas las columnas que el sistema reconoce
        columnasConocidas = [
            'direccion', 'instalacion', 'tipo_consumo', 'cod_tipo_consumo', 'serie',
            'lectura_actual', 'lectura_anterior', 'lectura_tres_meses', 'lectura_cuatro_meses',
            'motivo_revision', 'municipio', 'ciclo', 'orden', 'servicio_suscrito',
            'correria', 'categoria', 'fecha_lectura_anterior', 'fecha_lectura_actual',
            'periodo_facturacion', 'causa_lectura_observacion', 'observacion_adicional',
            'alfanumerica_lector', 'lector', 'nombre_revisor', 'pdf', 'fecha_revision',
            'estado', 'tipo_inconsistencia', 'descripcion', 'observaciones', 'prioridad'
        ];
        console.log('⚠️ Usando columnas de fallback para validación');
    }
    
    // Validar que al menos las columnas esenciales estén presentes
    const columnasEsenciales = ['direccion', 'instalacion'];
    const columnasEsencialesNoEncontradas = columnasEsenciales.filter(col => !encabezados.includes(col));
    if (columnasEsencialesNoEncontradas.length > 0) {
        throw new Error(`Faltan las siguientes columnas esenciales: ${columnasEsencialesNoEncontradas.join(', ')}`);
    }
    
    // Verificar que todas las columnas del CSV sean reconocidas por el sistema
    const columnasNoReconocidas = encabezados.filter(col => !columnasConocidas.includes(col));
    if (columnasNoReconocidas.length > 0) {
        console.warn('⚠️ Columnas no reconocidas (serán ignoradas):', columnasNoReconocidas);
    }
    
    console.log(`✅ Validación exitosa: ${encabezados.length} columnas detectadas, ${columnasEsenciales.length} esenciales encontradas`);
    console.log(`📊 Delimitador usado: ${delimitador === '\t' ? 'TABULACIÓN (Excel)' : 'COMA (CSV)'}`);
    
    const datos = [];
    const errores = [];
    
    // Procesar filas de datos
    for (let i = 1; i < lineas.length; i++) {
        try {
            const valores = parsearFilaCSV(lineas[i], delimitador);
            
            if (valores.length !== encabezados.length) {
                errores.push(`Fila ${i + 1}: Número de columnas incorrecto (${valores.length} vs ${encabezados.length})`);
                continue;
            }
            
            const registro = {};
            encabezados.forEach((encabezado, index) => {
                let valor = valores[index] || '';
                // Limpiar valor
                valor = valor.trim();
                registro[encabezado] = valor === '' ? null : valor;
            });
            
            // Validaciones básicas - solo campos esenciales
            if (!registro.instalacion || registro.instalacion.trim() === '') {
                errores.push(`Fila ${i + 1}: Campo 'instalacion' es requerido`);
                continue;
            }
            
            if (!registro.direccion || registro.direccion.trim() === '') {
                errores.push(`Fila ${i + 1}: Campo 'direccion' es requerido`);
                continue;
            }
            
            // Convertir y validar fechas si están presentes
            const camposFecha = ['fecha_lectura_anterior', 'fecha_lectura_actual', 'fecha_revision'];
            camposFecha.forEach(campo => {
                if (registro[campo] && registro[campo].trim() !== '') {
                    const valorFecha = registro[campo].trim();
                    
                    // Detectar formato DD/MM/YYYY y convertir a YYYY-MM-DD
                    if (valorFecha.includes('/')) {
                        const partes = valorFecha.split('/');
                        if (partes.length === 3) {
                            const dia = partes[0].padStart(2, '0');
                            const mes = partes[1].padStart(2, '0');
                            const año = partes[2];
                            registro[campo] = `${año}-${mes}-${dia}`;
                        }
                    }
                    
                    // Validar que la fecha sea válida después de la conversión
                    const fecha = new Date(registro[campo]);
                    if (isNaN(fecha.getTime())) {
                        errores.push(`Fila ${i + 1}: Fecha inválida en campo '${campo}': ${valorFecha}`);
                        registro[campo] = null;
                    }
                }
            });
            
            datos.push(registro);
            
        } catch (error) {
            errores.push(`Fila ${i + 1}: ${error.message}`);
        }
    }
    
    console.log(`✅ Procesados ${datos.length} registros válidos, ${errores.length} errores`);
    return { datos, errores };
}

// Función para parsear una fila CSV (maneja comillas, comas y tabulaciones)
function parsearFilaCSV(fila, delimitador = ',') {
    const resultado = [];
    let valorActual = '';
    let dentroDeComillas = false;
    let i = 0;
    
    while (i < fila.length) {
        const char = fila[i];
        
        if (char === '"' && !dentroDeComillas) {
            dentroDeComillas = true;
        } else if (char === '"' && dentroDeComillas) {
            if (i + 1 < fila.length && fila[i + 1] === '"') {
                // Comilla escapada
                valorActual += '"';
                i++; // Saltar la siguiente comilla
            } else {
                dentroDeComillas = false;
            }
        } else if (char === delimitador && !dentroDeComillas) {
            resultado.push(valorActual);
            valorActual = '';
        } else {
            valorActual += char;
        }
        
        i++;
    }
    
    // Agregar el último valor
    resultado.push(valorActual);
    
    return resultado;
}

// Función para insertar datos con barra de progreso
async function insertarDatosConProgreso(datos) {
    console.log(`📁 Iniciando carga de ${datos.length} registros...`);
    
    const tamanoLote = 100;
    const totalLotes = Math.ceil(datos.length / tamanoLote);
    let procesados = 0;
    let exitosos = 0;
    let fallidos = 0;
    
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    for (let i = 0; i < datos.length; i += tamanoLote) {
        const lote = datos.slice(i, i + tamanoLote);
        const loteActual = Math.floor(i / tamanoLote) + 1;
        
        try {
            // Actualizar progreso
            const porcentaje = Math.round((procesados / datos.length) * 100);
            progressBar.style.width = porcentaje + '%';
            progressBar.textContent = porcentaje + '%';
            progressText.textContent = `Procesando lote ${loteActual}/${totalLotes} - ${procesados}/${datos.length} registros`;
            
            console.log(`🔄 Procesando lote ${loteActual}/${totalLotes}`);
            
            const { data, error } = await supabase
                .from(TABLE_NAME)
                .insert(lote);
            
            if (error) {
                console.error('❌ Error en lote:', error);
                fallidos += lote.length;
            } else {
                exitosos += lote.length;
            }
            
        } catch (error) {
            console.error('❌ Error insertando lote:', error);
            fallidos += lote.length;
        }
        
        procesados += lote.length;
        
        // Pequeña pausa para no sobrecargar la base de datos
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Progreso final
    progressBar.style.width = '100%';
    progressBar.textContent = '100%';
    progressText.textContent = `✅ Completado - ${procesados} registros procesados (${exitosos} exitosos, ${fallidos} fallidos)`;
    
    console.log(`✅ Carga completada: ${exitosos} exitosos, ${fallidos} fallidos`);
    
    return { procesados, exitosos, fallidos };
}

// NUEVA FUNCIÓN: Modal de texto CSV directo
function abrirModalTextoCSV() {
    console.log('📝 Abriendo modal de texto CSV...');
    
    // Crear modal dinámicamente
    const modalHTML = `
        <div id="csvTextoModal" class="modal" style="
            display: block;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
        ">
            <div class="modal-content" style="
                background-color: #fefefe;
                margin: 2% auto;
                padding: 1.5rem;
                border: none;
                width: 90%;
                max-width: 900px;
                border-radius: 0.5rem;
                max-height: 90vh;
                overflow-y: auto;
            ">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid #dee2e6; padding-bottom: 1rem;">
                    <h3 style="margin: 0; color: #495057;">📝 Pegar Datos CSV</h3>
                    <button onclick="cerrarModalTextoCSV()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6c757d;">&times;</button>
                </div>
                
                <div class="modal-body">
                    <!-- Instrucciones -->
                    <div style="background: #e7f3ff; border: 1px solid #b3d7ff; border-radius: 0.25rem; padding: 1rem; margin-bottom: 1.5rem;">
                        <h5 style="margin: 0 0 0.5rem 0; color: #0056b3;">💡 Instrucciones:</h5>
                        <ul style="margin: 0; padding-left: 1.2rem; color: #0056b3;">
                            <li>Copia los datos CSV desde Excel, Google Sheets o cualquier aplicación</li>
                            <li>Pega directamente en el campo de abajo (Ctrl+V)</li>
                            <li>La primera fila debe contener los nombres de las columnas</li>
                            <li>Solo se requieren: <strong>direccion</strong> e <strong>instalacion</strong></li>
                        </ul>
                    </div>
                    
                    <!-- Área de texto principal -->
                    <div style="margin-bottom: 1rem;">
                        <label for="csvTextArea" style="display: block; margin-bottom: 0.5rem; font-weight: bold; color: #495057;">
                            📋 Pegar datos CSV aquí:
                        </label>
                        <textarea 
                            id="csvTextArea" 
                            placeholder="Pega aquí tus datos CSV...&#10;&#10;Ejemplo:&#10;direccion,instalacion,tipo_consumo&#10;Calle 123 #45-67,059818400000440000,Residencial&#10;Carrera 45 #12-34,059818400000550000,Comercial"
                            style="
                                width: 100%; 
                                height: 300px; 
                                padding: 0.75rem; 
                                border: 2px dashed #ced4da; 
                                border-radius: 0.25rem;
                                font-family: 'Courier New', monospace;
                                font-size: 0.875rem;
                                resize: vertical;
                                background: #f8f9fa;
                            "
                        ></textarea>
                    </div>
                    
                    <!-- Botones de acción -->
                    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                        <button onclick="procesarTextoCSV()" id="procesarBtn" style="
                            background: #28a745; 
                            color: white; 
                            border: none; 
                            padding: 0.5rem 1rem; 
                            border-radius: 0.25rem; 
                            cursor: pointer;
                            font-weight: bold;
                        ">🔄 Procesar Datos</button>
                        
                        <button onclick="limpiarTextoCSV()" style="
                            background: #6c757d; 
                            color: white; 
                            border: none; 
                            padding: 0.5rem 1rem; 
                            border-radius: 0.25rem; 
                            cursor: pointer;
                        ">🗑️ Limpiar</button>
                        
                        <button onclick="mostrarEjemploCSV()" style="
                            background: #17a2b8; 
                            color: white; 
                            border: none; 
                            padding: 0.5rem 1rem; 
                            border-radius: 0.25rem; 
                            cursor: pointer;
                        ">📋 Ver Ejemplo</button>
                    </div>
                    
                    <!-- Área de preview -->
                    <div id="csvPreviewArea" style="display: none;">
                        <hr style="margin: 1.5rem 0;">
                        <h5 style="color: #495057; margin-bottom: 1rem;">👀 Vista Previa:</h5>
                        <div id="csvPreviewContent"></div>
                        
                        <!-- Botones de carga -->
                        <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #dee2e6;">
                            <button onclick="confirmarCargaTextoCSV()" id="cargarBtn" disabled style="
                                background: #007bff; 
                                color: white; 
                                border: none; 
                                padding: 0.75rem 1.5rem; 
                                border-radius: 0.25rem; 
                                cursor: pointer;
                                font-weight: bold;
                                margin-right: 0.5rem;
                            ">⬆️ Cargar a la Base de Datos</button>
                            
                            <button onclick="cerrarModalTextoCSV()" style="
                                background: #6c757d; 
                                color: white; 
                                border: none; 
                                padding: 0.75rem 1.5rem; 
                                border-radius: 0.25rem; 
                                cursor: pointer;
                            ">❌ Cancelar</button>
                        </div>
                    </div>
                    
                    <!-- Área de progreso -->
                    <div id="csvProgressArea" style="display: none; margin-top: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 0.25rem;">
                        <h6 style="margin: 0 0 1rem 0; color: #495057;">⏳ Cargando datos...</h6>
                        <div style="background: #e9ecef; border-radius: 0.25rem; overflow: hidden; margin-bottom: 0.5rem;">
                            <div id="csvProgressBar" style="background: #007bff; height: 1.5rem; width: 0%; transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;"></div>
                        </div>
                        <div id="csvProgressText" style="font-size: 0.875rem; color: #6c757d; text-align: center;">Iniciando...</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Enfocar el textarea
    setTimeout(() => {
        document.getElementById('csvTextArea').focus();
    }, 100);
}

// Función para cerrar modal de texto CSV
function cerrarModalTextoCSV() {
    const modal = document.getElementById('csvTextoModal');
    if (modal) {
        document.body.removeChild(modal);
    }
    textoCSVActual = '';
    datosCSVPreview = null;
}

// Función para mostrar ejemplo en el textarea
function mostrarEjemploCSV() {
    const ejemplo = `direccion,instalacion,tipo_consumo,cod_tipo_consumo,serie,lectura_actual,nombre_revisor
Calle 123 #45-67,059818400000440000,Residencial,R1,MED001234,15678,AUX_003
Carrera 45 #12-34,059818400000550000,Comercial,C1,MED005678,23456,AUX_003
Avenida 80 #23-45,059818400000660000,Industrial,I1,MED009876,34567,REV_002`;
    
    document.getElementById('csvTextArea').value = ejemplo;
    
    alert(`📋 Ejemplo cargado en el campo de texto!

💡 Este ejemplo incluye:
• 3 registros de muestra
• Las columnas esenciales (direccion, instalacion)
• Algunas columnas adicionales comunes
• Formato CSV estándar separado por comas

✅ Puedes modificar este ejemplo o reemplazarlo con tus propios datos.`);
}

// Función para limpiar el textarea
function limpiarTextoCSV() {
    document.getElementById('csvTextArea').value = '';
    document.getElementById('csvPreviewArea').style.display = 'none';
    document.getElementById('cargarBtn').disabled = true;
    textoCSVActual = '';
    datosCSVPreview = null;
}

// Función para procesar el texto CSV pegado
function procesarTextoCSV() {
    const textarea = document.getElementById('csvTextArea');
    const texto = textarea.value.trim();
    
    if (!texto) {
        alert('⚠️ Por favor pega los datos CSV en el campo de texto.');
        return;
    }
    
    console.log('🔄 Procesando texto CSV pegado...');
    
    try {
        // Parsear el texto CSV
        const { datos, errores } = parsearCSV(texto);
        
        // Guardar datos procesados
        textoCSVActual = texto;
        datosCSVPreview = { datos, errores };
        
        // Mostrar preview
        mostrarPreviewTextoCSV(datos, errores);
        
        // Habilitar botón de carga si hay datos válidos
        document.getElementById('cargarBtn').disabled = datos.length === 0;
        
    } catch (error) {
        console.error('❌ Error procesando texto CSV:', error);
        alert('❌ Error al procesar los datos: ' + error.message + '\n\n💡 Verifica que:\n• La primera fila contenga los nombres de columnas\n• Los datos estén separados por comas\n• Las columnas "direccion" e "instalacion" estén presentes');
    }
}

// Función para mostrar preview de los datos procesados
function mostrarPreviewTextoCSV(datos, errores) {
    const previewArea = document.getElementById('csvPreviewArea');
    const previewContent = document.getElementById('csvPreviewContent');
    
    let html = '';
    
    // Mostrar errores si existen
    if (errores.length > 0) {
        html += `
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 0.25rem; padding: 0.75rem; margin-bottom: 1rem;">
                <h6 style="color: #856404; margin: 0 0 0.5rem 0;">⚠️ Advertencias/Errores (${errores.length}):</h6>
                <div style="max-height: 120px; overflow-y: auto; font-size: 0.875rem;">
                    ${errores.slice(0, 15).map(error => `<div style="color: #856404;">• ${error}</div>`).join('')}
                    ${errores.length > 15 ? `<div style="color: #856404; font-style: italic;">...y ${errores.length - 15} más</div>` : ''}
                </div>
            </div>
        `;
    }
    
    // Mostrar resumen y datos
    if (datos.length > 0) {
        const columnas = Object.keys(datos[0]);
        const muestra = datos.slice(0, 5);
        
        html += `
            <div style="background: #d1edff; border: 1px solid #7cc7ff; border-radius: 0.25rem; padding: 0.75rem; margin-bottom: 1rem;">
                <h6 style="color: #004085; margin: 0 0 0.5rem 0;">✅ Datos procesados correctamente</h6>
                <div style="color: #004085; font-size: 0.875rem;">
                    <strong>📊 Registros válidos:</strong> ${datos.length} | 
                    <strong>📋 Columnas detectadas:</strong> ${columnas.length}
                </div>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <strong>Columnas detectadas:</strong><br>
                <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.5rem;">
                    ${columnas.map(col => {
                        const esEsencial = ['direccion', 'instalacion'].includes(col);
                        const color = esEsencial ? '#28a745' : '#6c757d';
                        const icon = esEsencial ? '✅' : '📋';
                        return `<span style="background: ${color}; color: white; padding: 0.2rem 0.5rem; border-radius: 0.2rem; font-size: 0.8rem;">${icon} ${formatColumnName(col)}</span>`;
                    }).join('')}
                </div>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <strong>Vista previa (primeros ${muestra.length} registros):</strong>
            </div>
            
            <div style="overflow-x: auto; max-height: 300px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 0.25rem;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                    <thead style="position: sticky; top: 0; background: #f8f9fa;">
                        <tr>
                            ${columnas.map(col => `<th style="padding: 0.5rem; border-bottom: 2px solid #dee2e6; text-align: left; font-weight: bold; white-space: nowrap;">${formatColumnName(col)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${muestra.map((fila, index) => `
                            <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
                                ${columnas.map(col => {
                                    let valor = fila[col] || '';
                                    if (valor.length > 40) valor = valor.substring(0, 40) + '...';
                                    return `<td style="padding: 0.5rem; border-bottom: 1px solid #dee2e6; white-space: nowrap;">${valor || '<span style="color: #6c757d;">-</span>'}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            ${datos.length > 5 ? `<div style="margin-top: 0.5rem; font-size: 0.875rem; color: #6c757d; text-align: center; font-style: italic;">...y ${datos.length - 5} registros más</div>` : ''}
        `;
    } else {
        html += `
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 0.25rem; padding: 0.75rem;">
                <h6 style="color: #721c24; margin: 0;">❌ No se encontraron datos válidos</h6>
                <p style="color: #721c24; margin: 0.5rem 0 0 0; font-size: 0.875rem;">Verifica el formato de los datos y vuelve a intentar.</p>
            </div>
        `;
    }
    
    previewContent.innerHTML = html;
    previewArea.style.display = 'block';
}

// Función para confirmar y cargar los datos
async function confirmarCargaTextoCSV() {
    if (!datosCSVPreview || !datosCSVPreview.datos || datosCSVPreview.datos.length === 0) {
        alert('❌ No hay datos válidos para cargar.');
        return;
    }
    
    const { datos, errores } = datosCSVPreview;
    
    let mensaje = `📊 Se van a cargar ${datos.length} registros a la base de datos.`;
    if (errores.length > 0) {
        mensaje += `\n⚠️ Se encontraron ${errores.length} errores/advertencias que fueron omitidos.`;
    }
    mensaje += '\n\n¿Confirmas la carga?';
    
    if (!confirm(mensaje)) {
        return;
    }
    
    try {
        // Mostrar área de progreso
        document.getElementById('csvProgressArea').style.display = 'block';
        document.getElementById('cargarBtn').disabled = true;
        document.getElementById('procesarBtn').disabled = true;
        
        // Cargar datos con progreso
        await insertarDatosTextoCSV(datos);
        
        // Cerrar modal y recargar tabla
        cerrarModalTextoCSV();
        loadData();
        
        alert(`✅ ¡Carga completada exitosamente!
        
📊 ${datos.length} registros cargados a la base de datos.
🔄 La tabla se ha actualizado automáticamente.`);
        
    } catch (error) {
        console.error('❌ Error en carga:', error);
        alert('❌ Error durante la carga: ' + error.message);
    } finally {
        document.getElementById('cargarBtn').disabled = false;
        document.getElementById('procesarBtn').disabled = false;
        document.getElementById('csvProgressArea').style.display = 'none';
    }
}

// Función para insertar datos con progreso desde texto CSV
async function insertarDatosTextoCSV(datos) {
    console.log(`📁 Iniciando carga de ${datos.length} registros desde texto CSV...`);
    
    const tamanoLote = 50; // Lotes más pequeños para mejor feedback
    const totalLotes = Math.ceil(datos.length / tamanoLote);
    let procesados = 0;
    let exitosos = 0;
    let fallidos = 0;
    
    const progressBar = document.getElementById('csvProgressBar');
    const progressText = document.getElementById('csvProgressText');
    
    for (let i = 0; i < datos.length; i += tamanoLote) {
        const lote = datos.slice(i, i + tamanoLote);
        const loteActual = Math.floor(i / tamanoLote) + 1;
        
        try {
            // Actualizar progreso
            const porcentaje = Math.round((procesados / datos.length) * 100);
            progressBar.style.width = porcentaje + '%';
            progressBar.textContent = porcentaje + '%';
            progressText.textContent = `Procesando lote ${loteActual} de ${totalLotes} - ${procesados}/${datos.length} registros`;
            
            console.log(`🔄 Procesando lote ${loteActual}/${totalLotes}`);
            
            // Insertar lote en Supabase
            const { data, error } = await supabase
                .from(TABLE_NAME)
                .insert(lote);
            
            if (error) {
                console.error('❌ Error en lote:', error);
                fallidos += lote.length;
            } else {
                exitosos += lote.length;
            }
            
        } catch (error) {
            console.error('❌ Error insertando lote:', error);
            fallidos += lote.length;
        }
        
        procesados += lote.length;
        
        // Pausa pequeña para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Progreso final
    progressBar.style.width = '100%';
    progressBar.textContent = '✅ 100%';
    progressText.textContent = `Completado: ${exitosos} exitosos, ${fallidos} fallidos de ${procesados} total`;
    
    console.log(`✅ Carga desde texto completada: ${exitosos} exitosos, ${fallidos} fallidos`);
    
    return { procesados, exitosos, fallidos };
}

// Función para insertar datos en lotes (mantenida para compatibilidad)
async function insertarDatosEnLotes(datos) {
    console.log(`📁 Iniciando carga de ${datos.length} registros...`);
    
    const tamanoLote = 100;
    let procesados = 0;
    let exitosos = 0;
    let fallidos = 0;
    
    for (let i = 0; i < datos.length; i += tamanoLote) {
        const lote = datos.slice(i, i + tamanoLote);
        
        try {
            console.log(`🔄 Procesando lote ${Math.floor(i / tamanoLote) + 1}/${Math.ceil(datos.length / tamanoLote)}`);
            
            const { data, error } = await supabase
                .from(TABLE_NAME)
                .insert(lote);
            
            if (error) {
                console.error('❌ Error en lote:', error);
                fallidos += lote.length;
            } else {
                exitosos += lote.length;
            }
            
        } catch (error) {
            console.error('❌ Error insertando lote:', error);
            fallidos += lote.length;
        }
        
        procesados += lote.length;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const mensaje = `✅ Carga completada!\n\n📈 Registros procesados: ${procesados}\n✅ Insertados exitosamente: ${exitosos}\n❌ Fallidos: ${fallidos}`;
    alert(mensaje);
    console.log(mensaje);
    loadData();
}

// Función para eliminar todos los datos de la tabla
async function eliminarTodosLosDatos() {
    console.log('🗑️ Solicitando eliminación total de datos...');
    
    // Primera confirmación
    const confirmar1 = confirm(`⚠️ ADVERTENCIA: ELIMINACIÓN TOTAL DE DATOS

Esta acción eliminará TODOS los registros de la tabla de inconsistencias.

📊 Registros actuales: ${tableData.length}
🚨 Esta acción NO se puede deshacer

¿Estás seguro de que deseas continuar?`);
    
    if (!confirmar1) {
        console.log('❌ Eliminación cancelada por el usuario');
        return;
    }
    
    // Segunda confirmación (más específica)
    const confirmar2 = confirm(`🚨 ÚLTIMA CONFIRMACIÓN

Estás a punto de eliminar TODOS los datos de inconsistencias.

⚠️ Esto incluye:
• Todos los registros históricos
• Toda la información de revisores
• Todos los PDFs y observaciones
• Todas las estadísticas acumuladas

Esta acción es IRREVERSIBLE.

Escribe "ELIMINAR" para confirmar.

¿Confirmas la eliminación total?`);
    
    if (!confirmar2) {
        console.log('❌ Eliminación cancelada por el usuario en segunda confirmación');
        return;
    }
    
    try {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
        
        console.log('🗑️ Eliminando todos los registros de la tabla...');
        
        // Obtener todos los IDs para eliminar
        const { data: todosLosRegistros, error: errorSelect } = await supabase
            .from(TABLE_NAME)
            .select(PRIMARY_KEY);
        
        if (errorSelect) {
            throw errorSelect;
        }
        
        const totalRegistros = todosLosRegistros?.length || 0;
        
        if (totalRegistros === 0) {
            alert('ℹ️ No hay registros para eliminar.');
            return;
        }
        
        console.log(`📊 Se eliminarán ${totalRegistros} registros...`);
        
        // Eliminar en lotes para evitar timeouts
        const tamanoLote = 500;
        let eliminados = 0;
        
        for (let i = 0; i < todosLosRegistros.length; i += tamanoLote) {
            const lote = todosLosRegistros.slice(i, i + tamanoLote);
            const ids = lote.map(r => r[PRIMARY_KEY]);
            
            console.log(`🗑️ Eliminando lote ${Math.floor(i / tamanoLote) + 1}...`);
            
            const { error: errorDelete } = await supabase
                .from(TABLE_NAME)
                .delete()
                .in(PRIMARY_KEY, ids);
            
            if (errorDelete) {
                console.error('❌ Error eliminando lote:', errorDelete);
                throw errorDelete;
            }
            
            eliminados += lote.length;
            
            // Pausa pequeña entre lotes
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`✅ Eliminación completada: ${eliminados} registros eliminados`);
        
        // Recargar datos
        await loadData();
        
        alert(`✅ Eliminación completada exitosamente

📊 Total de registros eliminados: ${eliminados}
🔄 La tabla ha sido limpiada por completo
♻️ La vista se ha actualizado`);
        
    } catch (error) {
        console.error('❌ Error durante la eliminación:', error);
        alert(`❌ Error al eliminar los datos: ${error.message}

Por favor, intenta nuevamente o contacta al administrador.`);
    } finally {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}