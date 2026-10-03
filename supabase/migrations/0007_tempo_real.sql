-- =============================================================================
-- 0007 · Tempo real
-- Rodar no Supabase: SQL Editor → New query → colar tudo → Run
--
-- Coloca as tabelas na publicação do Supabase Realtime: o que um lança,
-- o outro vê sem recarregar. O RLS continua valendo (só membros recebem).
-- Pode rodar de novo sem erro.
-- =============================================================================

do $$
declare
  t text;
begin
  -- Fora do Supabase (teste local) a publicação não existe: não faz nada
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publicação supabase_realtime não existe; nada a fazer.';
    return;
  end if;

  foreach t in array array[
    'membros', 'contas', 'categorias', 'recorrentes', 'recorrente_divisoes',
    'compras_parceladas', 'compra_divisoes', 'lancamentos'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
