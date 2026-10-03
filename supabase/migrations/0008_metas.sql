-- =============================================================================
-- 0008 · Metas e análises
-- Rodar no Supabase: SQL Editor → New query → colar tudo → Run
--
-- - orcamentos: limite de gasto por mês numa categoria (de uma pessoa ou dos dois)
-- - metas + meta_aportes: metas de economia (ex.: reserva para viagem)
-- - gerar_periodo: gera vários meses de uma vez (para os gráficos)
-- =============================================================================

-- Limite mensal de gasto por categoria. membro_id nulo = soma dos dois
create table public.orcamentos (
  id              uuid primary key default gen_random_uuid(),
  categoria_id    uuid not null references public.categorias(id) on delete cascade,
  membro_id       uuid references public.membros(id) on delete cascade,
  valor_centavos  int  not null check (valor_centavos > 0),
  criado_em       timestamptz not null default now()
);

-- Um limite por categoria para cada pessoa e um para os dois juntos
create unique index orcamentos_unico on public.orcamentos (
  categoria_id, coalesce(membro_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Metas de economia. membro_id nulo = meta do casal
create table public.metas (
  id                   uuid primary key default gen_random_uuid(),
  nome                 text not null check (length(trim(nome)) > 0),
  membro_id            uuid references public.membros(id),
  valor_alvo_centavos  int  not null check (valor_alvo_centavos > 0),
  prazo                date,
  cor                  text,
  arquivada            boolean not null default false,
  criado_em            timestamptz not null default now()
);

-- Dinheiro guardado (positivo) ou retirado (negativo) de uma meta
create table public.meta_aportes (
  id              uuid primary key default gen_random_uuid(),
  meta_id         uuid not null references public.metas(id) on delete cascade,
  membro_id       uuid not null references public.membros(id),
  valor_centavos  int  not null check (valor_centavos <> 0),
  data            date not null,
  observacao      text,
  criado_em       timestamptz not null default now()
);

create index meta_aportes_meta on public.meta_aportes (meta_id);

-- Mesma segurança das outras tabelas (ver 0002): só membros leem e escrevem
do $$
declare
  t text;
begin
  foreach t in array array['orcamentos', 'metas', 'meta_aportes']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "membros acessam tudo" on public.%I
         for all to authenticated
         using (public.eh_membro())
         with check (public.eh_membro())',
      t
    );
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    -- Tempo real (ver 0007), quando rodando no Supabase
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
       ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Gera todos os meses de p_de até p_ate (no máximo 25). Retorna quantos
-- lançamentos foram criados. Usada pelos gráficos antes de ler um período.
-- -----------------------------------------------------------------------------
create function public.gerar_periodo(p_de date, p_ate date)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_mes date := p_de;
  v_total int := 0;
begin
  if p_de is null or p_ate is null or p_ate < p_de then
    raise exception 'Período inválido';
  end if;
  if p_ate > (p_de + interval '24 months')::date then
    raise exception 'Período longo demais (máximo 25 meses)';
  end if;
  while v_mes <= p_ate loop
    v_total := v_total + gerar_competencia(v_mes);
    v_mes := (v_mes + interval '1 month')::date;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.gerar_periodo(date, date) from public, anon;
grant execute on function public.gerar_periodo(date, date) to authenticated;
