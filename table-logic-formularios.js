const client = window._supabase;

const defaultForms = [
  {
    id: 'inspeccion_campo',
    titulo: 'INSPECCIÓN DE CAMPO',
    codigo: 'inspeccion_campo',
    descripcion: 'Plantilla base para fotos, coordenadas y selección.',
    activo: true,
    version: 1,
    estructura: {
      titulo: 'INSPECCIÓN DE CAMPO',
      descripcion: 'Plantilla base para fotos, coordenadas y selección.',
      fields: [
        { id: 'usuario', label: 'Usuario', type: 'text', required: true },
        { id: 'tipo_inspeccion', label: 'Tipo de inspección', type: 'select', options: ['Inicial', 'Seguimiento', 'Cierre'] },
        { id: 'fotos', label: 'Fotos del sitio', type: 'photo', allowMultiple: true, required: true },
        { id: 'ubicacion', label: 'Coordenadas', type: 'coordinates', required: true },
      ],
    },
  },
  {
    id: 'registro_operativo',
    titulo: 'REGISTRO OPERATIVO',
    codigo: 'registro_operativo',
    descripcion: 'Plantilla rápida para novedades y seguimiento.',
    activo: true,
    version: 1,
    estructura: {
      titulo: 'REGISTRO OPERATIVO',
      descripcion: 'Plantilla rápida para novedades y seguimiento.',
      fields: [
        { id: 'fecha', label: 'Fecha', type: 'date', required: true },
        { id: 'hora', label: 'Hora', type: 'time', required: true },
        { id: 'detalle', label: 'Detalle', type: 'textarea', required: true },
      ],
    },
  },
];

const elements = {
  formsList: document.getElementById('forms-list'),
  formTitle: document.getElementById('form-title'),
  formSubtitle: document.getElementById('form-subtitle'),
  titulo: document.getElementById('titulo'),
  codigo: document.getElementById('codigo'),
  estructura: document.getElementById('estructura'),
  preview: document.getElementById('preview'),
  btnSave: document.getElementById('btn-save'),
  btnNew: document.getElementById('btn-new'),
  btnDelete: document.getElementById('btn-delete'),
  fieldId: document.getElementById('field-id'),
  fieldLabel: document.getElementById('field-label'),
  fieldType: document.getElementById('field-type'),
  fieldOptions: document.getElementById('field-options'),
  fieldRequired: document.getElementById('field-required'),
  fieldMulti: document.getElementById('field-multi'),
  btnAddField: document.getElementById('btn-add-field'),
  fieldsList: document.getElementById('fields-list'),
};

let forms = [...defaultForms];
let activeIndex = 0;

function renderFormsList() {
  elements.formsList.innerHTML = '';
  forms.forEach((form, index) => {
    const card = document.createElement('article');
    card.className = `form-card ${index === activeIndex ? 'active' : ''}`;
    card.innerHTML = `
      <h3>${form.titulo}</h3>
      <p>${form.descripcion ?? ''}</p>
    `;
    card.addEventListener('click', () => loadForm(index));
    elements.formsList.appendChild(card);
  });
}

function sanitizeFieldId(value) {
  return (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function ensureEstructura(form) {
  if (!form.estructura || typeof form.estructura !== 'object') {
    form.estructura = {};
  }
  if (!Array.isArray(form.estructura.fields)) {
    form.estructura.fields = [];
  }
  form.estructura.titulo = form.titulo ?? form.estructura.titulo ?? '';
  form.estructura.descripcion = form.descripcion ?? form.estructura.descripcion ?? '';
}

function getActiveForm() {
  const form = forms[activeIndex];
  ensureEstructura(form);
  return form;
}

function updatePreview(form) {
  elements.preview.textContent = JSON.stringify(form, null, 2);
}

function updateJsonEditor(form) {
  elements.estructura.value = JSON.stringify(form.estructura ?? {}, null, 2);
}

function renderFieldsBuilder() {
  const form = getActiveForm();
  const fields = form.estructura.fields;
  elements.fieldsList.innerHTML = '';

  if (!fields.length) {
    const empty = document.createElement('div');
    empty.className = 'field-item';
    empty.innerHTML = '<div><strong>Sin campos</strong><small>Agrega campos con el constructor visual.</small></div>';
    elements.fieldsList.appendChild(empty);
    return;
  }

  fields.forEach((field, index) => {
    const item = document.createElement('div');
    item.className = 'field-item';

    const options = Array.isArray(field.options) && field.options.length
      ? ` | opciones: ${field.options.join(', ')}`
      : '';

    item.innerHTML = `
      <div>
        <strong>${field.label ?? field.id}</strong>
        <small>${field.id} | tipo: ${field.type ?? 'text'}${field.required ? ' | obligatorio' : ''}${field.allowMultiple ? ' | múltiple' : ''}${options}</small>
      </div>
      <div>
        <button type="button" class="danger" data-remove-field="${index}">Eliminar</button>
      </div>
    `;
    elements.fieldsList.appendChild(item);
  });
}

function setFieldControlsByType() {
  const type = elements.fieldType.value;
  const usesOptions = type === 'select' || type === 'multi_select';
  const usesMulti = type === 'photo' || type === 'file';

  elements.fieldOptions.disabled = !usesOptions;
  elements.fieldMulti.disabled = !usesMulti;

  if (!usesOptions) {
    elements.fieldOptions.value = '';
  }
  if (!usesMulti) {
    elements.fieldMulti.checked = false;
  }
}

function clearFieldBuilderInputs() {
  elements.fieldId.value = '';
  elements.fieldLabel.value = '';
  elements.fieldType.value = 'text';
  elements.fieldOptions.value = '';
  elements.fieldRequired.checked = false;
  elements.fieldMulti.checked = false;
  setFieldControlsByType();
}

function buildFieldFromInputs() {
  const label = elements.fieldLabel.value.trim();
  const type = elements.fieldType.value;
  const required = elements.fieldRequired.checked;
  const allowMultiple = elements.fieldMulti.checked;
  const rawOptions = elements.fieldOptions.value.trim();

  const manualId = elements.fieldId.value.trim();
  const id = sanitizeFieldId(manualId || label);

  if (!id) {
    alert('Define un id o etiqueta para el campo.');
    return null;
  }

  const field = {
    id,
    label: label || id,
    type,
    required,
  };

  if (type === 'select' || type === 'multi_select') {
    const options = rawOptions
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!options.length) {
      alert('Para este tipo debes agregar opciones separadas por coma.');
      return null;
    }
    field.options = options;
  }

    if ((type === 'photo' || type === 'file') && allowMultiple) {
      field.allowMultiple = true;
    }

  return field;
}

function addFieldFromBuilder() {
  const form = getActiveForm();
  const newField = buildFieldFromInputs();
  if (!newField) {
    return;
  }

  const exists = form.estructura.fields.some((field) => field.id === newField.id);
  if (exists) {
    alert('Ya existe un campo con ese id.');
    return;
  }

  form.estructura.fields.push(newField);
  form.descripcion = form.estructura.descripcion ?? form.descripcion ?? '';
  updateJsonEditor(form);
  updatePreview(form);
  renderFieldsBuilder();
  clearFieldBuilderInputs();
}

function removeField(index) {
  const form = getActiveForm();
  form.estructura.fields.splice(index, 1);
  updateJsonEditor(form);
  updatePreview(form);
  renderFieldsBuilder();
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function loadForm(index) {
  activeIndex = index;
  const form = forms[index];
  ensureEstructura(form);
  elements.formTitle.textContent = form.titulo;
  elements.formSubtitle.textContent = form.descripcion ?? 'Sin descripción';
  elements.titulo.value = form.titulo ?? '';
  elements.codigo.value = form.codigo ?? '';
  updateJsonEditor(form);
  updatePreview(form);
  renderFieldsBuilder();
  setFieldControlsByType();
  renderFormsList();
}

function syncCurrentForm() {
  const form = forms[activeIndex];
  form.titulo = elements.titulo.value.trim();
  form.codigo = elements.codigo.value.trim();
  form.estructura = safeJsonParse(elements.estructura.value, {});
  ensureEstructura(form);
  form.descripcion = form.estructura?.descripcion ?? form.descripcion ?? '';
  updatePreview(form);
  renderFieldsBuilder();
  renderFormsList();
}

function syncCurrentFormFromMeta() {
  const form = getActiveForm();
  form.titulo = elements.titulo.value.trim();
  form.codigo = elements.codigo.value.trim();
  form.estructura.titulo = form.titulo;
  form.estructura.descripcion = form.descripcion ?? form.estructura.descripcion ?? '';
  updateJsonEditor(form);
  updatePreview(form);
  renderFormsList();
}

async function fetchFormsFromSupabase() {
  const { data, error } = await client
    .from('formulario')
    .select('id,codigo,titulo,descripcion,estructura,activo,version')
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  if (!Array.isArray(data) || !data.length) {
    return [];
  }

  return data.map((item) => {
    const estructura = item.estructura && typeof item.estructura === 'object'
      ? item.estructura
      : safeJsonParse(item.estructura, {});

    return {
      id: item.id,
      titulo: item.titulo ?? item.codigo,
      codigo: item.codigo,
      descripcion: item.descripcion ?? estructura?.descripcion ?? '',
      activo: item.activo ?? true,
      version: item.version ?? 1,
      estructura: estructura ?? { fields: [] },
    };
  });
}

async function saveFormToSupabase() {
  syncCurrentForm();
  const form = getActiveForm();

  if (!form.codigo || !form.titulo) {
    alert('Debes completar nombre y código del formulario.');
    return;
  }

  const payload = {
    codigo: form.codigo,
    titulo: form.titulo,
    descripcion: form.descripcion ?? '',
    estructura: form.estructura ?? {},
    activo: true,
    version: form.version ?? 1,
  };

  const { error } = await client
    .from('formulario')
    .upsert(payload, { onConflict: 'codigo' });

  if (error) {
    alert(`No se pudo guardar: ${error.message}`);
    return;
  }

  alert('Formulario guardado en Supabase');
  await initForms();
}

async function deleteActiveForm() {
  if (!forms.length) {
    alert('No hay formulario para eliminar.');
    return;
  }

  const form = getActiveForm();
  const formName = form.titulo || form.codigo || 'este formulario';

  if (!confirm(`¿Seguro que deseas eliminar ${formName}? Esta acción no se puede deshacer.`)) {
    return;
  }

  const isLocalOnly = String(form.id || '').startsWith('form_');

  if (isLocalOnly) {
    forms.splice(activeIndex, 1);

    if (!forms.length) {
      createNewForm();
      return;
    }

    const nextIndex = Math.max(0, activeIndex - 1);
    loadForm(nextIndex);
    return;
  }

  if (!form.codigo) {
    alert('No se puede eliminar porque el formulario no tiene código.');
    return;
  }

  try {
    let deletedRows = [];

    if (form.id && !String(form.id).startsWith('form_')) {
      const { data, error } = await client
        .from('formulario')
        .delete()
        .eq('id', form.id)
        .select('id,codigo');

      if (error) {
        alert(`No se pudo eliminar: ${error.message}`);
        return;
      }

      deletedRows = data || [];
    }

    if (!deletedRows.length && form.codigo) {
      const { data, error } = await client
        .from('formulario')
        .delete()
        .eq('codigo', form.codigo)
        .select('id,codigo');

      if (error) {
        alert(`No se pudo eliminar: ${error.message}`);
        return;
      }

      deletedRows = data || [];
    }

    if (!deletedRows.length) {
      alert('No se eliminó ningún registro. Verifica permisos (RLS) o que el formulario exista.');
      return;
    }

    alert('Formulario eliminado de Supabase');
    await initForms();
  } catch (error) {
    alert(`No se pudo eliminar: ${error.message || error}`);
  }
}

function createNewForm() {
  const nextIndex = forms.length + 1;
  const newForm = {
    id: `form_${nextIndex}`,
    titulo: `FORMULARIO ${nextIndex}`,
    codigo: `formulario_${nextIndex}`,
    descripcion: 'Nuevo formulario',
    activo: true,
    version: 1,
    estructura: {
      titulo: `FORMULARIO ${nextIndex}`,
      descripcion: 'Nuevo formulario',
      fields: [],
    },
  };

  forms.unshift(newForm);
  loadForm(0);
}

function handleFieldsListClick(event) {
  const button = event.target.closest('[data-remove-field]');
  if (!button) {
    return;
  }

  const index = Number(button.getAttribute('data-remove-field'));
  if (Number.isNaN(index)) {
    return;
  }

  removeField(index);
}

async function initForms() {
  try {
    const loadedForms = await fetchFormsFromSupabase();
    forms = loadedForms;

    if (!forms.length) {
      createNewForm();
      return;
    }
  } catch (error) {
    console.error('No se pudieron cargar formularios desde Supabase', error);
    forms = [...defaultForms];
  }

  activeIndex = 0;
  loadForm(0);
}

elements.titulo.addEventListener('input', syncCurrentFormFromMeta);
elements.codigo.addEventListener('input', syncCurrentFormFromMeta);
elements.estructura.addEventListener('input', syncCurrentForm);
elements.btnSave.addEventListener('click', saveFormToSupabase);
elements.btnNew.addEventListener('click', createNewForm);
elements.btnDelete.addEventListener('click', deleteActiveForm);
elements.btnAddField.addEventListener('click', addFieldFromBuilder);
elements.fieldType.addEventListener('change', setFieldControlsByType);
elements.fieldsList.addEventListener('click', handleFieldsListClick);

initForms();
