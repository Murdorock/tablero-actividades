let authUsers = [];

document.addEventListener('DOMContentLoaded', function() {
    const btnRefreshUsers = document.getElementById('btnRefreshUsers');
    const btnAddUser = document.getElementById('btnAddUser');
    const btnCancelCreateUser = document.getElementById('btnCancelCreateUser');
    const createUserForm = document.getElementById('createUserForm');
    const dataModal = document.getElementById('dataModal');

    if (btnRefreshUsers) {
        btnRefreshUsers.addEventListener('click', loadData);
    }

    if (btnAddUser) {
        btnAddUser.addEventListener('click', openCreateModal);
    }

    if (btnCancelCreateUser) {
        btnCancelCreateUser.addEventListener('click', closeModal);
    }

    if (dataModal) {
        dataModal.addEventListener('click', function(event) {
            if (event.target === dataModal) {
                closeModal();
            }
        });
    }

    if (createUserForm) {
        createUserForm.addEventListener('submit', createUser);
    }

    loadData();
});

async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');

    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (tableContainer) tableContainer.innerHTML = '';

    try {
        const users = await listAllAuthUsers();
        authUsers = users;
        renderTable(authUsers);
    } catch (error) {
        console.error('Error cargando usuarios', error);
        renderPermissionError(error);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

async function listAllAuthUsers() {
    const perPage = 1000;
    let page = 1;
    let users = [];

    while (true) {
        const data = await callAuthAdminFunction('list_users', { page, perPage });
        const chunk = data && Array.isArray(data.users) ? data.users : [];
        users = users.concat(chunk);

        if (chunk.length < perPage) break;
        page += 1;
    }

    users.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
    });

    return users;
}

function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    if (!tableContainer) return;

    const filterHtml = `
        <div style="margin-bottom: 10px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <label for="filterSearch" style="font-weight:bold; font-size:1.1em;">Buscar:</label>
            <input type="text" id="filterSearch" style="width: 320px; height: 38px; font-size: 1.05em; padding: 6px 10px; border-radius: 6px; border: 1px solid #475569; background:#0f172a; color:#e2e8f0;" placeholder="Buscar por UID, email, phone o provider" autocomplete="off">
        </div>
    `;

    if (!authUsers || authUsers.length === 0) {
        tableContainer.innerHTML = filterHtml + '<div class="no-data" style="padding:20px;">No hay usuarios para mostrar</div>';
        bindFilterEvents();
        return;
    }

    let html = '<table class="data-table"><thead><tr>';
    html += '<th>Email</th>';
    html += '<th>Created at</th>';
    html += '<th>Last sign in at</th>';
    html += '<th>Acciones</th>';
    html += '</tr></thead><tbody id="usersTableBody"></tbody>';
    html += '</table>';
    tableContainer.innerHTML = filterHtml + html;
    renderTableRows(data);
    bindFilterEvents();
}

function renderTableRows(data) {
    const tableBody = document.getElementById('usersTableBody');
    if (!tableBody) return;

    if (!data || data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Sin resultados para el filtro</td></tr>';
        return;
    }

    let rowsHtml = '';
    data.forEach(user => {
        rowsHtml += '<tr>';
        rowsHtml += `<td>${escapeHtml(user.email || '-')}</td>`;
        rowsHtml += `<td>${escapeHtml(formatDate(user.created_at))}</td>`;
        rowsHtml += `<td>${escapeHtml(formatDate(user.last_sign_in_at))}</td>`;
        rowsHtml += `<td class="actions"><button class="btn btn-sm btn-danger delete-user-btn" data-user-id="${escapeHtml(user.id || '')}" data-user-email="${escapeHtml(user.email || '')}">🗑️ Eliminar</button></td>`;
        rowsHtml += '</tr>';
    });

    tableBody.innerHTML = rowsHtml;
    bindDeleteEvents();
}

function bindFilterEvents() {
    const filterSearch = document.getElementById('filterSearch');
    if (!filterSearch) return;

    filterSearch.value = window.lastUsersFilterValue || '';
    filterSearch.addEventListener('input', function() {
        window.lastUsersFilterValue = this.value;
        applyFilter();
    });
}

function applyFilter() {
    const filterSearch = document.getElementById('filterSearch');
    if (!filterSearch) return;

    const text = filterSearch.value.toLowerCase().trim();
    if (!text) {
        renderTableRows(authUsers);
        return;
    }

    const filtered = authUsers.filter(user => {
        const fields = [
            user.id,
            user.email,
            user.phone,
            getDisplayName(user),
            getProviderType(user),
            getProviderList(user).join(' ')
        ];

        return fields.some(value => value != null && String(value).toLowerCase().includes(text));
    });

    renderTableRows(filtered);
}

function openCreateModal() {
    const dataModal = document.getElementById('dataModal');
    const createUserForm = document.getElementById('createUserForm');
    if (createUserForm) createUserForm.reset();

    const autoConfirm = document.getElementById('newUserAutoConfirm');
    if (autoConfirm) autoConfirm.checked = true;

    if (dataModal) dataModal.classList.add('show');
}

function closeModal() {
    const dataModal = document.getElementById('dataModal');
    if (dataModal) dataModal.classList.remove('show');
}

async function createUser(event) {
    event.preventDefault();

    const emailInput = document.getElementById('newUserEmail');
    const passwordInput = document.getElementById('newUserPassword');
    const nombreCompletoInput = document.getElementById('newUserNombreCompleto');
    const rolInput = document.getElementById('newUserRol');
    const codigoSupAuxInput = document.getElementById('newUserCodigoSupAux');
    const autoConfirmInput = document.getElementById('newUserAutoConfirm');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    const nombreCompleto = nombreCompletoInput ? nombreCompletoInput.value.trim() : '';
    const rol = rolInput ? rolInput.value.trim() : '';
    const codigoSupAux = codigoSupAuxInput ? codigoSupAuxInput.value.trim() : '';
    const autoConfirm = autoConfirmInput ? autoConfirmInput.checked : true;

    if (!email || !password || !nombreCompleto || !rol || !codigoSupAux) {
        showMessage('Debes completar email, contraseña, nombre completo, rol y código sup/aux.', 'error');
        return;
    }

    try {
        await callAuthAdminFunction('create_user', {
            email,
            password,
            nombreCompleto,
            rol,
            codigoSupAux,
            autoConfirm
        });

        closeModal();
        showMessage('Usuario creado.', 'success');
        await loadData();
    } catch (error) {
        console.error('Error creando usuario:', error);
        showMessage(`Error creando usuario: ${error.message || 'Sin detalle'}`, 'error');
    }
}

async function callAuthAdminFunction(action, payload = {}) {
    const { data, error } = await supabase.functions.invoke('gestion-usuarios-admin', {
        body: {
            action,
            ...payload
        }
    });

    if (error) {
        throw new Error(error.message || 'Error invocando función de usuarios');
    }

    if (data && data.error) {
        throw new Error(data.error);
    }

    return data || {};
}

function renderPermissionError(error) {
    const tableContainer = document.getElementById('tableContainer');
    if (!tableContainer) return;

    const message = error && error.message ? error.message : 'No se pudo consultar Authentication.';
    const needsAdminKey = /not allowed|insufficient|permission|admin/i.test(message);

    tableContainer.innerHTML = `
        <div class="error" style="padding: 20px; line-height:1.6;">
            <strong>No fue posible consultar Authentication.</strong><br>
            ${escapeHtml(message)}
            ${needsAdminKey ? '<br><br>Verifica que la Edge Function <strong>gestion-usuarios-admin</strong> esté desplegada y que el usuario tenga rol ADMINISTRADOR en perfiles.' : ''}
        </div>
    `;
}

function getDisplayName(user) {
    return (
        user.user_metadata?.display_name ||
        user.user_metadata?.name ||
        user.raw_user_meta_data?.display_name ||
        '-'
    );
}

function getProviderList(user) {
    const providersFromIdentities = Array.isArray(user.identities)
        ? user.identities.map(identity => identity.provider).filter(Boolean)
        : [];

    const providersFromAppMetadata = Array.isArray(user.app_metadata?.providers)
        ? user.app_metadata.providers
        : [];

    const providers = [...providersFromIdentities, ...providersFromAppMetadata]
        .filter(Boolean)
        .map(value => String(value).toLowerCase());

    const unique = [...new Set(providers)];
    return unique.length ? unique.map(capitalizeWord) : ['-'];
}

function getProviderType(user) {
    const provider = user.app_metadata?.provider;
    if (provider) return capitalizeWord(String(provider));

    const providers = getProviderList(user).filter(value => value !== '-');
    return providers[0] || '-';
}

function capitalizeWord(value) {
    if (!value) return '-';
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function bindDeleteEvents() {
    const deleteButtons = document.querySelectorAll('.delete-user-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const userId = this.getAttribute('data-user-id') || '';
            const userEmail = this.getAttribute('data-user-email') || '';
            await deleteUser(userId, userEmail);
        });
    });
}

async function deleteUser(userId, userEmail) {
    if (!userId) {
        showMessage('No se encontró el UID del usuario a eliminar.', 'error');
        return;
    }

    const confirmDelete = window.confirm(`¿Eliminar usuario ${userEmail || userId}?\n\nSe borrará el usuario de la base de datos.`);
    if (!confirmDelete) return;

    try {
        await callAuthAdminFunction('delete_user', {
            userId,
            userEmail
        });

        showMessage('Usuario eliminado.', 'success');
        await loadData();
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        showMessage(`Error eliminando usuario: ${error.message || 'Sin detalle'}`, 'error');
    }
}