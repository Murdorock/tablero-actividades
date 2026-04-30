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
    let injectedAccessToken = null;

    document.addEventListener('DOMContentLoaded', function() {
        loadData();
        const form = document.getElementById('dataForm');
        if (form) form.addEventListener('submit', saveRecord);
    });

    window.addEventListener('message', function(event) {
        const payload = event && event.data ? event.data : null;
        if (!payload || payload.type !== 'SUPABASE_ACCESS_TOKEN') return;
        injectedAccessToken = payload.accessToken || null;
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
        html += '<th>ACCIONES</th>';
        html += '</tr></thead><tbody>';
        data.forEach(row => {
            html += '<tr>';
            columns.forEach(col => {
                html += `<td>${row[col] || '-'}</td>`;
            });
            html += `<td><button type="button" class="btn btn-danger delete-profile-btn" data-user-id="${row.id || ''}" data-user-email="${row.email || ''}">Eliminar</button></td>`;
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

        tableContainer.querySelectorAll('.delete-profile-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const userId = this.getAttribute('data-user-id') || '';
                const userEmail = this.getAttribute('data-user-email') || '';
                deleteProfile(userId, userEmail);
            });
        });
    }

    async function getAccessToken() {
        const { data: { session: ownSession } } = await supabaseClient.auth.getSession();
        return ownSession?.access_token || injectedAccessToken || null;
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

    function openCreateModal() {
        document.getElementById('modalTitle').textContent = 'Nuevo Perfil';
        const formFields = document.getElementById('formFields');
        formFields.innerHTML = `
            <div class="form-group">
                <label for="pf_documento">Documento de identidad</label>
                <input type="text" id="pf_documento" required placeholder="Número de documento" autocomplete="off">
            </div>
            <div class="form-group">
                <label for="pf_email">Correo electrónico</label>
                <input type="email" id="pf_email" required placeholder="usuario@ejemplo.com" autocomplete="off">
            </div>
            <div class="form-group">
                <label for="pf_nombre_completo">Nombre completo</label>
                <input type="text" id="pf_nombre_completo" required placeholder="Nombre y apellido" autocomplete="off">
            </div>
            <div class="form-group">
                <label for="pf_rol">Rol</label>
                <input type="text" id="pf_rol" required placeholder="ADMINISTRADOR / SUPERVISOR / ..." autocomplete="off">
            </div>
            <div class="form-group">
                <label for="pf_codigo_sup_aux">Código sup/aux</label>
                <input type="text" id="pf_codigo_sup_aux" required placeholder="Código interno" autocomplete="off">
            </div>
        `;
        document.getElementById('dataModal').classList.add('show');
    }

    async function saveRecord(event) {
        event.preventDefault();
        const documento = document.getElementById('pf_documento').value.trim();
        const email = document.getElementById('pf_email').value.trim();
        const nombreCompleto = document.getElementById('pf_nombre_completo').value.trim();
        const rol = document.getElementById('pf_rol').value.trim();
        const codigoSupAux = document.getElementById('pf_codigo_sup_aux').value.trim();

        if (!documento || !email || !nombreCompleto || !rol || !codigoSupAux) {
            alert('Debes completar todos los campos.');
            return;
        }

        const submitBtn = event.target.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando...'; }

        try {
            const accessToken = await getAccessToken();

            if (!accessToken) {
                alert('No hay sesion activa para autorizar la creacion. Abre esta vista desde index.html e inicia sesion como administrador.');
                return;
            }

            const { data, error } = await supabaseClient.functions.invoke('gestion-usuarios-admin', {
                body: {
                    action: 'create_user',
                    email,
                    password: documento,
                    nombreCompleto,
                    rol,
                    codigoSupAux,
                    autoConfirm: true
                },
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });
            if (error) throw error;
            if (data && data.error) throw new Error(data.error);
            closeModal();
            loadData();
        } catch (err) {
            alert('Error al guardar: ' + (err.message || 'Error desconocido'));
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar'; }
        }
    }

    async function deleteProfile(userId, userEmail) {
        if (!userId) {
            alert('No se encontro el UID del usuario a eliminar.');
            return;
        }

        const confirmDelete = confirm('Se eliminara el perfil y luego el usuario en Authentication. ¿Deseas continuar?');
        if (!confirmDelete) return;

        try {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                alert('No hay sesion activa para autorizar la eliminacion.');
                return;
            }

            const { data, error } = await supabaseClient.functions.invoke('gestion-usuarios-admin', {
                body: {
                    action: 'delete_user',
                    userId,
                    userEmail
                },
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

            if (error) throw error;
            if (data && data.error) throw new Error(data.error);

            await loadData();
        } catch (err) {
            alert('Error eliminando: ' + (err.message || 'Error desconocido'));
        }
    }

    function closeModal() {
        document.getElementById('dataModal').classList.remove('show');
    }

    window.openCreateModal = openCreateModal;
    window.closeModal = closeModal;
    window.loadData = loadData;
})();
