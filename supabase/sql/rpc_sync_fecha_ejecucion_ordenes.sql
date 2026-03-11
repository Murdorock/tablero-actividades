-- Ejecutar en Supabase SQL Editor
-- RPC para sincronizar fecha_ejecucion con mejor rendimiento (DB-side) y
-- evitar limite de computo de la Edge Function en tablas grandes.

create or replace function public.rpc_sync_fecha_ejecucion_ordenes(
    p_target_table text default 'ordenes_generadas',
    p_calendario_table text default 'calendario_ciclo_unpivoted'
)
returns table (
    updated_rows bigint,
    pending_rows bigint,
    target_table text,
    calendario_table text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_target_table text := lower(trim(coalesce(p_target_table, 'ordenes_generadas')));
    v_cal_table text := lower(trim(coalesce(p_calendario_table, 'calendario_ciclo_unpivoted')));
    v_updated_rows bigint := 0;
    v_pending_rows bigint := 0;
    v_sql text;
begin
    if v_target_table not in ('ordenes_generadas', 'ordenes_lectura') then
        raise exception 'Tabla de ordenes no permitida: %', v_target_table;
    end if;

    if v_cal_table not in ('calendario_ciclo_unpivoted', 'calendario_ciclos_unpivoted') then
        raise exception 'Tabla de calendario no permitida: %', v_cal_table;
    end if;

    v_sql := format($fmt$
        with calendario_raw as (
            select
                regexp_replace(trim(coalesce(ciclo::text, '')), '^0+', '') as ciclo_norm,
                case
                    when trim(coalesce(mes::text, '')) ~ '^\d+$' then greatest(1, least(12, trim(mes::text)::int))
                    when lower(trim(coalesce(mes::text, ''))) like 'enero%%' then 1
                    when lower(trim(coalesce(mes::text, ''))) like 'febrero%%' then 2
                    when lower(trim(coalesce(mes::text, ''))) like 'marzo%%' then 3
                    when lower(trim(coalesce(mes::text, ''))) like 'abril%%' then 4
                    when lower(trim(coalesce(mes::text, ''))) like 'mayo%%' then 5
                    when lower(trim(coalesce(mes::text, ''))) like 'junio%%' then 6
                    when lower(trim(coalesce(mes::text, ''))) like 'julio%%' then 7
                    when lower(trim(coalesce(mes::text, ''))) like 'agosto%%' then 8
                    when lower(trim(coalesce(mes::text, ''))) like 'septiembre%%' then 9
                    when lower(trim(coalesce(mes::text, ''))) like 'setiembre%%' then 9
                    when lower(trim(coalesce(mes::text, ''))) like 'octubre%%' then 10
                    when lower(trim(coalesce(mes::text, ''))) like 'noviembre%%' then 11
                    when lower(trim(coalesce(mes::text, ''))) like 'diciembre%%' then 12
                    else null
                end as mes_norm,
                (date_trunc('day', fecha::timestamptz at time zone 'America/Bogota'))::date as fecha_ejec
            from %I
            where ciclo is not null
              and mes is not null
              and fecha is not null
        ),
        calendario as (
            select distinct on (ciclo_norm, mes_norm)
                ciclo_norm,
                mes_norm,
                fecha_ejec
            from calendario_raw
            where ciclo_norm <> ''
              and mes_norm between 1 and 12
            order by ciclo_norm, mes_norm
        ),
        ordenes as (
            select
                t.id,
                regexp_replace(trim(coalesce(t.ciclo::text, '')), '^0+', '') as ciclo_norm,
                case
                    when trim(coalesce(t.mes::text, '')) ~ '^\d+$' then greatest(1, least(12, trim(t.mes::text)::int))
                    when t.fecha_programada is not null then extract(month from (t.fecha_programada::timestamptz at time zone 'America/Bogota'))::int
                    else null
                end as mes_norm,
                (date_trunc('day', t.fecha_ejecucion::timestamptz at time zone 'America/Bogota'))::date as fecha_actual
            from %I t
        ),
        candidate as (
            select
                o.id,
                c.fecha_ejec
            from ordenes o
            join calendario c
              on c.ciclo_norm = o.ciclo_norm
             and c.mes_norm = o.mes_norm
            where o.ciclo_norm <> ''
              and o.mes_norm between 1 and 12
              and o.fecha_actual is distinct from c.fecha_ejec
        ),
        updated as (
            update %I t
               set fecha_ejecucion = (candidate.fecha_ejec::text || 'T00:00:00-05:00')::timestamptz
              from candidate
             where t.id = candidate.id
            returning 1
        )
        select
            (select count(*) from updated)::bigint as updated_rows,
            (select count(*) from candidate)::bigint as pending_rows
    $fmt$, v_cal_table, v_target_table, v_target_table);

    execute v_sql into v_updated_rows, v_pending_rows;

    return query
    select
        v_updated_rows,
        v_pending_rows,
        v_target_table,
        v_cal_table;
end;
$$;

grant execute on function public.rpc_sync_fecha_ejecucion_ordenes(text, text) to anon, authenticated;
