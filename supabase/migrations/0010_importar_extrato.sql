-- =============================================================================
-- 0010 · Importar extrato do banco (OFX/CSV)
-- Rodar no Supabase: SQL Editor → New query → colar tudo → Run
--
-- O app lê o arquivo no celular e manda só as linhas escolhidas para
-- importar_lancamentos. Cada linha traz um identificador do banco (id_externo):
-- importar o mesmo extrato de novo não duplica nada.
-- =============================================================================

alter table public.lancamentos add column id_externo text;

create unique index lanc_id_externo_unico
  on public.lancamentos (conta_id, membro_id, id_externo)
  where id_externo is not null;

-- -----------------------------------------------------------------------------
-- p_itens: [{"data": "2026-11-05", "descricao": "Padaria", "centavos": -2390, "id": "ofx:abc"}]
--   centavos negativo = gasto; positivo = entrada
-- Numa aba pessoal, tudo vai para o dono (gastos e entradas).
-- Numa compartilhada, só gastos: divididos igual, a parte de quem importou já paga
-- e a do outro a pagar (como no gasto rápido). Entradas são ignoradas.
-- Tudo entra como já pago, no mês da data. Devolve quantas entraram e quantas já existiam.
-- -----------------------------------------------------------------------------
create function public.importar_lancamentos(p_conta uuid, p_itens jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_eu        uuid;
  v_conta     contas%rowtype;
  v_membros   uuid[];
  v_item      jsonb;
  v_data      date;
  v_centavos  int;
  v_desc      text;
  v_id        text;
  v_cat       uuid;
  v_grupo     uuid;
  v_parte     int;
  v_resto     int;
  v_valor_m   int;
  m           uuid;
  v_novos     int := 0;
  v_repetidos int := 0;
  v_ignorados int := 0;
  v_linhas    int;
begin
  select id into v_eu from membros where user_id = auth.uid();
  if v_eu is null then
    raise exception 'Usuário não liberado';
  end if;

  select * into v_conta from contas where id = p_conta and not arquivada;
  if v_conta.id is null then
    raise exception 'Aba não encontrada';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) > 1000 then
    raise exception 'Envie de 1 a 1000 linhas por vez';
  end if;

  select array_agg(id order by criado_em) into v_membros from membros;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_data     := (v_item->>'data')::date;
    v_centavos := (v_item->>'centavos')::int;
    v_desc     := left(coalesce(nullif(trim(v_item->>'descricao'), ''), 'Sem descrição'), 200);
    v_id       := nullif(trim(v_item->>'id'), '');
    if v_data is null or v_centavos is null or v_centavos = 0 or v_id is null then
      raise exception 'Linha inválida: %', v_item;
    end if;

    if v_conta.tipo = 'compartilhada' and v_centavos > 0 then
      v_ignorados := v_ignorados + 1;
      continue;
    end if;

    v_cat := case when v_centavos < 0 then categoria_do_texto(v_desc)
                  else (select id from categorias where tipo = 'entrada' and not arquivada
                        and nome = case when v_desc ~* 'sal[aá]rio' then 'Salário'
                                        when v_desc ~* '(estorno|reembolso)' then 'Reembolso'
                                        else 'Outros' end limit 1) end;

    if v_conta.tipo = 'pessoal' then
      insert into lancamentos (conta_id, membro_id, tipo, descricao, valor_centavos, categoria_id,
                               competencia, pago, pago_em, criado_por, id_externo)
      values (v_conta.id, v_conta.dono_id, case when v_centavos < 0 then 'saida' else 'entrada' end,
              v_desc, abs(v_centavos), v_cat, date_trunc('month', v_data)::date, true, v_data, v_eu, v_id)
      on conflict (conta_id, membro_id, id_externo) where id_externo is not null do nothing;
      get diagnostics v_linhas = row_count;
    else
      -- Já importada antes? (basta uma das partes existir)
      if exists (select 1 from lancamentos where conta_id = v_conta.id and id_externo = v_id) then
        v_linhas := 0;
      else
        v_grupo := gen_random_uuid();
        v_parte := abs(v_centavos) / array_length(v_membros, 1);
        v_resto := abs(v_centavos) - v_parte * array_length(v_membros, 1);
        foreach m in array v_membros loop
          v_valor_m := v_parte + case when m = v_eu then v_resto else 0 end;
          continue when v_valor_m = 0;
          insert into lancamentos (conta_id, membro_id, tipo, descricao, valor_centavos, categoria_id,
                                   competencia, pago, pago_em, grupo_id, criado_por, id_externo)
          values (v_conta.id, m, 'saida', v_desc, v_valor_m, v_cat, date_trunc('month', v_data)::date,
                  m = v_eu, case when m = v_eu then v_data end, v_grupo, v_eu, v_id);
        end loop;
        v_linhas := 1;
      end if;
    end if;

    if v_linhas > 0 then
      v_novos := v_novos + 1;
    else
      v_repetidos := v_repetidos + 1;
    end if;
  end loop;

  return jsonb_build_object('novos', v_novos, 'repetidos', v_repetidos, 'ignorados', v_ignorados);
end;
$$;

revoke all on function public.importar_lancamentos(uuid, jsonb) from public, anon;
grant execute on function public.importar_lancamentos(uuid, jsonb) to authenticated;
