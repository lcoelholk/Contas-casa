-- =============================================================================
-- 0005 · Compras parceladas (geladeira, sofá, celular...)
-- Rodar no Supabase depois da 0004: SQL Editor → New query → colar tudo → Run
--
-- A geração das parcelas de cada mês já está em gerar_competencia (0004).
-- Aqui ficam as ações: criar, alterar, quitar antes do fim e excluir.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Cria a compra e quanto cada membro paga por mês. p_partes: {"<membro_id>": centavos}
-- -----------------------------------------------------------------------------
create function public.criar_compra(
  p_conta uuid,
  p_descricao text,
  p_categoria uuid,
  p_total int,
  p_parcelas int,
  p_primeira date,
  p_dia int,
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

  insert into compras_parceladas (
    conta_id, descricao, categoria_id, valor_total_centavos, num_parcelas, primeira_competencia, dia_vencimento
  )
  values (p_conta, trim(p_descricao), p_categoria, p_total, p_parcelas, p_primeira, p_dia)
  returning id into v_id;

  insert into compra_divisoes (compra_id, membro_id, valor_mensal_centavos)
  select v_id, e.key::uuid, e.value::int
  from jsonb_each_text(p_partes) e;

  if not exists (select 1 from compra_divisoes where compra_id = v_id and valor_mensal_centavos > 0) then
    raise exception 'Informe o valor de pelo menos uma pessoa';
  end if;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Altera descrição, categoria, dia e valor mensal de cada um, a partir de um mês.
-- Parcelas pagas, editadas à mão ou de meses anteriores não mudam.
-- (Número de parcelas, valor total e primeiro mês não mudam: para isso, exclua e crie de novo.)
-- -----------------------------------------------------------------------------
create function public.alterar_compra(
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
  perform validar_partes_da_conta((select conta_id from compras_parceladas where id = p_id), p_partes);

  update compras_parceladas
     set descricao = trim(p_descricao), categoria_id = p_categoria, dia_vencimento = p_dia
   where id = p_id;
  if not found then
    raise exception 'Compra não encontrada';
  end if;

  insert into compra_divisoes (compra_id, membro_id, valor_mensal_centavos)
  select p_id, e.key::uuid, e.value::int
  from jsonb_each_text(p_partes) e
  on conflict (compra_id, membro_id) do update set valor_mensal_centavos = excluded.valor_mensal_centavos;

  update lancamentos l
     set descricao = trim(p_descricao) || ' (' || l.parcela_numero || '/' || c.num_parcelas || ')',
         categoria_id = p_categoria,
         vencimento = vencimento_no_mes(l.competencia, p_dia),
         valor_centavos = (p_partes ->> l.membro_id::text)::int
    from compras_parceladas c
   where c.id = p_id
     and l.compra_id = p_id
     and l.parcela_numero is not null
     and l.competencia >= p_desde
     and not l.pago
     and not l.editado_manualmente
     and coalesce((p_partes ->> l.membro_id::text)::int, 0) > 0;

  delete from lancamentos l
   where l.compra_id = p_id
     and l.parcela_numero is not null
     and l.competencia >= p_desde
     and not l.pago
     and not l.editado_manualmente
     and coalesce((p_partes ->> l.membro_id::text)::int, 0) = 0;

  -- Quem passou a pagar ganha a parcela nos meses já gerados
  insert into lancamentos (
    conta_id, membro_id, tipo, descricao, valor_centavos, categoria_id,
    competencia, vencimento, origem, compra_id, parcela_numero
  )
  select c.conta_id, e.key::uuid, 'saida',
         c.descricao || ' (' || m.parcela_numero || '/' || c.num_parcelas || ')',
         e.value::int, c.categoria_id,
         m.competencia, vencimento_no_mes(m.competencia, c.dia_vencimento), 'parcela', c.id, m.parcela_numero
  from compras_parceladas c
  cross join jsonb_each_text(p_partes) e
  join (
    select distinct competencia, parcela_numero from lancamentos
    where compra_id = p_id and parcela_numero is not null and competencia >= p_desde
  ) m on true
  where c.id = p_id and e.value::int > 0
  on conflict do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Quita a compra no mês p_mes (regra 8): as parcelas não pagas dos meses seguintes
-- somem. Com p_lancar_saldo, o que faltava pagar de cada um entra neste mês como
-- "<descrição> (quitação)".
-- -----------------------------------------------------------------------------
create function public.quitar_compra(p_id uuid, p_mes date, p_lancar_saldo boolean)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_c compras_parceladas;
  v_n int;
begin
  select * into v_c from compras_parceladas where id = p_id;
  if not found then
    raise exception 'Compra não encontrada';
  end if;
  if v_c.quitada_em is not null then
    raise exception 'Esta compra já foi quitada';
  end if;

  v_n := ((extract(year from p_mes) - extract(year from v_c.primeira_competencia)) * 12
          + extract(month from p_mes) - extract(month from v_c.primeira_competencia))::int + 1;
  if v_n < 1 then
    raise exception 'A compra ainda não começou neste mês';
  end if;
  if v_n >= v_c.num_parcelas then
    raise exception 'Este já é o último mês da compra: não há o que quitar';
  end if;

  if p_lancar_saldo then
    insert into lancamentos (
      conta_id, membro_id, tipo, descricao, valor_centavos, categoria_id,
      competencia, vencimento, origem, compra_id
    )
    select v_c.conta_id, s.membro_id, 'saida', v_c.descricao || ' (quitação)', s.saldo, v_c.categoria_id,
           p_mes, vencimento_no_mes(p_mes, v_c.dia_vencimento), 'parcela', p_id
    from (
      select cd.membro_id,
             cd.valor_mensal_centavos * (
               (v_c.num_parcelas - v_n)
               - (select count(*) from lancamentos l
                   where l.compra_id = p_id and l.membro_id = cd.membro_id
                     and l.pago and l.parcela_numero > v_n)
             ) as saldo
      from compra_divisoes cd
      where cd.compra_id = p_id
    ) s
    where s.saldo > 0;
  end if;

  update compras_parceladas set quitada_em = p_mes where id = p_id;
  delete from lancamentos where compra_id = p_id and competencia > p_mes and not pago;
end;
$$;

-- -----------------------------------------------------------------------------
-- Exclui a compra e as parcelas, só se nenhuma estiver paga (regra 10).
-- -----------------------------------------------------------------------------
create function public.excluir_compra(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (select 1 from lancamentos where compra_id = p_id and pago) then
    raise exception 'Esta compra já tem parcelas pagas. Use "Quitar" em vez de excluir.';
  end if;
  delete from lancamentos where compra_id = p_id;
  delete from compras_parceladas where id = p_id;
  if not found then
    raise exception 'Compra não encontrada';
  end if;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'criar_compra(uuid, text, uuid, int, int, date, int, jsonb)',
    'alterar_compra(uuid, date, text, uuid, int, jsonb)',
    'quitar_compra(uuid, date, boolean)',
    'excluir_compra(uuid)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
