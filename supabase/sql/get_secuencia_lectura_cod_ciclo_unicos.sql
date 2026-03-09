-- Ejecutar en Supabase SQL Editor
-- Crea una RPC que devuelve todos los cod_ciclo unicos de secuencia_lectura.

create or replace function public.get_secuencia_lectura_cod_ciclo_unicos()
returns table (cod_ciclo text)
language sql
stable
as $$
    select distinct trim(cod_ciclo::text) as cod_ciclo
    from public.secuencia_lectura
    where cod_ciclo is not null
      and trim(cod_ciclo::text) <> ''
    order by cod_ciclo;
$$;

grant execute on function public.get_secuencia_lectura_cod_ciclo_unicos() to anon, authenticated;
