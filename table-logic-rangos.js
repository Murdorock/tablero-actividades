

// Lógica de tabla para la vista rangos
// Usa la variable global 'supabase' y el nombre de tabla como string
const PRIMARY_KEY = 'id_rangos';

let currentData = [];
let tableColumns = [];

// Cargar datos iniciales
document.addEventListener('DOMContentLoaded', function() {
    loadData();
});

async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';
    try {
        const { data, error } = await supabase
            .from('rangos')
            .select('*')
            .order(PRIMARY_KEY, { ascending: true })
            .limit(20);
        if (error) {
            console.error('Error Supabase:', error);
            tableContainer.innerHTML = '<div class="error">Error cargando datos: ' + (error.message || error) + '</div>';
            return;
        }
        currentData = data || [];
        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]);
            renderTable(currentData);
        } else {
            tableContainer.innerHTML = '<div class="no-data">No hay rangos para mostrar</div>';
        }
    } catch (error) {
        console.error('Error JS:', error);
        tableContainer.innerHTML = '<div class="error">Error cargando datos: ' + error.message + '</div>';
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }

function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    if (!data || data.length === 0) {
        tableContainer.innerHTML = '<div class="no-data">No hay rangos para mostrar</div>';
        return;
    }
        // Filtros dobles para ciclo y correria
        let filterHtml = document.getElementById('filtrosRangosHtml');
        if (!filterHtml) {
            filterHtml = document.createElement('div');
            filterHtml.id = 'filtrosRangosHtml';
            filterHtml.style.marginBottom = '10px';
            filterHtml.style.display = 'flex';
            filterHtml.style.gap = '16px';
            filterHtml.style.alignItems = 'center';
            filterHtml.innerHTML = `<label for="filterCiclo" style="font-weight:bold; font-size:1.1em;">Ciclo:</label>`
                + `<input type="text" id="filterCiclo" style="width: 120px; height: 38px; font-size: 1.1em; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;" placeholder="Ciclo" autocomplete="off">`
                + `<label for="filterCorreria" style="font-weight:bold; font-size:1.1em;">Correria:</label>`
                + `<input type="text" id="filterCorreria" style="width: 120px; height: 38px; font-size: 1.1em; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;" placeholder="Correria" autocomplete="off">`
                + `<span style="color:#d32f2f; font-size:0.95em; margin-left:10px;">* Ambos campos son obligatorios</span>`
                + `<button id="exportExcelBtn" style="margin-left:20px; padding:8px 18px; font-size:1em; background:#1976d2; color:#fff; border:none; border-radius:6px; cursor:pointer;">Exportar Excel</button>`;
            tableContainer.parentNode.insertBefore(filterHtml, tableContainer);
            setUpDoubleFilter();
            // Cargar SheetJS si no está presente
            if (!window.XLSX) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
                script.onload = function() {
                    setUpExportButton();
                };
                document.head.appendChild(script);
            } else {
                setUpExportButton();
            }
        }
        // Elimina cualquier duplicado extra de filtros si existe
        const filtros = document.querySelectorAll('#filtrosRangosHtml');
        if (filtros.length > 1) {
            for (let i = 1; i < filtros.length; i++) {
                filtros[i].remove();
            }
        }
        let html = '<table class="data-table"><thead><tr>';
        const visibleColumns = tableColumns.filter(col => col !== 'id_rangos');
        visibleColumns.forEach(column => {
            const displayName = column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            html += `<th>${displayName}</th>`;
        });
        html += '</tr></thead><tbody>';
        data.forEach(row => {
            html += '<tr>';
            visibleColumns.forEach(column => {
                html += `<td>${row[column] != null ? row[column] : ''}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        tableContainer.innerHTML = html;
        setUpDoubleFilter();
        setUpExportButton();
    // Exportar a Excel los datos filtrados
    function setUpExportButton() {
        const btn = document.getElementById('exportExcelBtn');
        if (!btn) return;
        btn.onclick = function() {
            // Obtener los datos visibles en la tabla
            let rows = [];
            const table = document.querySelector('.data-table');
            if (!table) return alert('No hay datos para exportar');
            const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
            Array.from(table.querySelectorAll('tbody tr')).forEach(tr => {
                const cells = Array.from(tr.querySelectorAll('td'));
                rows.push(cells.map(td => td.textContent.trim()));
            });
            if (rows.length === 0) return alert('No hay datos para exportar');
            // Crear hoja Excel
            const ws = window.XLSX.utils.aoa_to_sheet([headers, ...rows]);
            const wb = window.XLSX.utils.book_new();
            window.XLSX.utils.book_append_sheet(wb, ws, 'Rangos');
            window.XLSX.writeFile(wb, 'rangos_filtrados.xlsx');
        };
    }
    }

    function setUpDoubleFilter() {
        const filterCiclo = document.getElementById('filterCiclo');
        const filterCorreria = document.getElementById('filterCorreria');
        if (filterCiclo && filterCorreria && !filterCiclo._listenerSet) {
            filterCiclo.value = window.lastFilterCiclo || '';
            filterCorreria.value = window.lastFilterCorreria || '';
            filterCiclo.disabled = false;
            filterCorreria.disabled = false;
            filterCiclo.addEventListener('input', function() {
                window.lastFilterCiclo = filterCiclo.value;
                applyDoubleFilter();
            });
            filterCorreria.addEventListener('input', function() {
                window.lastFilterCorreria = filterCorreria.value;
                applyDoubleFilter();
            });
            filterCiclo._listenerSet = true;
            filterCorreria._listenerSet = true;
        }
    }

    async function applyDoubleFilter() {
        const ciclo = document.getElementById('filterCiclo').value.trim();
        const correria = document.getElementById('filterCorreria').value.trim();
        window.lastFilterCiclo = ciclo;
        window.lastFilterCorreria = correria;
        const tableContainer = document.getElementById('tableContainer');
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        tableContainer.innerHTML = '';
        let query = supabase.from('rangos').select('*');
        if (ciclo) query = query.ilike('ciclo', `%${ciclo}%`);
        if (correria) query = query.ilike('correria', `%${correria}%`);
        query = query.order('id_rangos', { ascending: true }).limit(100);
        try {
            const { data, error } = await query;
            if (error) throw error;
            if (data && data.length > 0) {
                renderTable(data);
            } else {
                tableContainer.innerHTML = '<div class="no-data">No hay rangos para mostrar</div>';
            }
        } catch (error) {
            tableContainer.innerHTML = '<div class="error">Error cargando datos: ' + error.message + '</div>';
        } finally {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        }
    }
}
