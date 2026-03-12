-- 1) Agregar columna para URL de foto en la tabla personal
alter table if exists public.personal
add column if not exists foto_url text;

-- 2) (Opcional) Crear tabla temporal de apoyo para carga masiva desde CSV
-- Exporta tu Excel a CSV con columnas: id_codigo,foto_url
create table if not exists public.personal_fotos_tmp (
    id_codigo text primary key,
    foto_url text
);

-- 3) Limpia la tabla temporal antes de cada importación
truncate table public.personal_fotos_tmp;

-- 4) Importa el CSV en personal_fotos_tmp desde la UI de Supabase
-- Luego ejecuta este update para relacionar por id_codigo
update public.personal p
set foto_url = t.foto_url
from public.personal_fotos_tmp t
where p.id_codigo = t.id_codigo;

-- 5) (Opcional) Verificar cuántos registros quedaron con foto
select
    count(*) as total_personal,
    count(*) filter (where foto_url is not null and btrim(foto_url) <> '') as con_foto
from public.personal;

-- 6) (Opcional) Limpiar staging al terminar
-- truncate table public.personal_fotos_tmp;
