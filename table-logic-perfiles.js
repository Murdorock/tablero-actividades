// Lógica para mostrar los datos reales de Supabase, ocultando la columna id y evitando conflictos
(function() {
    let supabaseClient;
    if (typeof supabase !== 'undefined') {
        supabaseClient = supabase;
    } else if (window.supabase && window.SUPABASE_URL && window.SUPABASE_KEY) {
        supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    } else {
        console.error('Supabase no está configurado correctamente.');
        renderTable([]);
        return;
    }

    let allData = [];
    let columns = [];

    document.addEventListener('DOMContentLoaded', function() {
        loadData();
    });

    async function loadData() {
        const tableContainer = document.getElementById('tableContainer');
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        tableContainer.innerHTML = '';
        try {
            const { data, error } = await supabaseClient
                .from('perfiles')
                .select('*')
                .order('id', { ascending: true });
            if (error) throw error;
            if (!data || !Array.isArray(data)) throw new Error('No se recibieron datos de Supabase.');
            allData = data;
            columns = Object.keys(data[0]).filter(col => col.toLowerCase() !== 'id');
            renderTable(data);
        } catch (error) {
            tableContainer.innerHTML = '<div class="error">Error cargando datos: ' + error.message + '</div>';
        } finally {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        }
    }

    function renderTable(data) {
        const tableContainer = document.getElementById('tableContainer');
        // Filtro global arriba de la tabla (como en personal)
        let filterHtml = `<div style=\"margin-bottom: 10px; display: flex; gap: 10px; align-items: center;\">`
            + `<label for=\"filterSearch\" style=\"font-weight:bold; font-size:1.1em;\">Buscar:</label>`
            + `<input type=\"text\" id=\"filterSearch\" style=\"width: 200px; height: 38px; font-size: 1.1em; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc;\" placeholder=\"Buscar...\" autocomplete=\"off\">`
            + `</div>`;
        if (!data || data.length === 0) {
            tableContainer.innerHTML = filterHtml + '<div class="no-data">No hay perfiles registrados para mostrar</div>';
            // Asegurar que el filtro siga funcionando aunque no haya resultados
            const filterSearch = document.getElementById('filterSearch');
            if (filterSearch) {
                filterSearch.value = window.lastFilterValue || '';
                filterSearch.disabled = false;
                filterSearch.addEventListener('input', function() {
                    window.lastFilterValue = this.value;
                    applyFilterPerfiles();
                });
                setTimeout(() => { filterSearch.focus(); }, 0);
            }
            return;
        }
        let html = '<table class="data-table"><thead><tr>';
        columns.forEach(col => {
            let header = col === 'email' ? 'CORREO' : col.replace(/_/g, ' ').toUpperCase();
            html += `<th>${header}</th>`;
        });
        html += '</tr></thead><tbody>';
        data.forEach(row => {
            html += '<tr>';
            columns.forEach(col => {
                html += `<td>${row[col] || '-'}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        tableContainer.innerHTML = filterHtml + html;
        // Filtro funcional robusto (como en personal)
        const filterSearch = document.getElementById('filterSearch');
        if (filterSearch) {
            filterSearch.value = window.lastFilterValue || '';
            filterSearch.disabled = false;
            filterSearch.addEventListener('input', function() {
                window.lastFilterValue = this.value;
                applyFilterPerfiles();
            });
            setTimeout(() => { filterSearch.focus(); }, 0);
        }
    }

    function applyFilterPerfiles() {
        const searchText = document.getElementById('filterSearch').value.toLowerCase().trim();
        if (!searchText) {
            renderTable(allData);
            return;
        }
        let filteredData = allData.filter(row => {
            return columns.some(col => {
                const value = row[col];
                return value != null && String(value).toLowerCase().includes(searchText);
            });
        });
        renderTable(filteredData);
    }
})();
