-- Ejecutar en Supabase SQL Editor
-- RPCs para evitar timeouts en el resumen y permitir borrado por cod_ciclo
-- directamente desde la base de datos.

create index if not exists idx_hystoricos_cod_ciclo_trim
    on public.hystoricos ((trim(cod_ciclo::text)));


create or replace function public.rpc_hystoricos_total_registros()
returns table (
    total_registros bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_total_registros bigint := 0;
begin
    perform set_config('statement_timeout', '0', true);

    select count(*)::bigint
      into v_total_registros
      from public.hystoricos;

    return query
    select v_total_registros;
end;
$$;

grant execute on function public.rpc_hystoricos_total_registros() to anon, authenticated;


create or replace function public.rpc_hystoricos_total_registros_estimado()
returns table (
        total_registros bigint
)
language sql
security definer
set search_path = public
stable
as $$
        select coalesce(round(c.reltuples)::bigint, 0) as total_registros
        from pg_class c
        join pg_namespace n
            on n.oid = c.relnamespace
        where n.nspname = 'public'
            and c.relname = 'hystoricos'
        limit 1;
$$;

grant execute on function public.rpc_hystoricos_total_registros_estimado() to anon, authenticated;


create or replace function public.rpc_hystoricos_cod_ciclo_unicos()
returns table (
    cod_ciclo text
)
language plpgsql
security definer
set search_path = public
as $$
begin
    perform set_config('statement_timeout', '0', true);

    return query
    select distinct trim(h.cod_ciclo::text) as cod_ciclo
    from public.hystoricos h
    where h.cod_ciclo is not null
      and trim(h.cod_ciclo::text) <> ''
    order by 1;
end;
$$;

grant execute on function public.rpc_hystoricos_cod_ciclo_unicos() to anon, authenticated;


create or replace function public.rpc_hystoricos_resumen()
returns table (
    total_registros bigint,
    ciclos_unicos text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_total_registros bigint := 0;
    v_ciclos_unicos text[] := '{}'::text[];
begin
    perform set_config('statement_timeout', '0', true);

        select t.total_registros
            into v_total_registros
            from public.rpc_hystoricos_total_registros() t;

        select coalesce(array_agg(c.cod_ciclo order by c.cod_ciclo), '{}'::text[])
            into v_ciclos_unicos
            from public.rpc_hystoricos_cod_ciclo_unicos() c;

    return query
    select v_total_registros, v_ciclos_unicos;
end;
$$;

grant execute on function public.rpc_hystoricos_resumen() to anon, authenticated;


create or replace function public.rpc_borrar_hystoricos_por_ciclo(
    p_cod_ciclo text,
    p_batch_size integer default 10000
)
returns table (
    cod_ciclo text,
    deleted_rows bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_cod_ciclo text := trim(coalesce(p_cod_ciclo, ''));
    v_batch_size integer := greatest(1, least(coalesce(p_batch_size, 10000), 50000));
    v_deleted_rows bigint := 0;
begin
    perform set_config('statement_timeout', '0', true);

    if v_cod_ciclo = '' then
        raise exception 'Debe enviar un cod_ciclo valido';
    end if;

    with deleted as (
        delete from public.hystoricos as h
        where h.ctid in (
            select h2.ctid
            from public.hystoricos as h2
            where trim(h2.cod_ciclo::text) = v_cod_ciclo
            limit v_batch_size
        )
        returning 1
    )
    select count(*)::bigint
      into v_deleted_rows
      from deleted;

    return query
    select v_cod_ciclo, v_deleted_rows;
end;
$$;

grant execute on function public.rpc_borrar_hystoricos_por_ciclo(text, integer) to anon, authenticated;