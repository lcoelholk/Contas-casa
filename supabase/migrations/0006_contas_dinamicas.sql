-- =============================================================================
-- 0006 · Contas (abas) dinâmicas
-- Rodar no Supabase: SQL Editor → New query → colar tudo → Run
--
-- - Conta arquivada não gera mais contas fixas nem parcelas (o histórico fica).
-- - Tipo e dono de uma conta não mudam depois de criada: os lançamentos
--   antigos dependem disso (conta pessoal só tem lançamentos do dono).
-- =============================================================================

-- Mesma geração da 0004, ignorando contas arquivadas
create or replace function public.gerar_competencia(p_mes date)
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
    and not ct.arquivada
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
    and not ct.arquivada
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

create function public.travar_tipo_e_dono_da_conta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.tipo is distinct from old.tipo or new.dono_id is distinct from old.dono_id then
    raise exception 'O tipo e o dono de uma conta não podem ser alterados';
  end if;
  return new;
end;
$$;

create trigger contas_tipo_e_dono_fixos
  before update of tipo, dono_id on public.contas
  for each row execute function public.travar_tipo_e_dono_da_conta();
