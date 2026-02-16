let currentData = [];
let groupedByDay = new Map();
let availableMonths = [];
let currentMonthKey = '';
let dateColumn = '';
let cycleColumn = '';

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('btnPrevMonth')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('btnNextMonth')?.addEventListener('click', () => changeMonth(1));
    loadData();
});

async function loadData() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    const tableContainer = document.getElementById('tableContainer');
    const shell = document.getElementById('calendarShell');
    const meta = document.getElementById('calendarMeta');

    loadingIndicator.style.display = 'block';
    if (shell) shell.style.display = 'none';
    if (meta) meta.textContent = '';

    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .limit(20000);

        if (error) throw error;

        currentData = data || [];
        if (currentData.length === 0) {
            tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #7f8c8d;">No hay registros en esta tabla</div>';
            return;
        }

        const columns = Object.keys(currentData[0]);
        dateColumn = detectDateColumn(currentData, columns);
        cycleColumn = detectCycleColumn(columns, dateColumn);

        if (!dateColumn || !cycleColumn) {
            tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e67e22;">No se pudo identificar automáticamente la columna de fecha y ciclo en la tabla.</div>';
            return;
        }

        buildCalendarIndex();

        if (availableMonths.length === 0) {
            tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #7f8c8d;">No hay fechas válidas para construir el calendario</div>';
            return;
        }

        currentMonthKey = getInitialMonth(availableMonths);
        renderCalendar();

        if (shell) shell.style.display = 'block';
    } catch (error) {
        console.error('Error al cargar datos:', error);
        tableContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c;">Error: ' + error.message + '</div>';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function detectDateColumn(rows, columns) {
    const prioritized = columns.filter(col => /(fecha|date|dia|day|lectura)/i.test(col));
    const candidates = prioritized.length > 0 ? prioritized : columns;

    let bestColumn = '';
    let bestScore = 0;

    candidates.forEach(col => {
        let validCount = 0;
        const sampleSize = Math.min(rows.length, 200);

        for (let index = 0; index < sampleSize; index += 1) {
            const iso = rowToIsoDate(rows[index], col);
            if (iso) validCount += 1;
        }

        if (validCount > bestScore) {
            bestScore = validCount;
            bestColumn = col;
        }
    });

    return bestScore > 0 ? bestColumn : '';
}

function detectCycleColumn(columns, excludedDateColumn) {
    const cycleCandidates = columns.filter(col => /(ciclo|cycle)/i.test(col) && col !== excludedDateColumn);
    if (cycleCandidates.length > 0) return cycleCandidates[0];

    const genericCandidates = columns.filter(col => col !== excludedDateColumn && !/(fecha|date|dia|day)/i.test(col));
    return genericCandidates.length > 0 ? genericCandidates[0] : '';
}

function buildCalendarIndex() {
    groupedByDay = new Map();
    const monthSet = new Set();

    currentData.forEach(row => {
        const isoDate = rowToIsoDate(row, dateColumn);
        if (!isoDate) return;

        const monthKey = isoDate.slice(0, 7);
        monthSet.add(monthKey);

        if (!groupedByDay.has(isoDate)) {
            groupedByDay.set(isoDate, new Set());
        }

        const cycleValue = row[cycleColumn];
        if (cycleValue !== null && cycleValue !== undefined && String(cycleValue).trim() !== '') {
            groupedByDay.get(isoDate).add(String(cycleValue).trim());
        }
    });

    availableMonths = Array.from(monthSet).sort();
}

function rowToIsoDate(row, dateField) {
    if (!row) return null;

    const directValue = row[dateField];
    const normalizedDirect = normalizeDateValue(directValue);
    if (normalizedDirect) return normalizedDirect;

    const yearRaw = row.anio ?? row.ano ?? row.year;
    const monthRaw = row.mes ?? row.month;
    const dayRaw = row.dia ?? row.day;

    if (yearRaw !== undefined && monthRaw !== undefined && dayRaw !== undefined) {
        const year = Number(yearRaw);
        const month = Number(monthRaw);
        const day = Number(dayRaw);

        if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
            return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
    }

    return null;
}

function normalizeDateValue(value) {
    if (value === null || value === undefined || value === '') return null;

    const asString = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) {
        return asString;
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(asString)) {
        return asString.slice(0, 10);
    }

    const ddmmyyyy = asString.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (ddmmyyyy) {
        const day = Number(ddmmyyyy[1]);
        const month = Number(ddmmyyyy[2]);
        const year = Number(ddmmyyyy[3]);
        return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    const parsed = new Date(asString);
    if (!Number.isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }

    return null;
}

function getInitialMonth(months) {
    const today = new Date();
    const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    if (months.includes(current)) return current;
    return months[months.length - 1];
}

function changeMonth(direction) {
    if (!availableMonths.length) return;
    const currentIndex = availableMonths.indexOf(currentMonthKey);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= availableMonths.length) return;

    currentMonthKey = availableMonths[nextIndex];
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthLabel = document.getElementById('monthLabel');
    const yearLabel = document.getElementById('yearLabel');
    const meta = document.getElementById('calendarMeta');

    if (!grid || !currentMonthKey) return;

    const [yearStr, monthStr] = currentMonthKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);

    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const firstWeekDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    monthLabel.textContent = monthNames[month - 1] || '';
    yearLabel.textContent = String(year);

    let html = '';

    for (let index = 0; index < firstWeekDay; index += 1) {
        html += '<div class="calendar-day empty"></div>';
    }

    let daysWithCycles = 0;
    let totalCyclesInMonth = 0;
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for (let day = 1; day <= daysInMonth; day += 1) {
        const isoDate = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;
        const cyclesSet = groupedByDay.get(isoDate) || new Set();
        const cycles = Array.from(cyclesSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const weekDay = new Date(year, month - 1, day).getDay();
        const isHoliday = isColombianHoliday(year, month, day);

        if (cycles.length > 0) {
            daysWithCycles += 1;
            totalCyclesInMonth += cycles.length;
        }

        const chips = cycles.length > 0
            ? `<div class="cycle-list">${cycles.map(cycle => `<span class="cycle-chip">Ciclo ${escapeHtml(cycle)}</span>`).join('')}</div>`
            : '';

        let noReadingLabel = '';
        if (cycles.length === 0 && weekDay !== 0) {
            if (isHoliday) {
                noReadingLabel = '<div style="font-size:0.68rem;font-weight:800;color:#dc2626;line-height:1.15;">FESTIVO</div>';
            } else {
                noReadingLabel = '<div style="font-size:0.68rem;font-weight:800;color:#16a34a;line-height:1.15;">DIA DE NO LECTURA</div>';
            }
        }

        html += `
            <div class="calendar-day">
                <div class="day-number ${isoDate === todayIso ? 'today' : ''}">${day}</div>
                ${chips}
                ${noReadingLabel}
            </div>
        `;
    }

    const cellsUsed = firstWeekDay + daysInMonth;
    const remainingCells = cellsUsed % 7 === 0 ? 0 : 7 - (cellsUsed % 7);
    for (let index = 0; index < remainingCells; index += 1) {
        html += '<div class="calendar-day empty"></div>';
    }

    grid.innerHTML = html;

    const monthIndex = availableMonths.indexOf(currentMonthKey);
    const prevBtn = document.getElementById('btnPrevMonth');
    const nextBtn = document.getElementById('btnNextMonth');
    if (prevBtn) prevBtn.disabled = monthIndex <= 0;
    if (nextBtn) nextBtn.disabled = monthIndex >= availableMonths.length - 1;

    if (meta) {
        meta.textContent = `Días con lectura: ${daysWithCycles} | Ciclos registrados: ${totalCyclesInMonth} | Fecha: ${dateColumn} | Ciclo: ${cycleColumn}`;
    }
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function isColombianHoliday(year, month, day) {
    const date = new Date(year, month - 1, day);
    const key = toDateKey(date);
    const holidays = getColombianHolidays(year);
    return holidays.has(key);
}

function getColombianHolidays(year) {
    const holidays = new Set();

    // Festivos fijos
    holidays.add(toDateKey(new Date(year, 0, 1)));   // Año Nuevo
    holidays.add(toDateKey(new Date(year, 4, 1)));   // Día del Trabajo
    holidays.add(toDateKey(new Date(year, 6, 20)));  // Independencia
    holidays.add(toDateKey(new Date(year, 7, 7)));   // Batalla de Boyacá
    holidays.add(toDateKey(new Date(year, 11, 8)));  // Inmaculada Concepción
    holidays.add(toDateKey(new Date(year, 11, 25))); // Navidad

    // Festivos trasladables (Ley Emiliani)
    holidays.add(toDateKey(moveToNextMonday(new Date(year, 0, 6))));   // Reyes Magos
    holidays.add(toDateKey(moveToNextMonday(new Date(year, 2, 19))));  // San José
    holidays.add(toDateKey(moveToNextMonday(new Date(year, 5, 29))));  // San Pedro y San Pablo
    holidays.add(toDateKey(moveToNextMonday(new Date(year, 7, 15))));  // Asunción de la Virgen
    holidays.add(toDateKey(moveToNextMonday(new Date(year, 9, 12))));  // Día de la Raza
    holidays.add(toDateKey(moveToNextMonday(new Date(year, 10, 1))));  // Todos los Santos
    holidays.add(toDateKey(moveToNextMonday(new Date(year, 10, 11)))); // Independencia de Cartagena

    // Semana Santa y festivos religiosos basados en Pascua
    const easter = calculateEasterSunday(year);
    holidays.add(toDateKey(addDays(easter, -3))); // Jueves Santo
    holidays.add(toDateKey(addDays(easter, -2))); // Viernes Santo
    holidays.add(toDateKey(moveToNextMonday(addDays(easter, 43)))); // Ascensión
    holidays.add(toDateKey(moveToNextMonday(addDays(easter, 64)))); // Corpus Christi
    holidays.add(toDateKey(moveToNextMonday(addDays(easter, 71)))); // Sagrado Corazón

    return holidays;
}

function moveToNextMonday(date) {
    const moved = new Date(date);
    const day = moved.getDay();
    if (day === 1) return moved;
    const daysToAdd = (8 - day) % 7;
    moved.setDate(moved.getDate() + daysToAdd);
    return moved;
}

function addDays(date, days) {
    const moved = new Date(date);
    moved.setDate(moved.getDate() + days);
    return moved;
}

function toDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function calculateEasterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}