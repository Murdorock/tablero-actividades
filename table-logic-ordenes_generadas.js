// Lógica específica para la tabla ordenes_generadas
let tableColumns = [];
let currentData = [];
const APP_TIME_ZONE = 'America/Bogota';
const BOGOTA_UTC_OFFSET = '-05:00';
let totalOrdenesChartInstance = null;
const ORDENES_EXCEL_HEADER_MAP = {
    'periodo consumo': 'periodo_consumo',
    ciclo: 'ciclo',
    ano: 'anio',
    'mes(es)': 'mes',
    mes: 'mes',
    correria: 'correria',
    zona: 'zona',
    'nombre zona': 'nombre_zona',
    periodicidad: 'periodicidad',
    'nombre correria': 'nombre_correria',
    'valor pasaje': 'valor_pasaje',
    'urbana/rural': 'urbana_rural',
    'numero ordenes sin asignar': 'num_ordenes_sin_asignar',
    'numero ordenes asignadas': 'num_ordenes_asignadas',
    'numero ordenes legalizadas': 'num_ordenes_legalizadas',
    'numero ordenes anuladas': 'num_ordenes_anuladas',
    'numero de ordenes totales': 'num_ordenes_totales',
    'numero ordenes de energia': 'num_ordenes_energia',
    'numero ordenes de gas': 'num_ordenes_gas',
    'numero ordenes de agua': 'num_ordenes_agua',
    'numero ordenes de otros': 'num_ordenes_otros',
    'fecha programada': 'fecha_programada',
    lector: 'lector',
    terminal: 'terminal'
};
const ORDENES_EXCEL_REQUIRED_COLUMNS = [
    'periodo_consumo', 'ciclo', 'anio', 'mes', 'correria', 'zona', 'nombre_zona',
    'periodicidad', 'nombre_correria', 'valor_pasaje', 'urbana_rural',
    'num_ordenes_sin_asignar', 'num_ordenes_asignadas', 'num_ordenes_legalizadas',
    'num_ordenes_anuladas', 'num_ordenes_totales', 'num_ordenes_energia',
    'num_ordenes_gas', 'num_ordenes_agua', 'num_ordenes_otros', 'fecha_programada',
    'lector', 'terminal'
];
const totalOrdenesPointLabelsPlugin = {
    id: 'totalOrdenesPointLabels',
    afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const chartArea = chart.chartArea;
        const datasetMeta = chart.getDatasetMeta(0);
        const data = chart.data.datasets?.[0]?.data || [];

        if (!datasetMeta || !datasetMeta.data || datasetMeta.data.length === 0 || !chartArea) return;

        const intersects = (a, b) => {
            return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
        };

        const pointInRect = (point, rect, padding = 0) => {
            return (
                point.x >= rect.left - padding &&
                point.x <= rect.right + padding &&
                point.y >= rect.top - padding &&
                point.y <= rect.bottom + padding
            );
        };

        const ccw = (ax, ay, bx, by, cx, cy) => (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);

        const segmentsIntersect = (ax, ay, bx, by, cx, cy, dx, dy) => {
            return ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy)
                && ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy);
        };

        const lineIntersectsRect = (x1, y1, x2, y2, rect) => {
            if (pointInRect({ x: x1, y: y1 }, rect) || pointInRect({ x: x2, y: y2 }, rect)) {
                return true;
            }

            return (
                segmentsIntersect(x1, y1, x2, y2, rect.left, rect.top, rect.right, rect.top) ||
                segmentsIntersect(x1, y1, x2, y2, rect.right, rect.top, rect.right, rect.bottom) ||
                segmentsIntersect(x1, y1, x2, y2, rect.right, rect.bottom, rect.left, rect.bottom) ||
                segmentsIntersect(x1, y1, x2, y2, rect.left, rect.bottom, rect.left, rect.top)
            );
        };

        const drawRoundedRect = (x, y, width, height, radius) => {
            const safeRadius = Math.min(radius, width / 2, height / 2);
            ctx.beginPath();
            ctx.moveTo(x + safeRadius, y);
            ctx.lineTo(x + width - safeRadius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
            ctx.lineTo(x + width, y + height - safeRadius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
            ctx.lineTo(x + safeRadius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
            ctx.lineTo(x, y + safeRadius);
            ctx.quadraticCurveTo(x, y, x + safeRadius, y);
            ctx.closePath();
        };

        const placedRects = [];
        const points = datasetMeta.data.map(point => ({ x: point.x, y: point.y }));
        const lineSegments = [];

        for (let index = 0; index < points.length - 1; index += 1) {
            lineSegments.push({
                x1: points[index].x,
                y1: points[index].y,
                x2: points[index + 1].x,
                y2: points[index + 1].y
            });
        }

        ctx.save();
        ctx.font = '700 10px Segoe UI';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        datasetMeta.data.forEach((point, index) => {
            const value = Number(data[index] || 0);
            const label = formatCompactNumber(value);
            const textWidth = ctx.measureText(label).width;
            const textHeight = 10;
            const paddingX = 6;
            const paddingY = 3;
            const boxWidth = textWidth + (paddingX * 2);
            const boxHeight = textHeight + (paddingY * 2);
            const candidates = [
                { dx: 0, dy: -24 },
                { dx: 18, dy: -20 },
                { dx: -18, dy: -20 },
                { dx: 0, dy: 24 },
                { dx: 20, dy: 20 },
                { dx: -20, dy: 20 },
                { dx: 30, dy: -12 },
                { dx: -30, dy: -12 }
            ];

            let chosen = null;

            for (const candidate of candidates) {
                let x = point.x + candidate.dx;
                let y = point.y + candidate.dy;

                const minX = chartArea.left + (boxWidth / 2) + 2;
                const maxX = chartArea.right - (boxWidth / 2) - 2;
                x = Math.max(minX, Math.min(maxX, x));

                const minY = chartArea.top + (boxHeight / 2) + 2;
                const maxY = chartArea.bottom - (boxHeight / 2) - 2;
                y = Math.max(minY, Math.min(maxY, y));

                const rect = {
                    left: x - (boxWidth / 2),
                    right: x + (boxWidth / 2),
                    top: y - (boxHeight / 2),
                    bottom: y + (boxHeight / 2)
                };

                const hasCollision = placedRects.some(existingRect => intersects(rect, existingRect));
                const collidesPoint = points.some(otherPoint => pointInRect(otherPoint, rect, 6));
                const crossesLine = lineSegments.some(segment => lineIntersectsRect(segment.x1, segment.y1, segment.x2, segment.y2, rect));

                if (!hasCollision && !collidesPoint && !crossesLine) {
                    chosen = { x, y, rect };
                    break;
                }
            }

            if (!chosen) {
                const fallbackY = Math.max(chartArea.top + (boxHeight / 2) + 2, point.y - 26);
                chosen = {
                    x: point.x,
                    y: fallbackY,
                    rect: {
                        left: point.x - (boxWidth / 2),
                        right: point.x + (boxWidth / 2),
                        top: fallbackY - (boxHeight / 2),
                        bottom: fallbackY + (boxHeight / 2)
                    }
                };
            }

            placedRects.push(chosen.rect);

            drawRoundedRect(chosen.rect.left, chosen.rect.top, boxWidth, boxHeight, 4);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
            ctx.fill();

            ctx.strokeStyle = 'rgba(226, 232, 240, 0.75)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, chosen.x, chosen.y + 0.5);
        });

        ctx.restore();
    }
};

document.addEventListener('DOMContentLoaded', function() {
    inicializarImportadorExcelOrdenes();
    refreshTotalesPorMes();

    document.getElementById('totalesMesSelector')?.addEventListener('change', function() {
        refreshTotalesPorMes();
    });

    enableMonthSelectorClickToggle();

    document.getElementById('dataForm')?.addEventListener('submit', async function(event) {
        event.preventDefault();
        await saveRecord();
    });

    window.addEventListener('click', function(event) {
        const modal = document.getElementById('dataModal');
        if (event.target === modal) {
            closeModal();
        }
    });
});

function inicializarImportadorExcelOrdenes() {
    const input = document.getElementById('ordenesExcelInput');
    if (!input || input.dataset.bound === '1') return;

    input.dataset.bound = '1';
    input.addEventListener('change', async event => {
        const file = event?.target?.files?.[0];
        if (!file) return;

        try {
            await importarOrdenesDesdeExcel(file);
        } catch (error) {
            const message = error?.message || 'Error inesperado al importar Excel';
            console.error('Error importando ordenes desde Excel:', error);
            showMessage(message, 'error');
        } finally {
            input.value = '';
        }
    });
}

function abrirSelectorExcelOrdenes() {
    if (typeof XLSX === 'undefined') {
        showMessage('No se pudo cargar la libreria para Excel', 'error');
        return;
    }

    const input = document.getElementById('ordenesExcelInput');
    if (!input) {
        showMessage('No se encontro el selector de archivo', 'error');
        return;
    }

    input.click();
}

function sanitizeExcelHeader(value) {
    return normalizeText(value).replace(/[^a-z0-9/()]+/g, ' ').trim();
}

function isEmptyExcelRow(row) {
    if (!Array.isArray(row)) return true;
    return row.every(value => value === null || value === undefined || String(value).trim() === '');
}

function parseExcelDate(value) {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number') {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed && parsed.y && parsed.m && parsed.d) {
            const month = String(parsed.m).padStart(2, '0');
            const day = String(parsed.d).padStart(2, '0');
            return `${parsed.y}-${month}-${day}T00:00:00${BOGOTA_UTC_OFFSET}`;
        }
    }

    const parts = getDatePartsInTimeZone(value);
    if (parts) {
        return `${parts.isoDate}T00:00:00${BOGOTA_UTC_OFFSET}`;
    }

    return null;
}

function normalizeCellValue(targetColumn, rawValue) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
        return null;
    }

    if (targetColumn === 'fecha_programada') {
        return parseExcelDate(rawValue);
    }

    const numericColumns = new Set([
        'ciclo',
        'anio',
        'mes',
        'correria',
        'zona',
        'valor_pasaje',
        'num_ordenes_sin_asignar',
        'num_ordenes_asignadas',
        'num_ordenes_legalizadas',
        'num_ordenes_anuladas',
        'num_ordenes_totales',
        'num_ordenes_energia',
        'num_ordenes_gas',
        'num_ordenes_agua',
        'num_ordenes_otros'
    ]);

    if (numericColumns.has(targetColumn)) {
        if (typeof rawValue === 'number') return rawValue;

        const textNumber = String(rawValue).trim();
        let numericValue = Number(textNumber);

        if (Number.isNaN(numericValue)) {
            if (textNumber.includes(',') && textNumber.includes('.')) {
                numericValue = Number(textNumber.replace(/\./g, '').replace(',', '.'));
            } else if (textNumber.includes(',')) {
                numericValue = Number(textNumber.replace(',', '.'));
            }
        }

        if (!Number.isNaN(numericValue)) return numericValue;
    }

    return String(rawValue).trim();
}

function parseOrdenesExcelRows(workbook) {
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        defval: null,
        raw: true,
        blankrows: true
    });

    if (!rows || rows.length < 9) {
        throw new Error('El archivo no contiene la fila de encabezados (fila 9).');
    }

    const headerRow = rows[8] || [];
    const columnIndexMap = new Map();

    headerRow.forEach((headerValue, index) => {
        const normalizedHeader = sanitizeExcelHeader(headerValue);
        const targetColumn = ORDENES_EXCEL_HEADER_MAP[normalizedHeader];
        if (targetColumn) {
            columnIndexMap.set(targetColumn, index);
        }
    });

    const missingColumns = ORDENES_EXCEL_REQUIRED_COLUMNS.filter(column => !columnIndexMap.has(column));
    if (missingColumns.length > 0) {
        throw new Error(`Faltan columnas en el Excel: ${missingColumns.join(', ')}`);
    }

    const dataRows = rows.slice(9).filter(row => !isEmptyExcelRow(row));

    if (dataRows.length === 0) {
        throw new Error('No hay registros para importar (datos desde fila 10).');
    }

    return dataRows.map((row, rowIndex) => {
        const record = {};

        ORDENES_EXCEL_REQUIRED_COLUMNS.forEach(targetColumn => {
            const columnIndex = columnIndexMap.get(targetColumn);
            const rawValue = row[columnIndex];
            record[targetColumn] = normalizeCellValue(targetColumn, rawValue);
        });

        if (!record.fecha_programada) {
            throw new Error(`No se pudo interpretar fecha_programada en la fila ${rowIndex + 10}.`);
        }

        return record;
    });
}

async function importarOrdenesDesdeExcel(file) {
    if (!file) return;

    showMessage('Leyendo archivo Excel...', 'info');

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const records = parseOrdenesExcelRows(workbook);

    const proceed = confirm(`Se importaran ${records.length} registros en ${TABLE_NAME}. Deseas continuar?`);
    if (!proceed) {
        showMessage('Importacion cancelada por el usuario', 'info');
        return;
    }

    const batchSize = 200;
    let inserted = 0;

    for (let index = 0; index < records.length; index += batchSize) {
        const batch = records.slice(index, index + batchSize);
        const { error } = await supabase
            .from(TABLE_NAME)
            .insert(batch);

        if (error) {
            throw new Error(`Error insertando lote ${Math.floor(index / batchSize) + 1}: ${error.message}`);
        }

        inserted += batch.length;

        const isLastBatch = inserted === records.length;
        const shouldReportProgress = isLastBatch || (index / batchSize) % 5 === 0;
        if (shouldReportProgress) {
            showMessage(`Importando... ${inserted}/${records.length}`, 'info');
        }
    }

    showMessage(`Importacion completada: ${inserted} registros cargados.`, 'success');
    await refreshTotalesPorMes();
}

function getPrimaryKeyFromData(rowSample = null) {
    if (PRIMARY_KEY && rowSample && Object.prototype.hasOwnProperty.call(rowSample, PRIMARY_KEY)) {
        return PRIMARY_KEY;
    }

    if (rowSample) {
        const candidates = Object.keys(rowSample).filter(key =>
            key === 'id' || key.startsWith('id_') || key.endsWith('_id')
        );
        if (candidates.length > 0) return candidates[0];
    }

    return PRIMARY_KEY || 'id';
}

function getCurrentPrimaryKey() {
    if (currentData.length > 0) {
        return getPrimaryKeyFromData(currentData[0]);
    }
    return PRIMARY_KEY || 'id';
}

async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');

    loadingIndicator.style.display = 'block';
    tableContainer.innerHTML = '';

    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .limit(500);

        if (error) throw error;

        currentData = data || [];

        if (currentData.length > 0) {
            tableColumns = Object.keys(currentData[0]);

            const primaryKey = getCurrentPrimaryKey();
            if (tableColumns.includes(primaryKey)) {
                currentData.sort((a, b) => {
                    const aValue = a[primaryKey];
                    const bValue = b[primaryKey];

                    if (typeof aValue === 'number' && typeof bValue === 'number') {
                        return bValue - aValue;
                    }

                    return String(bValue).localeCompare(String(aValue), 'es', { numeric: true });
                });
            }

            renderTable(currentData);
        } else {
            tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #7f8c8d;">No hay registros en esta tabla</div>';
        }

        loadingIndicator.style.display = 'none';
    } catch (error) {
        handleError(error, 'al cargar datos');
        loadingIndicator.style.display = 'none';
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">Error: ' + error.message + '</div>';
    }
}

function renderTable(data) {
    const tableContainer = document.getElementById('tableContainer');
    const primaryKey = getCurrentPrimaryKey();

    let html = '<table class="data-table"><thead><tr>';

    tableColumns.forEach(col => {
        html += `<th>${formatColumnName(col)}</th>`;
    });
    html += '<th>Acciones</th></tr></thead><tbody>';

    data.forEach(row => {
        html += '<tr>';
        tableColumns.forEach(col => {
            html += `<td>${formatValue(row[col], col)}</td>`;
        });

        const rowId = row[primaryKey] ?? row[tableColumns[0]];
        html += `<td class="actions">
            <button class="btn btn-primary btn-sm" onclick='editRecord(${JSON.stringify(row).replace(/'/g, "&apos;")})'>✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteRecord('${rowId}')">🗑️</button>
        </td></tr>`;
    });

    html += '</tbody></table>';
    tableContainer.innerHTML = html;
}

function formatColumnName(col) {
    return col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatValue(value, columnName) {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? '✓' : '✗';
    if (columnName.includes('fecha') || columnName.includes('date') || columnName.includes('_at')) {
        return formatDateSafeBogota(value);
    }
    if (typeof value === 'object') return JSON.stringify(value).substring(0, 50);
    const str = String(value);
    return str.length > 80 ? str.substring(0, 80) + '...' : str;
}

function formatDateSafeBogota(value) {
    if (value === null || value === undefined || value === '') return '-';

    const directDate = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (directDate) {
        const year = directDate[1];
        const month = directDate[2];
        const day = directDate[3];
        return `${day}/${month}/${year}, 00:00`;
    }

    const parts = getDatePartsInTimeZone(value);
    if (!parts) {
        return formatDate(value);
    }

    const dateObj = new Date(`${parts.isoDate}T00:00:00${BOGOTA_UTC_OFFSET}`);
    const formatted = dateObj.toLocaleDateString('es-ES', {
        timeZone: APP_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    return formatted;
}

function openCreateModal() {
    document.getElementById('modalTitle').textContent = 'Nuevo Registro';
    document.getElementById('dataForm').reset();
    document.getElementById('recordId').value = '';
    generateFormFields();
    document.getElementById('dataModal').classList.add('show');
}

function generateFormFields(record = null) {
    const formFields = document.getElementById('formFields');
    formFields.innerHTML = '';

    const primaryKey = getCurrentPrimaryKey();

    tableColumns.forEach(col => {
        if (col === 'created_at' || col === 'updated_at') return;

        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = formatColumnName(col);
        label.setAttribute('for', col);

        const input = document.createElement('input');
        input.type = 'text';
        input.id = col;
        input.name = col;

        if (!record && col === primaryKey) {
            input.required = true;
        }

        if (record && record[col] !== null && record[col] !== undefined) {
            input.value = record[col];
            if (col === primaryKey) {
                input.disabled = true;
            }
        }

        formGroup.appendChild(label);
        formGroup.appendChild(input);
        formFields.appendChild(formGroup);
    });
}

function editRecord(record) {
    try {
        document.getElementById('modalTitle').textContent = 'Editar Registro';
        const primaryKey = getPrimaryKeyFromData(record);
        document.getElementById('recordId').value = record[primaryKey] ?? '';
        generateFormFields(record);
        document.getElementById('dataModal').classList.add('show');
    } catch (error) {
        handleError(error, 'al cargar registro');
    }
}

async function saveRecord() {
    try {
        const recordId = document.getElementById('recordId').value;
        const formData = {};
        const primaryKey = getCurrentPrimaryKey();

        tableColumns.forEach(col => {
            if (col === 'created_at' || col === 'updated_at') return;

            const input = document.getElementById(col);
            if (!input) return;

            const isPrimaryOnEdit = col === primaryKey && Boolean(recordId);
            if (isPrimaryOnEdit) return;

            formData[col] = input.value === '' ? null : input.value;
        });

        if (recordId) {
            const { error } = await supabase
                .from(TABLE_NAME)
                .update(formData)
                .eq(primaryKey, recordId);
            if (error) throw error;
            showMessage('Registro actualizado', 'success');
        } else {
            const { error } = await supabase
                .from(TABLE_NAME)
                .insert([formData]);
            if (error) throw error;
            showMessage('Registro creado', 'success');
        }

        closeModal();
        loadData();
    } catch (error) {
        handleError(error, 'al guardar');
    }
}

async function deleteRecord(id) {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return;

    try {
        const primaryKey = getCurrentPrimaryKey();
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq(primaryKey, id);

        if (error) throw error;
        showMessage('Registro eliminado', 'success');
        loadData();
    } catch (error) {
        handleError(error, 'al eliminar');
    }
}

function closeModal() {
    document.getElementById('dataModal').classList.remove('show');
}

function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function normalizeCiclo(value) {
    if (value === null || value === undefined) return '';
    const raw = String(value).trim();
    if (!raw) return '';

    const onlyDigits = raw.match(/^0*(\d+)$/);
    if (onlyDigits) {
        return String(Number(onlyDigits[1]));
    }

    const embeddedDigits = raw.match(/(\d{1,3})/);
    if (embeddedDigits) {
        return String(Number(embeddedDigits[1]));
    }

    return raw.toUpperCase();
}

function convertMesToNumber(value) {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number' && value >= 1 && value <= 12) {
        return Math.trunc(value);
    }

    const textValue = normalizeText(value);
    const numericCandidate = Number(textValue);
    if (!Number.isNaN(numericCandidate) && numericCandidate >= 1 && numericCandidate <= 12) {
        return Math.trunc(numericCandidate);
    }

    const monthMap = {
        enero: 1,
        febrero: 2,
        marzo: 3,
        abril: 4,
        mayo: 5,
        junio: 6,
        julio: 7,
        agosto: 8,
        septiembre: 9,
        setiembre: 9,
        octubre: 10,
        noviembre: 11,
        diciembre: 12
    };

    if (monthMap[textValue]) {
        return monthMap[textValue];
    }

    for (const [monthName, monthNumber] of Object.entries(monthMap)) {
        if (textValue.includes(monthName)) {
            return monthNumber;
        }
    }

    return null;
}

function buildJoinKey(ciclo, mes) {
    const cicloValue = normalizeCiclo(ciclo);
    const mesNumber = convertMesToNumber(mes);
    if (!cicloValue || !mesNumber) return null;
    return `${cicloValue}|${mesNumber}`;
}

function detectPrimaryKeyFromRows(rows) {
    if (!rows || rows.length === 0) {
        return PRIMARY_KEY || 'id';
    }
    return getPrimaryKeyFromData(rows[0]);
}

async function resolveOrdenesTable() {
    const candidates = [TABLE_NAME, 'ordenes_lectura'];

    for (const tableName of candidates) {
        const { error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

        if (!error) {
            return tableName;
        }
    }

    return null;
}

async function resolveCalendarioTable() {
    const candidates = ['calendario_ciclo_unpivoted', 'calendario_ciclos_unpivoted'];

    for (const tableName of candidates) {
        const { error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

        if (!error) {
            return tableName;
        }
    }

    return null;
}

function detectColumnName(rows, patterns, fallback = '') {
    if (!rows || rows.length === 0) return fallback;

    const keys = Object.keys(rows[0]);
    const normalized = keys.map(key => ({
        original: key,
        normalized: normalizeText(key)
    }));

    for (const pattern of patterns) {
        const found = normalized.find(item => pattern.test(item.normalized));
        if (found) return found.original;
    }

    return fallback;
}

function getMesFromRow(row, mesColumn, fechaColumn) {
    if (mesColumn) {
        const mes = convertMesToNumber(row[mesColumn]);
        if (mes) return mes;
    }

    if (fechaColumn && row[fechaColumn]) {
        const dateParts = getDatePartsInTimeZone(row[fechaColumn]);
        if (dateParts) {
            return dateParts.month;
        }
    }

    return null;
}

function sameDateValue(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;

    const aParts = getDatePartsInTimeZone(a);
    const bParts = getDatePartsInTimeZone(b);

    if (aParts && bParts) {
        return aParts.isoDate === bParts.isoDate;
    }

    return String(a).slice(0, 10) === String(b).slice(0, 10);
}

function getDatePartsInTimeZone(value, timeZone = APP_TIME_ZONE) {
    if (value === null || value === undefined || value === '') return null;

    const asString = String(value).trim();
    if (!asString) return null;

    const dateOnlyMatch = asString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
        const year = Number(dateOnlyMatch[1]);
        const month = Number(dateOnlyMatch[2]);
        const day = Number(dateOnlyMatch[3]);
        return {
            year,
            month,
            day,
            isoDate: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        };
    }

    const parsed = new Date(asString);
    if (Number.isNaN(parsed.getTime())) return null;

    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parts = formatter.formatToParts(parsed);
    const year = Number(parts.find(part => part.type === 'year')?.value);
    const month = Number(parts.find(part => part.type === 'month')?.value);
    const day = Number(parts.find(part => part.type === 'day')?.value);

    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;

    return {
        year,
        month,
        day,
        isoDate: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    };
}

function normalizeDateForStorage(value) {
    const parts = getDatePartsInTimeZone(value);
    if (parts) {
        return `${parts.isoDate}T00:00:00${BOGOTA_UTC_OFFSET}`;
    }
    return value;
}

function updateSyncProgress(percent, detailText) {
    const progressBar = document.getElementById('syncProgressBar');
    const progressText = document.getElementById('syncProgressText');
    const progressDetails = document.getElementById('syncProgressDetails');

    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    if (progressBar) {
        progressBar.style.width = `${safePercent.toFixed(1)}%`;
    }
    if (progressText) {
        progressText.textContent = `${safePercent.toFixed(1)}%`;
    }
    if (progressDetails && detailText) {
        progressDetails.textContent = detailText;
    }
}

function getMonthLabelUpper(monthNumber) {
    const monthNames = [
        'ENERO',
        'FEBRERO',
        'MARZO',
        'ABRIL',
        'MAYO',
        'JUNIO',
        'JULIO',
        'AGOSTO',
        'SEPTIEMBRE',
        'OCTUBRE',
        'NOVIEMBRE',
        'DICIEMBRE'
    ];
    return monthNames[monthNumber - 1] || `MES ${monthNumber}`;
}

function monthNumberToOptionLabel(monthNumber) {
    const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return names[monthNumber - 1] || `Mes ${monthNumber}`;
}

function enableMonthSelectorClickToggle() {
    const selector = document.getElementById('totalesMesSelector');
    if (!selector || selector.dataset.toggleEnabled === '1') return;

    selector.dataset.toggleEnabled = '1';

    selector.addEventListener('mousedown', function(event) {
        const option = event.target;
        if (!option || option.tagName !== 'OPTION') return;

        event.preventDefault();

        if (option.value === '') {
            Array.from(selector.options).forEach(currentOption => {
                currentOption.selected = currentOption.value === '';
            });
        } else {
            option.selected = !option.selected;
            if (selector.options.length > 0) {
                selector.options[0].selected = false;
            }

            const selectedMonths = getSelectedMonthNumbers();
            if (selectedMonths.length === 0 && selector.options.length > 0) {
                selector.options[0].selected = true;
            }
        }

        selector.focus();
        selector.dispatchEvent(new Event('change'));
    });
}

function getSelectedMonthNumbers() {
    const selector = document.getElementById('totalesMesSelector');
    if (!selector) return [];

    const values = Array.from(selector.selectedOptions)
        .map(option => option.value)
        .filter(value => value !== '')
        .map(value => Number(value))
        .filter(value => Number.isInteger(value) && value >= 1 && value <= 12);

    return Array.from(new Set(values));
}

function populateTotalesMesSelector(monthNumbers) {
    const selector = document.getElementById('totalesMesSelector');
    if (!selector) return;

    const previousValues = getSelectedMonthNumbers();
    selector.innerHTML = '<option value="">Todos</option>';

    monthNumbers.forEach(monthNumber => {
        const option = document.createElement('option');
        option.value = String(monthNumber);
        option.textContent = monthNumberToOptionLabel(monthNumber);
        if (previousValues.includes(monthNumber)) {
            option.selected = true;
        }
        selector.appendChild(option);
    });

    if (previousValues.length === 0) {
        selector.options[0].selected = true;
    } else {
        selector.options[0].selected = false;
    }
}

function sortCycleValuesForPivot(cycles) {
    return cycles.sort((a, b) => {
        const aNormalized = normalizeCiclo(a);
        const bNormalized = normalizeCiclo(b);
        const aNumber = Number(aNormalized);
        const bNumber = Number(bNormalized);
        const aIsNumber = !Number.isNaN(aNumber);
        const bIsNumber = !Number.isNaN(bNumber);

        if (aIsNumber && bIsNumber) {
            const aRank = aNumber >= 14 ? aNumber : aNumber + 1000;
            const bRank = bNumber >= 14 ? bNumber : bNumber + 1000;
            return aRank - bRank;
        }
        return String(aNormalized).localeCompare(String(bNormalized), 'es', { numeric: true });
    });
}

function updateTotalesInfo(message, type = 'info') {
    updatePivotInfo('totalesMesInfo', message, type);
}

function updateNumeroOrdenesInfo(message, type = 'info') {
    updatePivotInfo('numeroOrdenesInfo', message, type);
}

function updateResumenMensualInfo(message, type = 'info') {
    updatePivotInfo('resumenMensualInfo', message, type);
}

function updatePivotInfo(elementId, message, type = 'info') {
    const info = document.getElementById(elementId);
    if (!info) return;

    if (type === 'error') {
        info.style.color = '#fca5a5';
    } else if (type === 'success') {
        info.style.color = '#86efac';
    } else {
        info.style.color = '#cbd5e1';
    }

    info.textContent = message;
}

function renderTotalesPivot(rows) {
    const container = document.getElementById('totalesMesContainer');
    if (!container) return;

    if (!rows || rows.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:16px; color:#94a3b8;">No hay registros para calcular totales.</div>';
        updateTotalesInfo('Sin datos en la tabla de órdenes.');
        return;
    }

    const cicloColumn = detectColumnName(rows, [/^ciclo$/, /cod.*ciclo/, /ciclo/]);
    const fechaEjecucionColumn = detectColumnName(rows, [/^fecha_ejecucion$/, /fecha.*ejecucion/, /ejecucion.*fecha/]);

    if (!cicloColumn || !fechaEjecucionColumn) {
        container.innerHTML = '<div style="text-align:center; padding:16px; color:#fca5a5;">No se detectaron columnas ciclo y fecha_ejecucion.</div>';
        updateTotalesInfo('No fue posible detectar columnas para el pivote.', 'error');
        return;
    }

    const monthMap = new Map();
    const cycleSet = new Set();
    const tableMap = new Map();
    const availableMonthNumbers = new Set();

    const selectedMonthNumbers = getSelectedMonthNumbers();

    let blankMonthTotal = 0;
    let blankCycleTotal = 0;

    rows.forEach(row => {
        const rawCiclo = row[cicloColumn];
        const ciclo = normalizeCiclo(rawCiclo) || '(en blanco)';

        const dateParts = getDatePartsInTimeZone(row[fechaEjecucionColumn]);
        const monthNumber = dateParts ? dateParts.month : null;
        if (monthNumber) {
            availableMonthNumbers.add(monthNumber);
        }

        if (selectedMonthNumbers.length > 0 && !selectedMonthNumbers.includes(monthNumber)) {
            return;
        }

        const monthKey = monthNumber ? `${String(monthNumber).padStart(2, '0')}` : '(en blanco)';

        if (monthKey !== '(en blanco)') {
            monthMap.set(monthKey, getMonthLabelUpper(monthNumber));
        } else {
            blankMonthTotal += 1;
            return;
        }

        if (ciclo === '(en blanco)') {
            blankCycleTotal += 1;
        }

        cycleSet.add(ciclo);

        const key = `${ciclo}|${monthKey}`;
        tableMap.set(key, (tableMap.get(key) || 0) + 1);
    });

    populateTotalesMesSelector(Array.from(availableMonthNumbers).sort((a, b) => a - b));

    const monthKeys = Array.from(monthMap.keys()).sort((a, b) => Number(a) - Number(b));
    const allMonthKeys = [...monthKeys];

    if (allMonthKeys.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:16px; color:#94a3b8;">No hay meses válidos para mostrar en el pivote.</div>';
        updateTotalesInfo('No hay meses válidos; revisa fecha_ejecucion.', 'info');
        return;
    }

    const cycles = sortCycleValuesForPivot(Array.from(cycleSet).filter(value => value !== '(en blanco)'));
    if (cycleSet.has('(en blanco)')) {
        cycles.push('(en blanco)');
    }

    const columnTotals = new Map();
    allMonthKeys.forEach(key => columnTotals.set(key, 0));

    let html = '<table class="data-table compact-table"><thead><tr>';
    html += '<th>Ciclo</th>';
    allMonthKeys.forEach(monthKey => {
        const label = monthKey === '(en blanco)' ? '(en blanco)' : monthMap.get(monthKey);
        html += `<th>${label}</th>`;
    });
    html += '<th>Total general</th></tr></thead><tbody>';

    let grandTotal = 0;

    cycles.forEach(ciclo => {
        let rowTotal = 0;
        html += `<tr><td>${ciclo}</td>`;

        allMonthKeys.forEach(monthKey => {
            const value = tableMap.get(`${ciclo}|${monthKey}`) || 0;
            rowTotal += value;
            columnTotals.set(monthKey, (columnTotals.get(monthKey) || 0) + value);
            html += `<td>${value}</td>`;
        });

        grandTotal += rowTotal;
        html += `<td>${rowTotal}</td></tr>`;
    });

    html += '<tr style="font-weight:700;"><td>Total general</td>';
    allMonthKeys.forEach(monthKey => {
        html += `<td>${columnTotals.get(monthKey) || 0}</td>`;
    });
    html += `<td>${grandTotal}</td></tr>`;
    html += '</tbody></table>';

    container.innerHTML = html;
    updateTotalesInfo(
        `Registros analizados: ${rows.length}. Ciclos: ${cycles.length}. Meses con datos: ${monthKeys.length}. Sin mes: ${blankMonthTotal}. Sin ciclo: ${blankCycleTotal}.`,
        'success'
    );
}

function parseNumericValue(value) {
    if (value === null || value === undefined || value === '') return 0;

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    const normalized = String(value)
        .trim()
        .replace(/\s+/g, '')
        .replace(/\./g, '')
        .replace(/,/g, '.');

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatCompactNumber(value) {
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(value);
}

function formatPercentValue(value) {
    return `${new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
}

function destroyTotalOrdenesChart() {
    if (totalOrdenesChartInstance) {
        totalOrdenesChartInstance.destroy();
        totalOrdenesChartInstance = null;
    }
}

function renderTotalOrdenesChart(periods) {
    const canvas = document.getElementById('totalOrdenesChart');
    const panel = document.getElementById('totalOrdenesChartPanel');

    if (!canvas || !panel) return;

    if (typeof Chart === 'undefined') {
        panel.innerHTML = '<div style="color:#fee2e2; text-align:center; padding-top:2rem;">No se pudo cargar el gráfico (Chart.js no disponible).</div>';
        return;
    }

    if (!periods || periods.length === 0) {
        destroyTotalOrdenesChart();
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        return;
    }

    const labels = periods.map(period => getMonthLabelUpper(period.month));
    const totals = periods.map(period => period.energia + period.gas + period.agua);

    destroyTotalOrdenesChart();

    totalOrdenesChartInstance = new Chart(canvas, {
        type: 'line',
        plugins: [totalOrdenesPointLabelsPlugin],
        data: {
            labels,
            datasets: [
                {
                    label: 'Total órdenes',
                    data: totals,
                    borderColor: '#dbeafe',
                    backgroundColor: 'rgba(219, 234, 254, 0.2)',
                    borderWidth: 3,
                    pointRadius: 3,
                    pointHoverRadius: 4,
                    pointBackgroundColor: '#f8fafc',
                    pointBorderColor: '#bfdbfe',
                    pointBorderWidth: 1,
                    fill: false,
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'TOTAL ORDENES',
                    color: '#ffffff',
                    font: {
                        size: 22,
                        weight: '700'
                    },
                    padding: {
                        top: 0,
                        bottom: 12
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Total: ${formatCompactNumber(context.parsed.y || 0)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#ffffff',
                        font: {
                            weight: '600'
                        }
                    },
                    border: {
                        color: 'rgba(255,255,255,0.2)'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.25)'
                    },
                    ticks: {
                        color: '#ffffff',
                        callback: function(value) {
                            return Number(value).toFixed(0);
                        }
                    },
                    border: {
                        color: 'rgba(255,255,255,0.2)'
                    }
                }
            }
        }
    });
}

function renderNumeroOrdenesPivot(rows) {
    const container = document.getElementById('numeroOrdenesContainer');
    if (!container) return;

    if (!rows || rows.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:16px; color:#94a3b8;">No hay registros para calcular número de órdenes.</div>';
        updateNumeroOrdenesInfo('Sin datos en la tabla de órdenes.');
        return;
    }

    const cicloColumn = detectColumnName(rows, [/^ciclo$/, /cod.*ciclo/, /ciclo/]);
    const fechaEjecucionColumn = detectColumnName(rows, [/^fecha_ejecucion$/, /fecha.*ejecucion/, /ejecucion.*fecha/]);
    const numeroOrdenesColumn = detectColumnName(rows, [/^num_ordenes_sin_asignar$/, /num.*ordenes.*sin.*asignar/, /ordenes.*sin.*asignar/]);

    if (!cicloColumn || !fechaEjecucionColumn || !numeroOrdenesColumn) {
        container.innerHTML = '<div style="text-align:center; padding:16px; color:#fca5a5;">No se detectaron columnas ciclo, fecha_ejecucion y num_ordenes_sin_asignar.</div>';
        updateNumeroOrdenesInfo('No fue posible detectar columnas para el pivote de número de órdenes.', 'error');
        return;
    }

    const monthMap = new Map();
    const cycleSet = new Set();
    const tableMap = new Map();

    const selectedMonthNumbers = getSelectedMonthNumbers();

    let blankMonthTotal = 0;
    let blankCycleTotal = 0;

    rows.forEach(row => {
        const rawCiclo = row[cicloColumn];
        const ciclo = normalizeCiclo(rawCiclo) || '(en blanco)';

        const dateParts = getDatePartsInTimeZone(row[fechaEjecucionColumn]);
        const monthNumber = dateParts ? dateParts.month : null;

        if (selectedMonthNumbers.length > 0 && !selectedMonthNumbers.includes(monthNumber)) {
            return;
        }

        const monthKey = monthNumber ? `${String(monthNumber).padStart(2, '0')}` : '(en blanco)';

        if (monthKey !== '(en blanco)') {
            monthMap.set(monthKey, getMonthLabelUpper(monthNumber));
        } else {
            blankMonthTotal += 1;
            return;
        }

        if (ciclo === '(en blanco)') {
            blankCycleTotal += 1;
        }

        cycleSet.add(ciclo);

        const valueToAdd = parseNumericValue(row[numeroOrdenesColumn]);
        const key = `${ciclo}|${monthKey}`;
        tableMap.set(key, (tableMap.get(key) || 0) + valueToAdd);
    });

    const monthKeys = Array.from(monthMap.keys()).sort((a, b) => Number(a) - Number(b));
    const allMonthKeys = [...monthKeys];

    if (allMonthKeys.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:16px; color:#94a3b8;">No hay meses válidos para mostrar en el pivote.</div>';
        updateNumeroOrdenesInfo('No hay meses válidos; revisa fecha_ejecucion.', 'info');
        return;
    }

    const cycles = sortCycleValuesForPivot(Array.from(cycleSet).filter(value => value !== '(en blanco)'));
    if (cycleSet.has('(en blanco)')) {
        cycles.push('(en blanco)');
    }

    const columnTotals = new Map();
    allMonthKeys.forEach(key => columnTotals.set(key, 0));

    let html = '<table class="data-table compact-table"><thead><tr>';
    html += '<th>Ciclo</th>';
    allMonthKeys.forEach(monthKey => {
        const label = monthKey === '(en blanco)' ? '(en blanco)' : monthMap.get(monthKey);
        html += `<th>${label}</th>`;
    });
    html += '<th>Total general</th></tr></thead><tbody>';

    let grandTotal = 0;

    cycles.forEach(ciclo => {
        let rowTotal = 0;
        html += `<tr><td>${ciclo}</td>`;

        allMonthKeys.forEach(monthKey => {
            const value = tableMap.get(`${ciclo}|${monthKey}`) || 0;
            rowTotal += value;
            columnTotals.set(monthKey, (columnTotals.get(monthKey) || 0) + value);
            html += `<td>${formatCompactNumber(value)}</td>`;
        });

        grandTotal += rowTotal;
        html += `<td>${formatCompactNumber(rowTotal)}</td></tr>`;
    });

    html += '<tr style="font-weight:700;"><td>Total general</td>';
    allMonthKeys.forEach(monthKey => {
        html += `<td>${formatCompactNumber(columnTotals.get(monthKey) || 0)}</td>`;
    });
    html += `<td>${formatCompactNumber(grandTotal)}</td></tr>`;
    html += '</tbody></table>';

    container.innerHTML = html;
    updateNumeroOrdenesInfo(
        `Registros analizados: ${rows.length}. Ciclos: ${cycles.length}. Meses con datos: ${monthKeys.length}. Sin mes: ${blankMonthTotal}. Sin ciclo: ${blankCycleTotal}.`,
        'success'
    );
}

function renderResumenMensualPorServicio(rows) {
    const container = document.getElementById('resumenMensualContainer');
    if (!container) return;

    if (!rows || rows.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:16px; color:#94a3b8;">No hay registros para calcular el resumen mensual.</div>';
        updateResumenMensualInfo('Sin datos en la tabla de órdenes.');
        renderTotalOrdenesChart([]);
        return;
    }

    const fechaEjecucionColumn = detectColumnName(rows, [/^fecha_ejecucion$/, /fecha.*ejecucion/, /ejecucion.*fecha/]);
    const energiaColumn = detectColumnName(rows, [/^num_ordenes_energia$/, /num.*ordenes.*energia/, /ordenes.*energia/]);
    const gasColumn = detectColumnName(rows, [/^num_ordenes_gas$/, /num.*ordenes.*gas/, /ordenes.*gas/]);
    const aguaColumn = detectColumnName(rows, [/^num_ordenes_agua$/, /num.*ordenes.*agua/, /ordenes.*agua/]);

    if (!fechaEjecucionColumn || !energiaColumn || !gasColumn || !aguaColumn) {
        container.innerHTML = '<div style="text-align:center; padding:16px; color:#fca5a5;">No se detectaron las columnas fecha_ejecucion, num_ordenes_energia, num_ordenes_gas y num_ordenes_agua.</div>';
        updateResumenMensualInfo('No fue posible detectar columnas para el resumen mensual.', 'error');
        renderTotalOrdenesChart([]);
        return;
    }

    const grouped = new Map();
    let invalidDateRows = 0;
    const selectedMonthNumbers = getSelectedMonthNumbers();

    rows.forEach(row => {
        const dateParts = getDatePartsInTimeZone(row[fechaEjecucionColumn]);
        if (!dateParts) {
            invalidDateRows += 1;
            return;
        }

        if (selectedMonthNumbers.length > 0 && !selectedMonthNumbers.includes(dateParts.month)) {
            return;
        }

        const periodKey = `${dateParts.year}-${String(dateParts.month).padStart(2, '0')}`;
        if (!grouped.has(periodKey)) {
            grouped.set(periodKey, {
                year: dateParts.year,
                month: dateParts.month,
                energia: 0,
                gas: 0,
                agua: 0
            });
        }

        const current = grouped.get(periodKey);
        current.energia += parseNumericValue(row[energiaColumn]);
        current.gas += parseNumericValue(row[gasColumn]);
        current.agua += parseNumericValue(row[aguaColumn]);
    });

    const periods = Array.from(grouped.values()).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });

    if (periods.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:16px; color:#94a3b8;">No hay meses operativos válidos para mostrar.</div>';
        updateResumenMensualInfo('No hay meses válidos; revisa fecha_ejecucion.', 'info');
        renderTotalOrdenesChart([]);
        return;
    }

    let html = '<table class="data-table compact-table"><thead><tr>';
    html += '<th>Año</th>';
    html += '<th>Mes</th>';
    html += '<th>Energía</th>';
    html += '<th>Gas</th>';
    html += '<th>Agua</th>';
    html += '<th>Total</th>';
    html += '<th>Dif</th>';
    html += '<th>% total</th>';
    html += '<th>% Energía</th>';
    html += '<th>% Gas</th>';
    html += '<th>% Agua</th>';
    html += '<th>Dif Energía</th>';
    html += '<th>Dif Gas</th>';
    html += '<th>Dif Agua</th>';
    html += '</tr></thead><tbody>';

    let previousTotal = null;
    let previousEnergia = null;
    let previousGas = null;
    let previousAgua = null;

    let totalEnergia = 0;
    let totalGas = 0;
    let totalAgua = 0;
    let totalGeneral = 0;
    let totalDif = 0;
    let totalDifEnergia = 0;
    let totalDifGas = 0;
    let totalDifAgua = 0;
    let totalBaseForPct = 0;

    periods.forEach(period => {
        const energia = period.energia;
        const gas = period.gas;
        const agua = period.agua;
        const total = energia + gas + agua;

        const dif = previousTotal === null ? 0 : total - previousTotal;
        const difEnergia = previousEnergia === null ? 0 : energia - previousEnergia;
        const difGas = previousGas === null ? 0 : gas - previousGas;
        const difAgua = previousAgua === null ? 0 : agua - previousAgua;

        const pctTotal = previousTotal && previousTotal !== 0 ? (dif / previousTotal) * 100 : 0;
        const pctEnergia = total !== 0 ? (energia / total) * 100 : 0;
        const pctGas = total !== 0 ? (gas / total) * 100 : 0;
        const pctAgua = total !== 0 ? (agua / total) * 100 : 0;

        totalEnergia += energia;
        totalGas += gas;
        totalAgua += agua;
        totalGeneral += total;
        totalDif += dif;
        totalDifEnergia += difEnergia;
        totalDifGas += difGas;
        totalDifAgua += difAgua;
        totalBaseForPct += total - dif;

        html += '<tr>';
        html += `<td>${period.year}</td>`;
        html += `<td>${getMonthLabelUpper(period.month)}</td>`;
        html += `<td>${formatCompactNumber(energia)}</td>`;
        html += `<td>${formatCompactNumber(gas)}</td>`;
        html += `<td>${formatCompactNumber(agua)}</td>`;
        html += `<td style="font-weight:700;">${formatCompactNumber(total)}</td>`;
        html += `<td>${formatCompactNumber(dif)}</td>`;
        html += `<td>${formatPercentValue(pctTotal)}</td>`;
        html += `<td>${formatPercentValue(pctEnergia)}</td>`;
        html += `<td>${formatPercentValue(pctGas)}</td>`;
        html += `<td>${formatPercentValue(pctAgua)}</td>`;
        html += `<td>${formatCompactNumber(difEnergia)}</td>`;
        html += `<td>${formatCompactNumber(difGas)}</td>`;
        html += `<td>${formatCompactNumber(difAgua)}</td>`;
        html += '</tr>';

        previousTotal = total;
        previousEnergia = energia;
        previousGas = gas;
        previousAgua = agua;
    });

    const globalPctTotal = totalBaseForPct !== 0 ? (totalDif / totalBaseForPct) * 100 : 0;
    const globalPctEnergia = totalGeneral !== 0 ? (totalEnergia / totalGeneral) * 100 : 0;
    const globalPctGas = totalGeneral !== 0 ? (totalGas / totalGeneral) * 100 : 0;
    const globalPctAgua = totalGeneral !== 0 ? (totalAgua / totalGeneral) * 100 : 0;

    html += '<tr style="font-weight:700;">';
    html += '<td colspan="2">Total general</td>';
    html += `<td>${formatCompactNumber(totalEnergia)}</td>`;
    html += `<td>${formatCompactNumber(totalGas)}</td>`;
    html += `<td>${formatCompactNumber(totalAgua)}</td>`;
    html += `<td>${formatCompactNumber(totalGeneral)}</td>`;
    html += `<td>${formatCompactNumber(totalDif)}</td>`;
    html += `<td>${formatPercentValue(globalPctTotal)}</td>`;
    html += `<td>${formatPercentValue(globalPctEnergia)}</td>`;
    html += `<td>${formatPercentValue(globalPctGas)}</td>`;
    html += `<td>${formatPercentValue(globalPctAgua)}</td>`;
    html += `<td>${formatCompactNumber(totalDifEnergia)}</td>`;
    html += `<td>${formatCompactNumber(totalDifGas)}</td>`;
    html += `<td>${formatCompactNumber(totalDifAgua)}</td>`;
    html += '</tr>';

    html += '</tbody></table>';
    container.innerHTML = html;
    renderTotalOrdenesChart(periods);

    updateResumenMensualInfo(
        `Meses operativos: ${periods.length}. Registros analizados: ${rows.length}. Fechas inválidas: ${invalidDateRows}.`,
        'success'
    );
}

async function refreshTotalesPorMes() {
    const container = document.getElementById('totalesMesContainer');
    if (container) {
        container.innerHTML = '<div style="text-align:center; padding:16px; color:#94a3b8;">Calculando totales por mes...</div>';
    }
    const numeroOrdenesContainer = document.getElementById('numeroOrdenesContainer');
    if (numeroOrdenesContainer) {
        numeroOrdenesContainer.innerHTML = '<div style="text-align:center; padding:16px; color:#94a3b8;">Calculando número de órdenes...</div>';
    }
    const resumenMensualContainer = document.getElementById('resumenMensualContainer');
    if (resumenMensualContainer) {
        resumenMensualContainer.innerHTML = '<div style="text-align:center; padding:16px; color:#94a3b8;">Calculando resumen mensual...</div>';
    }
    updateTotalesInfo('Consultando datos en Supabase...');
    updateNumeroOrdenesInfo('Consultando datos en Supabase...');
    updateResumenMensualInfo('Consultando datos en Supabase...');

    try {
        const rows = await fetchAllRowsFromTable(TABLE_NAME, 1000);
        renderTotalesPivot(rows);
        renderNumeroOrdenesPivot(rows);
        renderResumenMensualPorServicio(rows);
    } catch (error) {
        if (container) {
            container.innerHTML = `<div style="text-align:center; padding:16px; color:#fca5a5;">Error al calcular totales: ${error.message}</div>`;
        }
        if (numeroOrdenesContainer) {
            numeroOrdenesContainer.innerHTML = `<div style="text-align:center; padding:16px; color:#fca5a5;">Error al calcular número de órdenes: ${error.message}</div>`;
        }
        if (resumenMensualContainer) {
            resumenMensualContainer.innerHTML = `<div style="text-align:center; padding:16px; color:#fca5a5;">Error al calcular resumen mensual: ${error.message}</div>`;
        }
        updateTotalesInfo('Error al calcular totales por mes.', 'error');
        updateNumeroOrdenesInfo('Error al calcular número de órdenes.', 'error');
        updateResumenMensualInfo('Error al calcular resumen mensual.', 'error');
    }
}

function getSelectedMonthsLabelForExport() {
    const selectedMonths = getSelectedMonthNumbers();
    if (selectedMonths.length === 0) {
        return 'Todos los meses';
    }
    return selectedMonths
        .sort((a, b) => a - b)
        .map(monthNumber => getMonthLabelUpper(monthNumber))
        .join(' · ');
}

function setExportButtonState(isLoading, label = '🖼️ Exportar imágenes') {
    const button = document.getElementById('exportGerencialBtn');
    if (!button) return;
    button.disabled = isLoading;
    button.textContent = label;
}

function getExportPanels() {
    const tableCorrerias = document.getElementById('cardTotalesCorrerias');
    const tableOrdenes = document.getElementById('cardNumeroOrdenes');
    const tableServicios = document.getElementById('cardResumenServicio');
    const chartTotalOrdenes = document.getElementById('cardGraficaTotal');

    return [
        {
            title: 'RUTAS DE LECTURA',
            subtitle: 'Totales de correrías por ciclo',
            element: tableCorrerias
        },
        {
            title: 'CANTIDAD DE ÓRDENES',
            subtitle: 'Suma de órdenes sin asignar por ciclo',
            element: tableOrdenes
        },
        {
            title: 'GESTIÓN ODS',
            subtitle: 'Totales y variaciones por servicio',
            element: tableServicios
        },
        {
            title: 'GESTIÓN ODS',
            subtitle: 'Tendencia del total de órdenes',
            element: chartTotalOrdenes
        }
    ];
}

async function captureElementAsImageData(element) {
    if (!element) return null;

    const captureWidth = Math.max(element.scrollWidth || 0, element.clientWidth || 0, element.offsetWidth || 0);
    const captureHeight = Math.max(element.scrollHeight || 0, element.clientHeight || 0, element.offsetHeight || 0);

    const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        width: captureWidth,
        height: captureHeight,
        windowWidth: captureWidth,
        windowHeight: captureHeight
    });

    return {
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height
    };
}

function forceCorporateExportTheme(enable) {
    document.body.classList.toggle('corporate-export-theme', enable);
}

function downloadDataUrlAsFile(dataUrl, fileName) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function waitForNextFrame() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function exportarImagenesGerenciales() {
    if (typeof html2canvas === 'undefined') {
        if (typeof showMessage === 'function') {
            showMessage('No se pudo cargar la librería de exportación', 'error');
        } else {
            alert('No se pudo cargar la librería de exportación');
        }
        return;
    }

    const panels = getExportPanels();
    const missingPanel = panels.find(panel => !panel.element);

    if (missingPanel) {
        if (typeof showMessage === 'function') {
            showMessage('Primero calcula las tablas/gráfica antes de exportar', 'warning');
        } else {
            alert('Primero calcula las tablas/gráfica antes de exportar');
        }
        return;
    }

    const monthLabel = getSelectedMonthsLabelForExport();
    setExportButtonState(true, '⏳ Preparando imágenes...');

    try {
        forceCorporateExportTheme(true);
        await waitForNextFrame();

        for (let index = 0; index < panels.length; index += 1) {
            const panel = panels[index];
            setExportButtonState(true, `⏳ Exportando ${index + 1}/4...`);

            const imageData = await captureElementAsImageData(panel.element);
            if (!imageData) continue;

            const normalizedTitle = panel.title
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, '_')
                .toLowerCase();

            const stamp = new Date();
            const datePart = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, '0')}${String(stamp.getDate()).padStart(2, '0')}`;
            const monthPart = monthLabel
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .toLowerCase();

            const fileName = `gerencial_${normalizedTitle}_${monthPart || 'todos'}_${datePart}.png`;
            downloadDataUrlAsFile(imageData.dataUrl, fileName);

            await new Promise(resolve => setTimeout(resolve, 180));
        }

        if (typeof showMessage === 'function') {
            showMessage('Imágenes exportadas correctamente (4 archivos PNG)', 'success');
        }
    } catch (error) {
        if (typeof showMessage === 'function') {
            showMessage(`Error al exportar: ${error.message}`, 'error');
        } else {
            alert(`Error al exportar: ${error.message}`);
        }
    } finally {
        forceCorporateExportTheme(false);
        setExportButtonState(false, '🖼️ Exportar imágenes');
    }
}

async function updateByCycleAndMes({ targetTable, cicloColumn, cicloValue, mesColumn, mesValue, fechaEjecucion }) {
    if (!cicloColumn || cicloValue === null || cicloValue === undefined) {
        return 0;
    }

    let query = supabase
        .from(targetTable)
        .update({ fecha_ejecucion: fechaEjecucion })
        .eq(cicloColumn, cicloValue);

    if (mesColumn && mesValue !== null && mesValue !== undefined) {
        query = query.eq(mesColumn, mesValue);
    }

    const { data, error } = await query.select('*');
    if (error) throw error;
    return Array.isArray(data) ? data.length : 0;
}

function shouldFallbackToLocalSync(error) {
    const message = normalizeText(error?.message || '');
    if (!message) return false;

    return (
        message.includes('failed to send a request') ||
        message.includes('failed to fetch') ||
        message.includes('non-2xx status code') ||
        message.includes('function not found') ||
        message.includes('edge function returned a non-2xx')
    );
}

async function sincronizarFechaEjecucionViaEdge({ targetTable, calendarioTable }) {
    const { data, error } = await supabase.functions.invoke('sync-fecha-ejecucion-ordenes', {
        body: {
            targetTable,
            calendarioTable
        }
    });

    if (error) {
        throw new Error(error.message || 'Error invocando sync-fecha-ejecucion-ordenes');
    }

    if (data?.error) {
        throw new Error(data.error);
    }

    return data || {};
}

async function sincronizarFechaEjecucion() {
    try {
        updateSyncProgress(2, 'Validando tablas y preparando sincronizacion...');

        const targetTable = await resolveOrdenesTable();
        if (!targetTable) {
            updateSyncProgress(0, 'No existe la tabla de ordenes para sincronizar.');
            showMessage('No existe la tabla de ordenes para sincronizar', 'error');
            return;
        }

        const calendarioTable = await resolveCalendarioTable();
        if (!calendarioTable) {
            updateSyncProgress(0, 'No existe la tabla de calendario para sincronizar.');
            showMessage('No existe la tabla calendario_ciclos_unpivoted', 'error');
            return;
        }

        updateSyncProgress(15, 'Ejecutando sincronizacion en servidor...');

        try {
            const result = await sincronizarFechaEjecucionViaEdge({ targetTable, calendarioTable });
            const affectedRows = Number(result.updatedRows || 0);
            const pendingRows = Number(result.pendingRows || 0);

            if (affectedRows === 0) {
                updateSyncProgress(100, `Sin cambios en ${targetTable}. Pendientes detectados: ${pendingRows}.`);
                showMessage(`No hubo cambios nuevos para aplicar en ${targetTable}`, 'info');
            } else {
                updateSyncProgress(100, `Finalizado: ${affectedRows} filas actualizadas en ${targetTable}.`);
                showMessage(`Fecha ejecucion recalculada: ${affectedRows} filas afectadas en ${targetTable}`, 'success');
            }

            await refreshTotalesPorMes();
            return;
        } catch (edgeError) {
            if (!shouldFallbackToLocalSync(edgeError)) {
                throw edgeError;
            }

            updateSyncProgress(24, 'No se pudo usar la funcion Edge. Ejecutando sincronizacion local...');
            showMessage('La funcion Edge no esta disponible. Se ejecutara sincronizacion local.', 'warning');
        }

        await sincronizarFechaEjecucionLocal({ targetTable, calendarioTable });
        await refreshTotalesPorMes();
    } catch (error) {
        updateSyncProgress(100, `Error: ${error.message}`);
        handleError(error, 'al sincronizar fecha_ejecucion');
    }
}

async function sincronizarFechaEjecucionLocal({ targetTable: providedTargetTable = null, calendarioTable: providedCalendarioTable = null } = {}) {
    const targetTable = providedTargetTable || await resolveOrdenesTable();
    const calendarioTable = providedCalendarioTable || await resolveCalendarioTable();

    if (!targetTable) {
        updateSyncProgress(0, 'No existe la tabla de ordenes para sincronizar.');
        showMessage('No existe la tabla de ordenes para sincronizar', 'error');
        return { updatedRows: 0, pendingRows: 0 };
    }

    if (!calendarioTable) {
        updateSyncProgress(0, 'No existe la tabla de calendario para sincronizar.');
        showMessage('No existe la tabla calendario_ciclos_unpivoted', 'error');
        return { updatedRows: 0, pendingRows: 0 };
    }

    updateSyncProgress(8, `Leyendo calendario desde ${calendarioTable}...`);
    const calendarioRows = await fetchAllRowsFromTable(calendarioTable, 1000);

    updateSyncProgress(15, `Leyendo ordenes desde ${targetTable}...`);
    const ordenesRows = await fetchAllRowsFromTable(targetTable, 1000);

    if (!calendarioRows || calendarioRows.length === 0) {
        updateSyncProgress(100, `No hay datos en ${calendarioTable}.`);
        showMessage(`No hay datos en ${calendarioTable}`, 'info');
        return { updatedRows: 0, pendingRows: 0 };
    }

    if (!ordenesRows || ordenesRows.length === 0) {
        updateSyncProgress(100, `No hay registros en ${targetTable}.`);
        showMessage(`No hay registros en ${targetTable}`, 'info');
        return { updatedRows: 0, pendingRows: 0 };
    }

    updateSyncProgress(20, `Procesando cruce para ${ordenesRows.length} registros...`);

    const primaryKey = detectPrimaryKeyFromRows(ordenesRows);
    const hasUsablePrimaryKey = Object.prototype.hasOwnProperty.call(ordenesRows[0], primaryKey);

    const calendarioCicloCol = detectColumnName(calendarioRows, [/^ciclo$/, /cod.*ciclo/, /ciclo/]);
    const calendarioMesCol = detectColumnName(calendarioRows, [/^mes$/, /mes/]);
    const calendarioFechaCol = detectColumnName(calendarioRows, [/^fecha$/, /fecha/, /date/]);

    const ordenesCicloCol = detectColumnName(ordenesRows, [/^ciclo$/, /cod.*ciclo/, /ciclo/]);
    const ordenesMesCol = detectColumnName(ordenesRows, [/^mes$/, /mes/]);
    const ordenesFechaProgramadaCol = detectColumnName(ordenesRows, [/fecha.*programada/, /fecha_programada/, /fecha/, /date/]);

    if (!calendarioCicloCol || !calendarioMesCol || !calendarioFechaCol) {
        updateSyncProgress(100, 'No se detectaron columnas ciclo/mes/fecha en calendario.');
        showMessage('No se detectaron columnas ciclo/mes/fecha en calendario', 'error');
        return { updatedRows: 0, pendingRows: 0 };
    }

    if (!ordenesCicloCol) {
        updateSyncProgress(100, 'No se detecto la columna ciclo en ordenes.');
        showMessage('No se detecto la columna ciclo en ordenes', 'error');
        return { updatedRows: 0, pendingRows: 0 };
    }

    if (!ordenesMesCol && !ordenesFechaProgramadaCol) {
        updateSyncProgress(100, 'No se detecto mes ni fecha programada en ordenes.');
        showMessage('No se detecto mes ni fecha programada en ordenes', 'error');
        return { updatedRows: 0, pendingRows: 0 };
    }

    const calendarioMap = new Map();
    calendarioRows.forEach(row => {
        const key = buildJoinKey(row[calendarioCicloCol], row[calendarioMesCol]);
        const fechaValue = row[calendarioFechaCol];
        if (!key || !fechaValue) return;
        if (!calendarioMap.has(key)) {
            calendarioMap.set(key, normalizeDateForStorage(fechaValue));
        }
    });

    if (calendarioMap.size === 0) {
        updateSyncProgress(100, 'No se pudo construir mapa ciclo/mes del calendario.');
        showMessage('No se pudo construir el mapa ciclo/mes desde calendario', 'info');
        return { updatedRows: 0, pendingRows: 0 };
    }

    const updates = [];
    ordenesRows.forEach(row => {
        const rowId = row[primaryKey];

        const mesOrden = getMesFromRow(row, ordenesMesCol, ordenesFechaProgramadaCol);
        const key = buildJoinKey(row[ordenesCicloCol], mesOrden);
        const fechaCalendario = key ? (calendarioMap.get(key) || null) : null;

        const fechaActual = row.fecha_ejecucion;
        if (sameDateValue(fechaActual, fechaCalendario)) return;

        updates.push({
            id: rowId,
            cicloRaw: row[ordenesCicloCol],
            mesRaw: ordenesMesCol ? row[ordenesMesCol] : null,
            fecha_ejecucion: fechaCalendario
        });
    });

    if (updates.length === 0) {
        updateSyncProgress(100, 'No hubo cambios nuevos para aplicar en fecha_ejecucion.');
        showMessage('No hubo cambios nuevos para aplicar en fecha_ejecucion', 'info');
        return { updatedRows: 0, pendingRows: 0 };
    }

    updateSyncProgress(25, `Aplicando ${updates.length} actualizaciones en Supabase...`);

    let affectedRows = 0;
    const fallbackDone = new Set();
    let processedUpdates = 0;

    for (const item of updates) {
        let updated = 0;

        if (hasUsablePrimaryKey && item.id !== null && item.id !== undefined && item.id !== '') {
            const { data, error } = await supabase
                .from(targetTable)
                .update({ fecha_ejecucion: item.fecha_ejecucion })
                .eq(primaryKey, item.id)
                .select(primaryKey);

            if (error) throw error;
            updated = Array.isArray(data) ? data.length : 0;
        }

        if (updated === 0) {
            const fallbackKey = `${normalizeCiclo(item.cicloRaw)}|${convertMesToNumber(item.mesRaw)}|${item.fecha_ejecucion}`;
            if (!fallbackDone.has(fallbackKey)) {
                updated = await updateByCycleAndMes({
                    targetTable,
                    cicloColumn: ordenesCicloCol,
                    cicloValue: item.cicloRaw,
                    mesColumn: ordenesMesCol,
                    mesValue: item.mesRaw,
                    fechaEjecucion: item.fecha_ejecucion
                });
                fallbackDone.add(fallbackKey);
            }
        }

        affectedRows += updated;
        processedUpdates += 1;

        const percent = 25 + (processedUpdates / updates.length) * 75;
        updateSyncProgress(
            percent,
            `Actualizando ${processedUpdates}/${updates.length} registros pendientes (filas afectadas: ${affectedRows}).`
        );
    }

    if (affectedRows === 0) {
        updateSyncProgress(100, 'No se afectaron filas. Revisa formato/tipos de ciclo y mes.');
        showMessage('No se afectaron filas al actualizar. Revisa tipos/formato de ciclo y mes.', 'warning');
        return { updatedRows: 0, pendingRows: updates.length };
    }

    updateSyncProgress(100, `Finalizado: ${affectedRows} filas actualizadas en ${targetTable}.`);
    showMessage(`Fecha ejecucion recalculada: ${affectedRows} filas afectadas en ${targetTable}`, 'success');

    return { updatedRows: affectedRows, pendingRows: updates.length };
}

async function fetchAllRowsFromTable(tableName, batchSize = 1000) {
    const allRows = [];
    let from = 0;

    while (true) {
        const to = from + batchSize - 1;
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(from, to);

        if (error) throw error;

        const rows = data || [];
        allRows.push(...rows);

        if (rows.length < batchSize) break;
        from += batchSize;
    }

    return allRows;
}
