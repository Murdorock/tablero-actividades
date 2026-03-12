-- Flujo completo para fotos de personal en Supabase Storage
-- Objetivo: subir archivos al bucket y sincronizar foto_url automaticamente por id_codigo
-- Convencion de nombre recomendada: id_codigo.ext (ejemplo: LEC_001.jpg)

-- 1) Asegurar columna foto_url
alter table if exists public.personal
add column if not exists foto_url text;

-- 2) Crear bucket publico para fotos de personal
insert into storage.buckets (id, name, public)
values ('cold', 'cold', true)
on conflict (id) do update
set public = excluded.public;

-- 3) Politica de lectura publica para objetos del bucket
-- Nota: el endpoint /object/public usa bucket publico, pero esta politica permite select sobre storage.objects
drop policy if exists "Public read cold" on storage.objects;

create policy "Public read cold"
on storage.objects
for select
using (bucket_id = 'cold');

-- 4) Funciones helper para extraer id_codigo desde nombre de archivo
create or replace function public.extract_id_codigo_from_path(path text)
returns text
language sql
immutable
as $$
    select lower(
        regexp_replace(
            regexp_replace(path, '^.*/', ''),
            '\\.[^.]+$',
            ''
        )
    );
$$;

-- 5) RPC para sincronizar foto_url desde objetos del bucket
-- Toma el archivo mas reciente por id_codigo y construye URL publica
create or replace function public.sync_personal_foto_url_from_storage(
    p_project_url text,
    p_bucket text default 'cold',
    p_prefix text default 'fotos_personal'
)
returns table(updated_rows integer, matched_files integer)
language plpgsql
security definer
set search_path = public, storage
as $$
declare
    v_updated integer := 0;
    v_matched integer := 0;
begin
    with latest_file_per_codigo as (
        select distinct on (codigo)
            codigo,
            name
        from (
            select
                public.extract_id_codigo_from_path(o.name) as codigo,
                o.name,
                o.updated_at
            from storage.objects o
            where o.bucket_id = p_bucket
                            and (
                                p_prefix is null
                                or btrim(p_prefix) = ''
                                or o.name like trim(both '/' from p_prefix) || '/%'
                            )
        ) x
        where codigo is not null and btrim(codigo) <> ''
        order by codigo, updated_at desc nulls last
    ),
    mapped as (
        select
            p.id_codigo,
            l.name,
            rtrim(p_project_url, '/') || '/storage/v1/object/public/' || p_bucket || '/' || l.name as public_url
        from public.personal p
        join latest_file_per_codigo l
          on lower(p.id_codigo) = l.codigo
    ),
    updated as (
        update public.personal p
           set foto_url = m.public_url
          from mapped m
         where p.id_codigo = m.id_codigo
           and coalesce(p.foto_url, '') <> coalesce(m.public_url, '')
        returning p.id_codigo
    )
    select
        (select count(*) from updated),
        (select count(*) from mapped)
    into v_updated, v_matched;

    return query select v_updated, v_matched;
end;
$$;

-- 6) Permisos para ejecutar RPC desde frontend con anon/authenticated
grant execute on function public.sync_personal_foto_url_from_storage(text, text, text) to anon, authenticated;

-- 7) Consulta de verificacion
-- select * from public.sync_personal_foto_url_from_storage('https://txeuzsypnwesscganktp.supabase.co', 'cold', 'fotos_personal');
-- select id_codigo, foto_url from public.personal order by id_codigo;
