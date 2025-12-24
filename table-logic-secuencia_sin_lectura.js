// table-logic-secuencia_sin_lectura.js
// Definir la clave primaria para esta vista
var PRIMARY_KEY = 'id_secuencianl';
// Lógica para la vista secuencia_sin_lectura.html

// Configuración de la tabla


// Cargar datos iniciales y ordenar por id_secuencianl
async function loadData() {
    const tableContainer = document.getElementById('tableContainer');
    tableContainer.innerHTML = '';
    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order(PRIMARY_KEY, { ascending: true })
            .limit(500);
        if (error) throw error;
        allData = data || [];
        currentData = allData;
        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]);
            renderTable(currentData);
        } else {
            tableContainer.innerHTML = '<div class="no-data">No hay registros para mostrar</div>';
        }
    } catch (error) {
        console.error('Error cargando datos:', error);
        tableContainer.innerHTML = '<div class="error">Error cargando datos: ' + error.message + '</div>';
    }
}

// Renderizar tabla ordenada
function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    if (!data || data.length === 0) {
        tableContainer.innerHTML = '<div class="no-data">No hay registros para mostrar</div>';
        return;
    }
    let html = '<table class="data-table"><thead><tr>';
    tableColumns.forEach(column => {
        const displayName = column.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        html += `<th>${displayName}</th>`;
    });
    html += '</tr></thead><tbody>';
    data.forEach(row => {
        html += '<tr>';
        tableColumns.forEach(column => {
            let value = row[column];
            if (value === null || value === undefined) value = '';
            html += `<td>${value}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    tableContainer.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', function() {
    loadData();
});
