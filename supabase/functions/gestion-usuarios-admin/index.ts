import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RequestPayload = {
  action?: "list_users" | "create_user" | "delete_user";
  page?: number;
  perPage?: number;
  email?: string;
  password?: string;
  nombreCompleto?: string;
  rol?: string;
  codigoSupAux?: string;
  autoConfirm?: boolean;
  userId?: string;
  userEmail?: string;
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

Deno.serve(async (req) => {
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
    .single();

  if (perfilError || !perfil || perfil.rol !== "ADMINISTRADOR") {
    return jsonResponse({ error: "Acceso denegado" }, 403);
  }

  let payload: RequestPayload = {};
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const action = payload.action;

  if (action === "list_users") {
    const page = Number.isFinite(payload.page) ? Number(payload.page) : 1;
    const perPage = Number.isFinite(payload.perPage) ? Number(payload.perPage) : 1000;

    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ users: data.users || [] });
  }

  if (action === "create_user") {
    const email = (payload.email || "").trim();
    const password = payload.password || "";
    const nombreCompleto = (payload.nombreCompleto || "").trim();
    const rol = (payload.rol || "").trim();
    const codigoSupAux = (payload.codigoSupAux || "").trim();
    const autoConfirm = payload.autoConfirm !== false;

    if (!email || !password || !nombreCompleto || !rol || !codigoSupAux) {
      return jsonResponse({ error: "Email, contraseña, nombreCompleto, rol y codigoSupAux son obligatorios" }, 400);
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: autoConfirm,
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    const createdUser = data.user;
    if (!createdUser?.id || !createdUser.email) {
      return jsonResponse({ error: "No se pudo obtener el usuario creado" }, 500);
    }

    const { error: perfilInsertError } = await adminClient
      .from("perfiles")
      .insert({
        id: createdUser.id,
        email: createdUser.email,
        nombre_completo: nombreCompleto,
        rol,
        codigo_sup_aux: codigoSupAux,
      });

    if (perfilInsertError) {
      await adminClient.auth.admin.deleteUser(createdUser.id);
      return jsonResponse({ error: `Error creando perfil: ${perfilInsertError.message}` }, 400);
    }

    return jsonResponse({ user: createdUser });
  }

  if (action === "delete_user") {
    const userId = (payload.userId || "").trim();
    const userEmail = (payload.userEmail || "").trim();

    if (!userId) {
      return jsonResponse({ error: "userId es obligatorio" }, 400);
    }

    if (userEmail) {
      const { error: perfilesDeleteByEmailError } = await adminClient
        .from("perfiles")
        .delete()
        .eq("email", userEmail);

      if (perfilesDeleteByEmailError) {
        return jsonResponse({ error: `Error eliminando en perfiles por email: ${perfilesDeleteByEmailError.message}` }, 400);
      }
    } else {
      const { error: perfilesDeleteByUuidError } = await adminClient
        .from("perfiles")
        .delete()
        .eq("uuid", userId);

      if (perfilesDeleteByUuidError) {
        return jsonResponse({ error: `Error eliminando en perfiles por uuid: ${perfilesDeleteByUuidError.message}` }, 400);
      }
    }

    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      return jsonResponse({ error: `Error eliminando en Authentication: ${authDeleteError.message}` }, 400);
    }

    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: "Acción no soportada" }, 400);
});