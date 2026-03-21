// Lógica específica para la tabla reporte_ordenes_pendientes
let tableColumns = [];
let currentData = [];
const SEARCHABLE_COLUMNS = [
    'proceso_agi', 'segmento', 'grupo', 'orden_trabajo', 'id_actividad', 'solicitud', 'orden_aviso',
    'producto', 'fecha_creacion', 'fecha_creacion_solicitud', 'visita', 'actividad', 'comentario',
    'estado', 'orden_regenerada', 'mercado', 'cod_unico_direccion', 'cod_instalacion', 'nomenclatura_mp',
    'municipio', 'coordenadax', 'coordenaday', 'correria_lectura', 'correria_reparto', 'descripcion_l',
    'descripcion_r', 'tipo_direccion_mp', 'region', 'corregimiento', 'comuna', 'barrio', 'vereda',
    'zona_operativa', 'desc_sector_operativo_ab', 'ciclo_operativo', 'ciclo_facturacion',
    'servicio_pedidos_ab', 'tipo_producto_agrup', 'estado_corte', 'tipo_servicio', 'categoria',
    'sub_categoria', 'medidor', 'consumo_cobrado', 'cons_inv', 'cuentas_saldo', 'saldo_cuentas',
    'cuentas_vencidas', 'saldo_cuentasvencidas', 'cta_base_sus', 'ans_creacion', 'ans_primera_asignacion',
    'ans_asignacion', 'zona_operativa_ped', 'nombre_cliente', 'telefono_avisar', 'celular_avisar',
    'interiores_agrupados', 'serie_equipo', 'series_agrupados', 'transformador', 'criterio_pedidos', 'cod_contrato'
];
const MAX_SEARCH_RESULTS = 2000;
const EXACT_FIRST_COLUMNS = new Set([
    'orden_trabajo', 'id_actividad', 'solicitud', 'orden_aviso', 'cod_unico_direccion',
    'cod_instalacion', 'cod_contrato', 'medidor', 'serie_equipo', 'transformador'
]);

function escapeLikeValue(value) {
    return String(value).replace(/[%_]/g, '\\$&');
}

function isPotentialIdValue(value) {
    return /^[a-zA-Z0-9_-]{6,}$/.test(value);
}

function updateResultsCounter(count, mode = 'mostrados') {
    const counter = document.getElementById('results-counter');
    if (!counter) return;
    counter.textContent = `Resultados ${mode}: ${Number(count || 0).toLocaleString('es-ES')}`;
}

document.addEventListener('DOMContentLoaded', function() {
    loadData();
});

async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    
    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';
    
    try {
        // Cargar datos ordenados por id de mayor a menor
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order(PRIMARY_KEY, { ascending: false })
            .limit(500);
        
        if (error) throw error;
        
        currentData = data || [];
        
        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]).filter(col => col !== PRIMARY_KEY);
            populateFilterColumns();
            renderTable(currentData);
        } else {
            tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #7f8c8d;">No hay registros en esta tabla</div>';
            updateResultsCounter(0);
        }
        
        loadingIndicator.style.display = 'none';
    } catch (error) {
        console.error('Error completo:', error);
        handleError(error, 'al cargar datos');
        loadingIndicator.style.display = 'none';
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">Error: ' + error.message + '<br><br>Verifica que la tabla "reporte_ordenes_pendientes" existe en Supabase y tiene políticas RLS configuradas.</div>';
        updateResultsCounter(0);
    }
}

function populateFilterColumns() {
    const filterColumn = document.getElementById('filterColumn');
    if (!filterColumn || tableColumns.length === 0) return;
    
    // Mantener la opción "Todas las columnas"
    const currentValue = filterColumn.value;
    filterColumn.innerHTML = '<option value="">Todas las columnas</option>';
    
    tableColumns.forEach(col => {
        const option = document.createElement('option');
        option.value = col;
        option.textContent = formatColumnName(col);
        filterColumn.appendChild(option);
    });
    
    filterColumn.value = currentValue;
}

function applyFilter() {
    applyFilterServer();
}

async function applyFilterServer() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    const searchText = document.getElementById('filterSearch').value.trim();
    const filterColumn = document.getElementById('filterColumn').value;
    const existingNotice = document.getElementById('searchLimitNotice');
    if (existingNotice) existingNotice.remove();
    
    if (!searchText) {
        renderTable(currentData);
        updateResultsCounter(currentData.length);
        return;
    }

    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';

    try {
        let filteredData = [];

        if (filterColumn) {
            const escapedText = escapeLikeValue(searchText);
            const shouldTryExact = EXACT_FIRST_COLUMNS.has(filterColumn) || isPotentialIdValue(searchText);

            if (shouldTryExact) {
                const { data: exactData, error: exactError } = await supabase
                    .from(TABLE_NAME)
                    .select('*')
                    .eq(filterColumn, searchText)
                    .limit(MAX_SEARCH_RESULTS);

                if (exactError) throw exactError;
                filteredData = exactData || [];
            }

            // Fallback rápido por prefijo para evitar timeout de '%texto%'.
            if (filteredData.length === 0) {
                const { data: prefixData, error: prefixError } = await supabase
                    .from(TABLE_NAME)
                    .select('*')
                    .ilike(filterColumn, `${escapedText}%`)
                    .limit(MAX_SEARCH_RESULTS);

                if (prefixError) throw prefixError;
                filteredData = prefixData || [];
            }

            // Solo si el texto es corto intentamos contains; en textos largos suele causar timeout.
            if (filteredData.length === 0 && searchText.length <= 8) {
                const { data: containsData, error: containsError } = await supabase
                    .from(TABLE_NAME)
                    .select('*')
                    .ilike(filterColumn, `%${escapedText}%`)
                    .limit(MAX_SEARCH_RESULTS);

                if (containsError) throw containsError;
                filteredData = containsData || [];
            }
        } else {
            if (searchText.length < 4) {
                throw new Error('Para búsqueda global usa al menos 4 caracteres o selecciona una columna.');
            }

            const searchTextForOr = escapeLikeValue(searchText).replace(/,/g, '\\,');
            const orClause = SEARCHABLE_COLUMNS
                .map(col => `${col}.ilike.${searchTextForOr}%`)
                .join(',');

            const { data, error } = await supabase
                .from(TABLE_NAME)
                .select('*')
                .or(orClause)
                .limit(MAX_SEARCH_RESULTS);

            if (error) throw error;
            filteredData = data || [];
        }

        renderTable(filteredData);
        updateResultsCounter(filteredData.length, 'encontrados');

        if (filteredData.length >= MAX_SEARCH_RESULTS) {
            tableContainer.insertAdjacentHTML(
                'beforebegin',
                `<div id="searchLimitNotice" style="margin-bottom: 12px; background: #fff7ed; border: 1px solid #fdba74; color: #9a3412; padding: 10px 12px; border-radius: 8px; font-size: 0.9em;">Mostrando los primeros ${MAX_SEARCH_RESULTS.toLocaleString('es-ES')} resultados. Ajusta el filtro para afinar la búsqueda.</div>`
            );
        }
    } catch (error) {
        handleError(error, 'al buscar en Supabase');
        const timeoutHint = String(error.message || '').toLowerCase().includes('timeout')
            ? '<br><br>Sugerencia: selecciona una columna y busca por valor exacto o prefijo.'
            : '';
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">Error en la búsqueda: ' + error.message + timeoutHint + '</div>';
        updateResultsCounter(0, 'encontrados');
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function clearFilter() {
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterColumn').value = '';
    const oldNotice = document.getElementById('searchLimitNotice');
    if (oldNotice) oldNotice.remove();
    updateResultsCounter(currentData.length);
    loadData();
}

function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    
    if (data.length === 0) {
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #7f8c8d;">No hay registros que coincidan con el filtro</div>';
        updateResultsCounter(0, 'encontrados');
        return;
    }
    
    let html = '<table class="data-table"><thead><tr>';
    
    tableColumns.forEach(col => {
        html += `<th>${formatColumnName(col)}</th>`;
    });
    html += '<th>Acciones</th></tr></thead><tbody>';
    
    data.forEach(row => {
        html += '<tr>';
        tableColumns.forEach(col => {
            const cellValue = formatValue(row[col], col);
            html += `<td>${cellValue}</td>`;
        });
        
        const rowId = row[PRIMARY_KEY];
        html += `<td class="actions">
            <button class="btn btn-primary btn-sm" onclick='editRecord(${JSON.stringify(row).replace(/'/g, "&apos;")})'>✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteRecord(${rowId})">🗑️</button>
        </td></tr>`;
    });
    
    html += '</tbody></table>';
    tableContainer.innerHTML = html;
    updateResultsCounter(data.length);
}

function formatColumnName(columnName) {
    return columnName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

function formatValue(value, column) {
    if (value === null || value === undefined) return '-';
    
    const strValue = String(value).trim();
    if (strValue === '') return '-';
    
    // Limitar longitud para columnas largas
    if (strValue.length > 100) {
        return `<span title="${strValue}">${strValue.substring(0, 100)}...</span>`;
    }
    
    return strValue;
}

async function editRecord(record) {
    const modal = document.getElementById('dataModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalConfirm = document.getElementById('modalConfirm');
    
    modalTitle.textContent = '✏️ Editar Registro';
    
    let formHTML = '';
    tableColumns.forEach(col => {
        const value = record[col] || '';
        formHTML += `
            <div class="form-group" style="margin-bottom: 15px;">
                <label for="edit_${col}" style="display: block; margin-bottom: 5px; font-weight: 600; color: #1e293b;">${formatColumnName(col)}</label>
                <textarea id="edit_${col}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; resize: vertical; min-height: 40px;" placeholder="${col}">${value}</textarea>
            </div>
        `;
    });
    
    modalBody.innerHTML = formHTML;
    
    modalConfirm.textContent = 'Guardar Cambios';
    modalConfirm.onclick = async function() {
        const updates = {};
        let hasChanges = false;
        
        tableColumns.forEach(col => {
            const newValue = document.getElementById(`edit_${col}`).value;
            if (newValue !== (record[col] || '')) {
                updates[col] = newValue || null;
                hasChanges = true;
            }
        });
        
        if (!hasChanges) {
            alert('No hay cambios para guardar');
            return;
        }
        
        try {
            const { error } = await supabase
                .from(TABLE_NAME)
                .update(updates)
                .eq(PRIMARY_KEY, record[PRIMARY_KEY]);
            
            if (error) throw error;
            
            alert('Registro actualizado correctamente');
            closeModal();
            loadData();
        } catch (error) {
            alert('Error al actualizar: ' + error.message);
            console.error(error);
        }
    };
    
    modal.style.display = 'block';
}

async function deleteRecord(recordId) {
    if (confirm('¿Estás seguro de que deseas eliminar este registro?')) {
        try {
            const { error } = await supabase
                .from(TABLE_NAME)
                .delete()
                .eq(PRIMARY_KEY, recordId);
            
            if (error) throw error;
            
            alert('Registro eliminado correctamente');
            loadData();
        } catch (error) {
            alert('Error al eliminar: ' + error.message);
            console.error(error);
        }
    }
}

function handleError(error, context) {
    console.error(`Error ${context}:`, error);
    // Aquí puedes agregar lógica adicional para manejar errores específicos
}

function confirmAction() {
    // Esta función será sobrescrita por funciones específicas
}
