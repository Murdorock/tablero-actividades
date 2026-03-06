/// <reference path="../edge-runtime-types.d.ts" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP_TIME_ZONE = "America/Bogota";
const BOGOTA_UTC_OFFSET = "-05:00";

const ALLOWED_TARGET_TABLES = new Set(["ordenes_generadas", "ordenes_lectura"]);
const ALLOWED_CALENDAR_TABLES = new Set(["calendario_ciclo_unpivoted", "calendario_ciclos_unpivoted"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestPayload = {
  targetTable?: string;
  calendarioTable?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeCiclo(value: unknown) {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";

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

function convertMesToNumber(value: unknown) {
  if (value === null || value === undefined) return null;

  if (typeof value === "number" && value >= 1 && value <= 12) {
    return Math.trunc(value);
  }

  const textValue = normalizeText(value);
  const numericCandidate = Number(textValue);
  if (!Number.isNaN(numericCandidate) && numericCandidate >= 1 && numericCandidate <= 12) {
    return Math.trunc(numericCandidate);
  }

  const monthMap: Record<string, number> = {
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
    diciembre: 12,
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

function buildJoinKey(ciclo: unknown, mes: unknown) {
  const cicloValue = normalizeCiclo(ciclo);
  const mesNumber = convertMesToNumber(mes);
  if (!cicloValue || !mesNumber) return null;
  return `${cicloValue}|${mesNumber}`;
}

function detectPrimaryKeyFromRows(rows: Record<string, unknown>[]) {
  if (!rows || rows.length === 0) return "id";

  const rowSample = rows[0];
  const keys = Object.keys(rowSample);

  if (keys.includes("id")) return "id";

  const candidates = keys.filter((key) => key.startsWith("id_") || key.endsWith("_id"));
  return candidates[0] || "id";
}

function detectColumnName(rows: Record<string, unknown>[], patterns: RegExp[], fallback = "") {
  if (!rows || rows.length === 0) return fallback;

  const keys = Object.keys(rows[0]);
  const normalized = keys.map((key) => ({
    original: key,
    normalized: normalizeText(key),
  }));

  for (const pattern of patterns) {
    const found = normalized.find((item) => pattern.test(item.normalized));
    if (found) return found.original;
  }

  return fallback;
}

function getDatePartsInTimeZone(value: unknown, timeZone = APP_TIME_ZONE) {
  if (value === null || value === undefined || value === "") return null;

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
      isoDate: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  }

  const parsed = new Date(asString);
  if (Number.isNaN(parsed.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(parsed);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;

  return {
    year,
    month,
    day,
    isoDate: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function getMesFromRow(row: Record<string, unknown>, mesColumn: string, fechaColumn: string) {
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

function sameDateValue(a: unknown, b: unknown) {
  if (!a && !b) return true;
  if (!a || !b) return false;

  const aParts = getDatePartsInTimeZone(a);
  const bParts = getDatePartsInTimeZone(b);

  if (aParts && bParts) {
    return aParts.isoDate === bParts.isoDate;
  }

  return String(a).slice(0, 10) === String(b).slice(0, 10);
}

function normalizeDateForStorage(value: unknown) {
  const parts = getDatePartsInTimeZone(value);
  if (parts) {
    return `${parts.isoDate}T00:00:00${BOGOTA_UTC_OFFSET}`;
  }
  return value;
}

async function fetchAllRowsFromTable(
  client: ReturnType<typeof createClient>,
  tableName: string,
  batchSize = 1000,
) {
  const allRows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const to = from + batchSize - 1;
    const { data, error } = await client
      .from(tableName)
      .select("*")
      .range(from, to);

    if (error) throw error;

    const rows = (data || []) as Record<string, unknown>[];
    allRows.push(...rows);

    if (rows.length < batchSize) break;
    from += batchSize;
  }

  return allRows;
}

async function updateByCycleAndMes({
  client,
  targetTable,
  cicloColumn,
  cicloValue,
  mesColumn,
  mesValue,
  fechaEjecucion,
}: {
  client: ReturnType<typeof createClient>;
  targetTable: string;
  cicloColumn: string;
  cicloValue: unknown;
  mesColumn: string;
  mesValue: unknown;
  fechaEjecucion: unknown;
}) {
  if (!cicloColumn || cicloValue === null || cicloValue === undefined) {
    return 0;
  }

  let query = client
    .from(targetTable)
    .update({ fecha_ejecucion: fechaEjecucion })
    .eq(cicloColumn, cicloValue);

  if (mesColumn && mesValue !== null && mesValue !== undefined) {
    query = query.eq(mesColumn, mesValue);
  }

  const { data, error } = await query.select("*");
  if (error) throw error;

  return Array.isArray(data) ? data.length : 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase env vars are missing" }, 500);
  }

  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user?.email) {
    return jsonResponse({ error: userError?.message || "Unauthorized" }, 401);
  }

  const { data: perfil, error: perfilError } = await adminClient
    .from("perfiles")
    .select("rol")
    .eq("email", user.email)
    .limit(1)
    .maybeSingle();

  if (perfilError || !perfil || perfil.rol !== "ADMINISTRADOR") {
    return jsonResponse({ error: "Acceso denegado" }, 403);
  }

  let payload: RequestPayload = {};
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const targetTable = (payload.targetTable || "ordenes_generadas").trim();
  const calendarioTable = (payload.calendarioTable || "calendario_ciclo_unpivoted").trim();

  if (!ALLOWED_TARGET_TABLES.has(targetTable)) {
    return jsonResponse({ error: `Tabla de ordenes no permitida: ${targetTable}` }, 400);
  }

  if (!ALLOWED_CALENDAR_TABLES.has(calendarioTable)) {
    return jsonResponse({ error: `Tabla de calendario no permitida: ${calendarioTable}` }, 400);
  }

  try {
    const calendarioRows = await fetchAllRowsFromTable(adminClient, calendarioTable, 1000);
    const ordenesRows = await fetchAllRowsFromTable(adminClient, targetTable, 1000);

    if (!calendarioRows.length) {
      return jsonResponse({
        updatedRows: 0,
        pendingRows: 0,
        message: `No hay datos en ${calendarioTable}`,
      });
    }

    if (!ordenesRows.length) {
      return jsonResponse({
        updatedRows: 0,
        pendingRows: 0,
        message: `No hay datos en ${targetTable}`,
      });
    }

    const primaryKey = detectPrimaryKeyFromRows(ordenesRows);
    const hasUsablePrimaryKey = Object.prototype.hasOwnProperty.call(ordenesRows[0], primaryKey);

    const calendarioCicloCol = detectColumnName(calendarioRows, [/^ciclo$/, /cod.*ciclo/, /ciclo/]);
    const calendarioMesCol = detectColumnName(calendarioRows, [/^mes$/, /mes/]);
    const calendarioFechaCol = detectColumnName(calendarioRows, [/^fecha$/, /fecha/, /date/]);

    const ordenesCicloCol = detectColumnName(ordenesRows, [/^ciclo$/, /cod.*ciclo/, /ciclo/]);
    const ordenesMesCol = detectColumnName(ordenesRows, [/^mes$/, /mes/]);
    const ordenesFechaProgramadaCol = detectColumnName(ordenesRows, [/fecha.*programada/, /fecha_programada/, /fecha/, /date/]);

    if (!calendarioCicloCol || !calendarioMesCol || !calendarioFechaCol) {
      return jsonResponse({ error: "No se detectaron columnas ciclo/mes/fecha en calendario" }, 400);
    }

    if (!ordenesCicloCol) {
      return jsonResponse({ error: "No se detecto la columna ciclo en ordenes" }, 400);
    }

    if (!ordenesMesCol && !ordenesFechaProgramadaCol) {
      return jsonResponse({ error: "No se detecto mes ni fecha programada en ordenes" }, 400);
    }

    const calendarioMap = new Map<string, unknown>();
    calendarioRows.forEach((row) => {
      const key = buildJoinKey(row[calendarioCicloCol], row[calendarioMesCol]);
      const fechaValue = row[calendarioFechaCol];
      if (!key || !fechaValue) return;
      if (!calendarioMap.has(key)) {
        calendarioMap.set(key, normalizeDateForStorage(fechaValue));
      }
    });

    if (calendarioMap.size === 0) {
      return jsonResponse({
        updatedRows: 0,
        pendingRows: 0,
        message: "No se pudo construir mapa ciclo/mes desde calendario",
      });
    }

    const updates: Array<{
      id: unknown;
      cicloRaw: unknown;
      mesRaw: unknown;
      fecha_ejecucion: unknown;
    }> = [];

    ordenesRows.forEach((row) => {
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
        fecha_ejecucion: fechaCalendario,
      });
    });

    if (!updates.length) {
      return jsonResponse({
        updatedRows: 0,
        pendingRows: 0,
        message: "No hubo cambios nuevos para aplicar",
      });
    }

    let affectedRows = 0;
    const fallbackDone = new Set<string>();

    for (const item of updates) {
      let updated = 0;

      if (hasUsablePrimaryKey && item.id !== null && item.id !== undefined && item.id !== "") {
        const { data, error } = await adminClient
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
            client: adminClient,
            targetTable,
            cicloColumn: ordenesCicloCol,
            cicloValue: item.cicloRaw,
            mesColumn: ordenesMesCol,
            mesValue: item.mesRaw,
            fechaEjecucion: item.fecha_ejecucion,
          });

          fallbackDone.add(fallbackKey);
        }
      }

      affectedRows += updated;
    }

    return jsonResponse({
      updatedRows: affectedRows,
      pendingRows: updates.length,
      targetTable,
      calendarioTable,
      primaryKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado en sincronizacion";
    return jsonResponse({ error: message }, 500);
  }
});
