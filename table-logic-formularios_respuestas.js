const client = window._supabase;
const TABLE_NAME = 'formularios_respuestas';

const elements = {
  loading: document.getElementById('loading'),
  tableContainer: document.getElementById('table-container'),
  filterSearch: document.getElementById('filter-search'),
  filterForm: document.getElementById('filter-form'),
  filterState: document.getElementById('filter-state'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnExport: document.getElementById('btn-export'),
};

let allRows = [];
let filteredRows = [];
let dynamicColumns = [];

function safeJsonParse(value, fallback = {}) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDateValue(row) {
  return row.created_at || row.fecha_envio || row.updated_at || null;
}

function getFormularioLabel(row) {
  const respuesta = safeJsonParse(row.respuesta, {});
  const fromJson = respuesta?.formulario?.titulo || respuesta?.formulario?.codigo || respuesta?.formulario?.id;
  return fromJson || row.formulario_id || 'Sin formulario';
}

function getSearchText(row) {
  const respuestaObj = safeJsonParse(row.respuesta, {});
  const compactJson = JSON.stringify(respuestaObj).toLowerCase();

  return [
    row.id,
    row.formulario_id,
    row.usuario_id,
    row.estado,
    getFormularioLabel(row),
    compactJson,
  ]
    .map((item) => String(item ?? '').toLowerCase())
    .join(' ');
}

function summarizeRespuesta(row) {
  const respuesta = getRowAnswerMap(row);
  const keys = Object.keys(respuesta || {});

  if (!keys.length) return 'Sin contenido';

  const firstKeys = keys.slice(0, 3).join(', ');
  return `${keys.length} campos: ${firstKeys}`;
}

function formatAnswerValue(value) {
  if (value === null || value === undefined) return '-';

  if (Array.isArray(value)) {
    return value.map((item) => formatAnswerValue(item)).join(', ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  const text = String(value).trim();
  return text || '-';
}

function addAnswerField(target, label, value) {
  const baseLabel = String(label || '').trim();
  if (!baseLabel) return;

  const normalizedValue = formatAnswerValue(value);
  if (normalizedValue === '-') return;

  if (target[baseLabel] === undefined) {
    target[baseLabel] = normalizedValue;
    return;
  }

  if (target[baseLabel] === normalizedValue) {
    return;
  }

  let index = 2;
  while (target[`${baseLabel} (${index})`] !== undefined) {
    index += 1;
  }
  target[`${baseLabel} (${index})`] = normalizedValue;
}

function getFieldAnswerValue(field) {
  const directKeys = ['valor', 'value', 'respuesta', 'answer', 'texto', 'text', 'selected', 'seleccion', 'resultado'];

  for (const key of directKeys) {
    if (field[key] !== undefined && field[key] !== null && String(field[key]).trim() !== '') {
      return field[key];
    }
  }

  if (Array.isArray(field.valores) && field.valores.length) return field.valores;
  if (Array.isArray(field.archivos) && field.archivos.length) return field.archivos;
  if (Array.isArray(field.fotos) && field.fotos.length) return field.fotos;

  return null;
}

function extractFromObjectMap(target, source) {
  Object.entries(source || {}).forEach(([key, value]) => {
    if (value === null || value === undefined) return;

    if (typeof value === 'object' && !Array.isArray(value)) {
      addAnswerField(target, key, JSON.stringify(value));
      return;
    }

    addAnswerField(target, key, value);
  });
}

function buildAnswerMap(row) {
  const respuesta = safeJsonParse(row.respuesta, {});
  const answerMap = {};

  if (Array.isArray(respuesta.respuestas)) {
    respuesta.respuestas.forEach((field, idx) => {
      if (!field || typeof field !== 'object') return;
      const label = field.label || field.id || `campo_${idx + 1}`;
      addAnswerField(answerMap, label, getFieldAnswerValue(field));
    });
  } else if (respuesta.respuestas && typeof respuesta.respuestas === 'object') {
    extractFromObjectMap(answerMap, respuesta.respuestas);
  }

  if (respuesta.datos && typeof respuesta.datos === 'object') {
    extractFromObjectMap(answerMap, respuesta.datos);
  }

  if (respuesta.valores && typeof respuesta.valores === 'object') {
    extractFromObjectMap(answerMap, respuesta.valores);
  }

  const excludedTopLevelKeys = new Set(['formulario', 'respuestas', 'datos', 'valores', 'meta', 'metadata']);
  Object.entries(respuesta || {}).forEach(([key, value]) => {
    if (excludedTopLevelKeys.has(key)) return;
    if (value === null || value === undefined) return;
    addAnswerField(answerMap, key, value);
  });

  return answerMap;
}

function getRowAnswerMap(row) {
  if (!row.__answerMap) {
    row.__answerMap = buildAnswerMap(row);
  }

  return row.__answerMap;
}

function computeDynamicColumns(rows) {
  const seen = new Set();
  const ordered = [];

  rows.forEach((row) => {
    const answerMap = getRowAnswerMap(row);
    Object.keys(answerMap).forEach((key) => {
      if (seen.has(key)) return;
      seen.add(key);
      ordered.push(key);
    });
  });

  return ordered;
}

function formatDate(dateValue) {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);

  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const aDate = getDateValue(a) ? new Date(getDateValue(a)).getTime() : 0;
    const bDate = getDateValue(b) ? new Date(getDateValue(b)).getTime() : 0;
    return bDate - aDate;
  });
}

function populateFilters() {
  const forms = [...new Set(allRows.map((row) => getFormularioLabel(row)).filter(Boolean))].sort();
  const states = [...new Set(allRows.map((row) => row.estado).filter(Boolean))].sort();

  const currentForm = elements.filterForm.value;
  const currentState = elements.filterState.value;

  elements.filterForm.innerHTML = '<option value="">Todos</option>';
  forms.forEach((form) => {
    const option = document.createElement('option');
    option.value = form;
    option.textContent = form;
    elements.filterForm.appendChild(option);
  });

  elements.filterState.innerHTML = '<option value="">Todos</option>';
  states.forEach((state) => {
    const option = document.createElement('option');
    option.value = state;
    option.textContent = state;
    elements.filterState.appendChild(option);
  });

  elements.filterForm.value = forms.includes(currentForm) ? currentForm : '';
  elements.filterState.value = states.includes(currentState) ? currentState : '';
}

function applyFilters() {
  const search = elements.filterSearch.value.trim().toLowerCase();
  const selectedForm = elements.filterForm.value;
  const selectedState = elements.filterState.value;

  filteredRows = allRows.filter((row) => {
    const byForm = !selectedForm || getFormularioLabel(row) === selectedForm;
    const byState = !selectedState || String(row.estado || '') === selectedState;
    const bySearch = !search || getSearchText(row).includes(search);
    return byForm && byState && bySearch;
  });

  dynamicColumns = computeDynamicColumns(filteredRows);

  renderTable();
}

function renderTable() {
  if (!filteredRows.length) {
    elements.tableContainer.innerHTML = '<div class="empty">No hay respuestas para mostrar con los filtros actuales.</div>';
    return;
  }

  let html = `
    <table>
      <thead>
        <tr>
          ${dynamicColumns.map((col) => `<th>${escapeHtml(col)}</th>`).join('')}
          <th>Respuesta JSON</th>
        </tr>
      </thead>
      <tbody>
  `;

  filteredRows.forEach((row) => {
    const respuestaObj = safeJsonParse(row.respuesta, {});
    const prettyJson = escapeHtml(JSON.stringify(respuestaObj, null, 2));
    const answerMap = getRowAnswerMap(row);

    html += `
      <tr>
        ${dynamicColumns
          .map((col) => {
            const value = answerMap[col] !== undefined ? answerMap[col] : '-';
            return `<td>${escapeHtml(value)}</td>`;
          })
          .join('')}
        <td>
          <details>
            <summary>Ver detalle</summary>
            <pre>${prettyJson}</pre>
          </details>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  elements.tableContainer.innerHTML = html;
}

function exportCsv() {
  if (!filteredRows.length) {
    alert('No hay datos para exportar.');
    return;
  }

  const headers = [...dynamicColumns];

  const lines = filteredRows.map((row) => {
    const answerMap = getRowAnswerMap(row);
    const values = [
      ...dynamicColumns.map((col) => answerMap[col] || ''),
    ];

    return values
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(';');
  });

  const csv = `${headers.join(';')}\n${lines.join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `formularios_respuestas_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

async function loadData() {
  elements.loading.style.display = 'block';
  elements.tableContainer.innerHTML = '';

  try {
    const { data, error } = await client
      .from(TABLE_NAME)
      .select('*')
      .limit(1000);

    if (error) {
      throw error;
    }

    allRows = sortRows(data || []);
    filteredRows = [...allRows];

    populateFilters();
    applyFilters();
  } catch (error) {
    console.error(error);
    elements.tableContainer.innerHTML = `<div class="empty">Error al cargar respuestas: ${escapeHtml(error.message || error)}</div>`;
  } finally {
    elements.loading.style.display = 'none';
  }
}

elements.filterSearch.addEventListener('input', applyFilters);
elements.filterForm.addEventListener('change', applyFilters);
elements.filterState.addEventListener('change', applyFilters);
elements.btnRefresh.addEventListener('click', loadData);
elements.btnExport.addEventListener('click', exportCsv);

loadData();
