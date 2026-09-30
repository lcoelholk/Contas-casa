-- =============================================================================
-- 0004 · Contas fixas (recorrentes) e geração automática do mês
-- Rodar no Supabase: SQL Editor → New query → colar tudo → Run
--
-- Todas as funções rodam com as permissões de quem chama (security invoker),
-- então o RLS continua valendo: só membros conseguem gerar ou alterar algo.
-- =============================================================================

-- Conta fixa pode ser gasto (aluguel) ou entrada (salário)
alter table public.recorrentes
  add column tipo text not null default 'saida' check (tipo in ('saida', 'entrada'));

-- Dia de vencimento dentro do mês; se o dia não existe (31 em abril), usa o último
create function public.vencimento_no_mes(p_mes date, p_dia int)
returns date
language sql
immutable
set search_path = public
as $$
  select case
    when p_dia is null then null
    else make_date(
      extract(year from p_mes)::int,
      extract(month from p_mes)::int,
      least(p_dia, extract(day from (date_trunc('month', p_mes) + interval '1 month - 1 day'))::int)
    )
  end;
$$;

-- -----------------------------------------------------------------------------
-- Gera os lançamentos de um mês a partir das contas fixas e das compras parceladas.
-- Pode ser chamada quantas vezes quiser: nunca duplica. Um mês que já tem
-- lançamentos de uma conta fixa não é gerado de novo (respeita edições do mês).
-- Retorna quantos lançamentos foram criados.
-- -----------------------------------------------------------------------------
create function public.gerar_competencia(p_mes date)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total int := 0;
  v_n int;
begin
  if p_mes is null or extract(day from p_mes) <> 1 then
    raise exception 'A competência deve ser o dia 1 do mês';
  end if;

  -- Contas fixas: para cada membro, vale a divisão mais recente com vigência até este mês
  insert into lancamentos (
    conta_id, membro_id, tipo, descricao, valor_centavos, categoria_id,
    competencia, vencimento, origem, recorrente_id
  )
  select r.conta_id, d.membro_id, r.tipo, r.descricao, d.valor_centavos, r.categoria_id,
         p_mes, vencimento_no_mes(p_mes, r.dia_vencimento), 'recorrente', r.id
  from recorrentes r
  join contas ct on ct.id = r.conta_id
  join lateral (
    select distinct on (rd.membro_id) rd.membro_id, rd.valor_centavos
    from recorrente_divisoes rd
    where rd.recorrente_id = r.id and rd.vigente_desde <= p_mes
    order by rd.membro_id, rd.vigente_desde desc
  ) d on true
  where r.inicio <= p_mes
    and (ct.tipo = 'compartilhada' or d.membro_id = ct.dono_id)
    and (r.fim is null or r.fim >= p_mes)
    and d.valor_centavos > 0
    and not exists (
      select 1 from lancamentos l where l.recorrente_id = r.id and l.competencia = p_mes
    )
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_total := v_n;

  -- Compras parceladas: parcela N deste mês, para cada membro com valor > 0
  insert into lancamentos (
    conta_id, membro_id, tipo, descricao, valor_centavos, categoria_id,
    competencia, vencimento, origem, compra_id, parcela_numero
  )
  select c.conta_id, cd.membro_id, 'saida',
         c.descricao || ' (' || n.parcela || '/' || c.num_parcelas || ')',
         cd.valor_mensal_centavos, c.categoria_id,
         p_mes, vencimento_no_mes(p_mes, c.dia_vencimento), 'parcela', c.id, n.parcela
  from compras_parceladas c
  join contas ct on ct.id = c.conta_id
  cross join lateral (
    select ((extract(year from p_mes) - extract(year from c.primeira_competencia)) * 12
            + extract(month from p_mes) - extract(month from c.primeira_competencia))::int + 1 as parcela
  ) n
  join compra_divisoes cd on cd.compra_id = c.id
  where n.parcela between 1 and c.num_parcelas
    and (c.quitada_em is null or p_mes <= c.quitada_em)
    and cd.valor_mensal_centavos > 0
    and (ct.tipo = 'compartilhada' or cd.membro_id = ct.dono_id)
    and not exists (
      select 1 from lancamentos l where l.compra_id = c.id and l.competencia = p_mes
    )
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  return v_total;
end;
$$;

-- Numa conta pessoal, só o dono pode ter valor na divisão
create function public.validar_partes_da_conta(p_conta uuid, p_partes jsonb)
returns void
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if exists (
    select 1
    from contas c, jsonb_each_text(p_partes) e
    where c.id = p_conta and c.tipo = 'pessoal'
      and e.key::uuid <> c.dono_id and e.value::int > 0
  ) then
    raise exception 'Numa conta pessoal, só o dono da conta pode ter valor';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cria uma conta fixa com a divisão inicial. p_partes: {"<membro_id>": centavos, ...}
-- -----------------------------------------------------------------------------
create function public.criar_recorrente(
  p_conta uuid,
  p_tipo text,
  p_descricao text,
  p_categoria uuid,
  p_dia int,
  p_inicio date,
  p_partes jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform validar_partes_da_conta(p_conta, p_partes);

  insert into recorrentes (conta_id, tipo, descricao, categoria_id, dia_vencimento, inicio)
  values (p_conta, p_tipo, trim(p_descricao), p_categoria, p_dia, p_inicio)
  returning id into v_id;

  insert into recorrente_divisoes (recorrente_id, membro_id, valor_centavos, vigente_desde)
  select v_id, e.key::uuid, e.value::int, p_inicio
  from jsonb_each_text(p_partes) e;

  if not exists (select 1 from recorrente_divisoes where recorrente_id = v_id and valor_centavos > 0) then
    raise exception 'Informe o valor de pelo menos uma pessoa';
  end if;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Altera uma conta fixa a partir de um mês (regra 5 do CLAUDE.md):
-- - nova vigência da divisão a partir de p_desde (meses anteriores não mudam)
-- - atualiza lançamentos já gerados a partir de p_desde que não estão pagos
--   e não foram editados à mão; quem passou a 0 perde a linha; quem passou
--   a pagar ganha a linha nos meses já gerados
-- -----------------------------------------------------------------------------
create function public.alterar_recorrente(
  p_id uuid,
  p_desde date,
  p_descricao text,
  p_categoria uuid,
  p_dia int,
  p_partes jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if extract(day from p_desde) <> 1 then
    raise exception 'O mês de início deve ser o dia 1';
  end if;
  if not exists (select 1 from jsonb_each_text(p_partes) e where e.value::int > 0) then
    raise exception 'Informe o valor de pelo menos uma pessoa';
  end if;
  perform validar_partes_da_conta((select conta_id from recorrentes where id = p_id), p_partes);

  update recorrentes
     set descricao = trim(p_descricao), categoria_id = p_categoria, dia_vencimento = p_dia
   where id = p_id;
  if not found then
    raise exception 'Conta fixa não encontrada';
  end if;

  insert into recorrente_divisoes (recorrente_id, membro_id, valor_centavos, vigente_desde)
  select p_id, e.key::uuid, e.value::int, p_desde
  from jsonb_each_text(p_partes) e
  on conflict (recorrente_id, membro_id, vigente_desde)
    do update set valor_centavos = excluded.valor_centavos;

  update lancamentos l
     set descricao = trim(p_descricao),
         categoria_id = p_categoria,
         vencimento = vencimento_no_mes(l.competencia, p_dia),
         valor_centavos = (p_partes ->> l.membro_id::text)::int
   where l.recorrente_id = p_id
     and l.competencia >= p_desde
     and not l.pago
     and not l.editado_manualmente
     and coalesce((p_partes ->> l.membro_id::text)::int, 0) > 0;

  delete from lancamentos l
   where l.recorrente_id = p_id
     and l.competencia >= p_desde
     and not l.pago
     and not l.editado_manualmente
     and coalesce((p_partes ->> l.membro_id::text)::int, 0) = 0;

  insert into lancamentos (
    conta_id, membro_id, tipo, descricao, valor_centavos, categoria_id,
    competencia, vencimento, origem, recorrente_id
  )
  select r.conta_id, e.key::uuid, r.tipo, r.descricao, e.value::int, r.categoria_id,
         m.competencia, vencimento_no_mes(m.competencia, r.dia_vencimento), 'recorrente', r.id
  from recorrentes r
  cross join jsonb_each_text(p_partes) e
  join (
    select distinct competencia from lancamentos
    where recorrente_id = p_id and competencia >= p_desde
  ) m on true
  where r.id = p_id and e.value::int > 0
  on conflict do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Encerra uma conta fixa: p_ultimo_mes é o último mês em que ela aparece.
-- Remove lançamentos não pagos dos meses seguintes (regra 9).
-- -----------------------------------------------------------------------------
create function public.encerrar_recorrente(p_id uuid, p_ultimo_mes date)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update recorrentes set fim = p_ultimo_mes where id = p_id;
  if not found then
    raise exception 'Conta fixa não encontrada';
  end if;
  delete from lancamentos
   where recorrente_id = p_id and competencia > p_ultimo_mes and not pago;
end;
$$;

-- -----------------------------------------------------------------------------
-- Exclui uma conta fixa e todos os seus lançamentos, só se nenhum estiver pago
-- (regra 10). Com meses pagos, o caminho é encerrar.
-- -----------------------------------------------------------------------------
create function public.excluir_recorrente(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (select 1 from lancamentos where recorrente_id = p_id and pago) then
    raise exception 'Esta conta fixa já tem meses pagos. Use "Encerrar" em vez de excluir.';
  end if;
  delete from lancamentos where recorrente_id = p_id;
  delete from recorrentes where id = p_id;
  if not found then
    raise exception 'Conta fixa não encontrada';
  end if;
end;
$$;

-- Só usuários logados executam (o RLS ainda filtra quem é membro)
do $$
declare
  f text;
begin
  foreach f in array array[
    'gerar_competencia(date)',
    'criar_recorrente(uuid, text, text, uuid, int, date, jsonb)',
    'alterar_recorrente(uuid, date, text, uuid, int, jsonb)',
    'encerrar_recorrente(uuid, date)',
    'excluir_recorrente(uuid)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
