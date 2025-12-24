// Configuración de Supabase (reutilizar si ya existe)
let supabaseClient;
if (typeof supabase !== 'undefined') {
    supabaseClient = supabase;
} else {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Configuración de la tabla
const TABLE_NAME = 'evidencias';
const PRIMARY_KEY = 'id';

// Variables globales
let tableData = [];
let columns = [];

// Cargar datos de la tabla
async function loadData() {
    try {
        const loadingIndicator = document.getElementById('loadingIndicator');
        const dataTable = document.getElementById('dataTable');
        
        loadingIndicator.style.display = 'flex';
        dataTable.style.display = 'none';
        
        const { data, error } = await supabaseClient
            .from(TABLE_NAME)
            .select('*')
            .order('fecha', { ascending: false });
        
        if (error) {
            console.error('Error al cargar datos:', error);
            alert('Error al cargar datos: ' + error.message);
            return;
        }
        
        tableData = data || [];
        
        if (tableData.length > 0) {
            columns = Object.keys(tableData[0]);
        }
        
        renderTable();
        
        loadingIndicator.style.display = 'none';
        dataTable.style.display = 'table';
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
}

// Renderizar tabla
function renderTable() {
    const tableHeader = document.getElementById('tableHeader');
    const tableBody = document.getElementById('tableBody');
    
    // Limpiar tabla
    tableHeader.innerHTML = '';
    tableBody.innerHTML = '';
    
    if (tableData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 20px;">No hay datos disponibles</td></tr>';
        return;
    }
    
    // Crear encabezados (ocultar id)
    const headerRow = document.createElement('tr');
    columns
        .filter(col => col !== PRIMARY_KEY)
        .forEach(col => {
            const th = document.createElement('th');
            th.textContent = col.toUpperCase().replace(/_/g, ' ');
            headerRow.appendChild(th);
        });
    
    // Agregar columna de acciones
    const actionsHeader = document.createElement('th');
    actionsHeader.textContent = 'ACCIONES';
    actionsHeader.style.width = '150px';
    headerRow.appendChild(actionsHeader);
    
    tableHeader.appendChild(headerRow);
    
    // Crear filas de datos
    tableData.forEach(row => {
        const tr = document.createElement('tr');
        
        columns
            .filter(col => col !== PRIMARY_KEY)
            .forEach(col => {
                const td = document.createElement('td');
                const value = row[col];
                
                // Formatear fecha
                if (col === 'fecha' && value) {
                    const fecha = new Date(value);
                    td.textContent = fecha.toLocaleString('es-ES');
                }
                // Verificar si es un enlace (columna foto)
                else if (col === 'foto' && typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
                    const link = document.createElement('a');
                    link.href = value;
                    link.textContent = '📸 Ver foto';
                    link.target = '_blank';
                    link.style.color = '#3498db';
                    link.style.textDecoration = 'underline';
                    td.appendChild(link);
                } else {
                    td.textContent = value !== null && value !== undefined ? value : '';
                }
                
                tr.appendChild(td);
            });
        
        // Agregar botones de acciones
        const actionsTd = document.createElement('td');
        actionsTd.innerHTML = `
            <button class="btn btn-sm btn-warning" onclick="editRow('${row[PRIMARY_KEY]}')">✏️ Editar</button>
            <button class="btn btn-sm btn-danger" onclick="deleteRow('${row[PRIMARY_KEY]}')">🗑️ Eliminar</button>
        `;
        tr.appendChild(actionsTd);
        
        tableBody.appendChild(tr);
    });
}

// Agregar nueva fila
async function addRow() {
    const formHtml = columns
        .filter(col => col !== PRIMARY_KEY)
        .map(col => {
            const label = col.toUpperCase().replace(/_/g, ' ');
            let inputHtml = '';
            
            if (col === 'fecha') {
                inputHtml = `<input type="date" id="new_${col}" class="form-control" required />`;
            } else if (col === 'descripcion') {
                inputHtml = `<textarea id="new_${col}" class="form-control" rows="3"></textarea>`;
            } else if (col === 'instalacion') {
                inputHtml = `<input type="text" id="new_${col}" class="form-control" maxlength="18" pattern="\\d{1,18}" title="Solo números, máximo 18 dígitos" />`;
            } else if (col === 'direccion') {
                inputHtml = `<input type="text" id="new_${col}" class="form-control" style="text-transform: uppercase;" />`;
            } else if (col === 'correria') {
                inputHtml = `<input type="text" id="new_${col}" class="form-control" />`;
            } else if (col === 'lector') {
                inputHtml = `<input type="text" id="new_${col}" class="form-control" />`;
            } else if (col === 'foto') {
                inputHtml = `<input type="file" id="new_${col}" class="form-control" accept="image/*" />`;
            } else if (col === 'servicio') {
                inputHtml = `<input type="text" id="new_${col}" class="form-control" style="text-transform: uppercase;" />`;
            } else if (col === 'lectura') {
                inputHtml = `<input type="number" id="new_${col}" class="form-control" />`;
            } else {
                inputHtml = `<input type="text" id="new_${col}" class="form-control" />`;
            }
            
            return `
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">${label}:</label>
                    ${inputHtml}
                </div>
            `;
        })
        .join('');
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;';
    modal.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 8px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
            <h3>Agregar Nueva Evidencia</h3>
            ${formHtml}
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button class="btn btn-primary" onclick="saveNewRow()">💾 Guardar</button>
                <button class="btn btn-secondary" onclick="closeModal()">❌ Cancelar</button>
            </div>
        </div>
    `;
    modal.id = 'modal';
    document.body.appendChild(modal);
}

// Guardar nueva fila
async function saveNewRow() {
    try {
        const newData = {};
        let fotoFile = null;
        
        for (const col of columns.filter(c => c !== PRIMARY_KEY)) {
            const input = document.getElementById(`new_${col}`);
            
            if (col === 'instalacion') {
                // Validar que solo tenga números
                const value = input.value.trim();
                if (value && !/^\d{1,18}$/.test(value)) {
                    alert('El campo Instalación debe contener solo números (máximo 18 dígitos)');
                    return;
                }
                newData[col] = value;
            } else if (col === 'direccion' || col === 'servicio') {
                // Convertir a mayúsculas
                newData[col] = input.value.toUpperCase();
            } else if (col === 'foto') {
                // Guardar referencia al archivo para subirlo después
                fotoFile = input.files[0];
            } else {
                newData[col] = input.value;
            }
        }
        
        // Si hay un archivo de foto, subirlo a Supabase Storage
        if (fotoFile) {
            const fileName = `evidencias/${Date.now()}_${fotoFile.name}`;
            
            const { data: uploadData, error: uploadError } = await supabaseClient
                .storage
                .from('cold')
                .upload(fileName, fotoFile);
            
            if (uploadError) {
                alert('Error al subir la foto: ' + uploadError.message);
                return;
            }
            
            // Obtener la URL pública de la foto
            const { data: urlData } = supabaseClient
                .storage
                .from('cold')
                .getPublicUrl(fileName);
            
            newData.foto = urlData.publicUrl;
        }
        
        const { error } = await supabaseClient
            .from(TABLE_NAME)
            .insert([newData]);
        
        if (error) {
            alert('Error al guardar: ' + error.message);
            return;
        }
        
        closeModal();
        loadData();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al guardar: ' + error.message);
    }
}

// Editar fila
async function editRow(id) {
    const row = tableData.find(r => r[PRIMARY_KEY] == id);
    if (!row) return;
    
    const formHtml = columns
        .filter(col => col !== PRIMARY_KEY)
        .map(col => {
            const label = col.toUpperCase().replace(/_/g, ' ');
            const value = row[col] || '';
            let inputHtml = '';
            
            if (col === 'fecha') {
                // Convertir timestamp a formato date
                const fechaValue = value ? new Date(value).toISOString().slice(0, 10) : '';
                inputHtml = `<input type="date" id="edit_${col}" class="form-control" value="${fechaValue}" />`;
            } else if (col === 'descripcion') {
                inputHtml = `<textarea id="edit_${col}" class="form-control" rows="3">${value}</textarea>`;
            } else if (col === 'instalacion') {
                inputHtml = `<input type="text" id="edit_${col}" class="form-control" value="${value}" maxlength="18" pattern="\\d{1,18}" title="Solo números, máximo 18 dígitos" />`;
            } else if (col === 'direccion') {
                inputHtml = `<input type="text" id="edit_${col}" class="form-control" value="${value}" style="text-transform: uppercase;" />`;
            } else if (col === 'correria') {
                inputHtml = `<input type="text" id="edit_${col}" class="form-control" value="${value}" />`;
            } else if (col === 'lector') {
                inputHtml = `<input type="text" id="edit_${col}" class="form-control" value="${value}" />`;
            } else if (col === 'foto') {
                inputHtml = `
                    <input type="file" id="edit_${col}" class="form-control" accept="image/*" />
                    <small style="display: block; margin-top: 5px; color: #666;">
                        ${value ? `<a href="${value}" target="_blank">Ver foto actual</a> | ` : ''}Dejar vacío para mantener foto actual
                    </small>
                `;
            } else if (col === 'servicio') {
                inputHtml = `<input type="text" id="edit_${col}" class="form-control" value="${value}" style="text-transform: uppercase;" />`;
            } else if (col === 'lectura') {
                inputHtml = `<input type="number" id="edit_${col}" class="form-control" value="${value}" />`;
            } else {
                inputHtml = `<input type="text" id="edit_${col}" class="form-control" value="${value}" />`;
            }
            
            return `
                <div style="margin-bottom: 10px;">
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">${label}:</label>
                    ${inputHtml}
                </div>
            `;
        })
        .join('');
    
    const modal = document.createElement('div');
    try {
        const updatedData = {};
        let fotoFile = null;
        const row = tableData.find(r => r[PRIMARY_KEY] == id);
        
        for (const col of columns.filter(c => c !== PRIMARY_KEY)) {
            const input = document.getElementById(`edit_${col}`);
            
            if (col === 'instalacion') {
                // Validar que solo tenga números
                const value = input.value.trim();
                if (value && !/^\d{1,18}$/.test(value)) {
                    alert('El campo Instalación debe contener solo números (máximo 18 dígitos)');
                    return;
                }
                updatedData[col] = value;
            } else if (col === 'direccion' || col === 'servicio') {
                // Convertir a mayúsculas
                updatedData[col] = input.value.toUpperCase();
            } else if (col === 'foto') {
                // Si se seleccionó un nuevo archivo
                if (input.files && input.files[0]) {
                    fotoFile = input.files[0];
                } else {
                    // Mantener la foto actual
                    updatedData[col] = row.foto;
                }
            } else {
                updatedData[col] = input.value;
            }
        }
        
        // Si hay un nuevo archivo de foto, subirlo a Supabase Storage
        if (fotoFile) {
            const fileName = `evidencias/${Date.now()}_${fotoFile.name}`;
            
            const { data: uploadData, error: uploadError } = await supabaseClient
                .storage
                .from('cold')
                .upload(fileName, fotoFile);
            
            if (uploadError) {
                alert('Error al subir la foto: ' + uploadError.message);
                return;
            }
            
            // Obtener la URL pública de la foto
            const { data: urlData } = supabaseClient
                .storage
                .from('cold')
                .getPublicUrl(fileName);
            
            updatedData.foto = urlData.publicUrl;
        }
        
        const { error } = await supabaseClient
            .from(TABLE_NAME)
            .update(updatedData)
            .eq(PRIMARY_KEY, id);
        
        if (error) {
            alert('Error al actualizar: ' + error.message);
            return;
        }
        
        closeModal();
        loadData();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al actualizar: ' + error.message);
    }(col => col !== PRIMARY_KEY)
        .forEach(col => {
            const input = document.getElementById(`edit_${col}`);
            updatedData[col] = input.value;
        });
    
    const { error } = await supabaseClient
        .from(TABLE_NAME)
        .update(updatedData)
        .eq(PRIMARY_KEY, id);
    
    if (error) {
        alert('Error al actualizar: ' + error.message);
        return;
    }
    
    closeModal();
    loadData();
}

// Eliminar fila
async function deleteRow(id) {
    if (!confirm('¿Está seguro de que desea eliminar este registro?')) {
        return;
    }
    
    const { error } = await supabaseClient
        .from(TABLE_NAME)
        .delete()
        .eq(PRIMARY_KEY, id);
    
    if (error) {
        alert('Error al eliminar: ' + error.message);
        return;
    }
    
    loadData();
}

// Cerrar modal
function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        document.body.removeChild(modal);
    }
}

// Cargar datos al inicio
document.addEventListener('DOMContentLoaded', function() {
    loadData();
});
