-- =============================================================================
-- 0009 · Gasto rápido pelo atalho do iPhone (Tocar Atrás)
-- Rodar no Supabase: SQL Editor → New query → colar tudo → Run
--
-- O app Atalhos do iPhone pergunta "quanto?" e "o quê?" e chama lancar_rapido
-- direto, sem abrir o app. Quem chama se identifica por um código secreto
-- (gerado em Ajustes → Atalho do iPhone), guardado aqui só como hash.
-- =============================================================================

-- Um código por pessoa. Gerar de novo troca o código (o antigo para de funcionar)
create table public.atalhos (
  membro_id   uuid primary key references public.membros(id) on delete cascade,
  token_hash  text not null unique,
  criado_em   timestamptz not null default now(),
  usado_em    timestamptz
);

-- Mesma segurança das outras tabelas (ver 0002). Fica fora do tempo real:
-- nenhuma tela precisa saber na hora que o código foi usado.
alter table public.atalhos enable row level security;
create policy "membros acessam tudo" on public.atalhos
  for all to authenticated
  using (public.eh_membro())
  with check (public.eh_membro());
revoke all on public.atalhos from anon;
grant select, insert, update, delete on public.atalhos to authenticated;

-- -----------------------------------------------------------------------------
-- Cria (ou troca) o código de quem está logado e devolve o código em texto.
-- Ele só aparece esta vez: no banco fica só o hash.
-- -----------------------------------------------------------------------------
create function public.gerar_token_atalho()
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_membro uuid;
  v_token  text;
begin
  select id into v_membro from membros where user_id = auth.uid();
  if v_membro is null then
    raise exception 'Usuário não liberado';
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into atalhos (membro_id, token_hash)
  values (v_membro, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
  on conflict (membro_id) do update
    set token_hash = excluded.token_hash, criado_em = now(), usado_em = null;
  return v_token;
end;
$$;

revoke all on function public.gerar_token_atalho() from public, anon;
grant execute on function public.gerar_token_atalho() to authenticated;

-- -----------------------------------------------------------------------------
-- Texto do valor → centavos. Aceita "12,50", "12.5", "R$ 1.234,56" e "1.500".
-- -----------------------------------------------------------------------------
create function public.valor_em_centavos(p_valor text)
returns int
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := regexp_replace(coalesce(p_valor, ''), '[^0-9,.]', '', 'g');
begin
  if v = '' then
    return null;
  end if;
  if position(',' in v) > 0 then
    v := replace(replace(v, '.', ''), ',', '.');      -- 1.234,56 → 1234.56
  elsif v ~ '^\d{1,3}(\.\d{3})+$' then
    v := replace(v, '.', '');                          -- 1.500 → 1500
  end if;
  if v !~ '^\d+(\.\d+)?$' then
    return null;
  end if;
  return round(v::numeric * 100)::int;
end;
$$;

-- -----------------------------------------------------------------------------
-- Categoria pelo que foi escrito ("ifood" → Alimentação fora). Sem palpite: Outros
-- -----------------------------------------------------------------------------
create function public.categoria_do_texto(p_texto text)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  t      text := translate(lower(coalesce(p_texto, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  v_nome text;
begin
  v_nome := case
    when t ~ '(mercado livre|shopee|amazon|roupa|loja|shopping)' then 'Compras'
    when t ~ '(mercado|feira|padaria|acougue|hortifruti|atacad|assai|carrefour)' then 'Mercado'
    when t ~ '(ifood|restaurante|lanche|pizza|hamburguer|burger|almoco|jantar|cafe|bar\M|sorvete|delivery)' then 'Alimentação fora'
    when t ~ '(uber|\m99\M|taxi|gasolina|combustivel|posto|onibus|metro|estacionamento|pedagio)' then 'Transporte'
    when t ~ '(farmacia|remedio|medic|consulta|exame|dentista|hospital)' then 'Saúde'
    when t ~ '(netflix|spotify|prime|disney|hbo|max\M|youtube|assinatura|icloud)' then 'Assinaturas'
    when t ~ '(cinema|show|ingresso|passeio|viagem|festa)' then 'Lazer'
    when t ~ '(pet|racao|veterinari|banho e tosa)' then 'Pets'
    when t ~ '(luz|energia|agua|internet|gas\M|celular|telefone)' then 'Contas de consumo'
    when t ~ '(aluguel|condominio|iptu)' then 'Moradia'
    when t ~ '(curso|livro|escola|faculdade)' then 'Educação'
    else 'Outros'
  end;
  return (select id from categorias where tipo = 'saida' and not arquivada and nome = v_nome limit 1);
end;
$$;

-- -----------------------------------------------------------------------------
-- Lança um gasto já pago, hoje, a partir do atalho.
--   p_onde: vazio/"meu" = na sua aba principal; o nome de uma aba ("Casa", "Viagem")
--           = nela. Numa compartilhada, divide igual entre vocês (a sua parte já
--           paga, a do outro a pagar)
--   p_categoria: nome da categoria (opcional; sem ela, adivinha pela descrição)
-- Devolve uma frase para o iPhone mostrar ("R$ 12,50 em Mercado: Padaria").
-- -----------------------------------------------------------------------------
create function public.lancar_rapido(
  p_token     text,
  p_valor     text,
  p_descricao text default null,
  p_onde      text default null,
  p_categoria text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membro    uuid;
  v_centavos  int := valor_em_centavos(p_valor);
  v_hoje      date := (now() at time zone 'America/Sao_Paulo')::date;
  v_comp      date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  v_desc      text := left(coalesce(nullif(trim(p_descricao), ''), 'Gasto rápido'), 200);
  v_onde      text := translate(lower(trim(coalesce(p_onde, ''))), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  v_casa      boolean;
  v_conta     contas%rowtype;
  v_categoria uuid;
  v_nome_cat  text;
  v_grupo     uuid := gen_random_uuid();
  v_membros   uuid[];
  v_parte     int;
  v_resto     int;
  m           uuid;
  v_valor_m   int;
begin
  select a.membro_id into v_membro
  from atalhos a
  where a.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  if v_membro is null then
    raise exception 'Atalho não reconhecido. Gere um código novo em Ajustes.';
  end if;

  if v_centavos is null or v_centavos <= 0 then
    raise exception 'Valor inválido: %', coalesce(p_valor, '(vazio)');
  end if;
  if v_centavos > 100000000 then
    raise exception 'Valor alto demais para um gasto rápido';
  end if;

  if v_onde = '' or v_onde ~ '^(meu|minha|eu|pessoal|so meu|so minha)$' then
    -- Na sua aba principal (a pessoal mais antiga)
    select * into v_conta from contas
    where tipo = 'pessoal' and dono_id = v_membro and not arquivada
    order by criado_em limit 1;
  else
    -- Uma aba pelo nome ("Casa", "Viagem"): compartilhada ou sua
    select * into v_conta from contas
    where not arquivada
      and (tipo = 'compartilhada' or dono_id = v_membro)
      and translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = v_onde
    order by ordem limit 1;
    -- "dividido", "nós dois": a primeira compartilhada
    if v_conta.id is null and v_onde ~ '^(casa|dividid|compartilhad|nos dois|os dois)' then
      select * into v_conta from contas
      where tipo = 'compartilhada' and not arquivada
      order by ordem, criado_em limit 1;
    end if;
  end if;
  if v_conta.id is null then
    raise exception 'Não achei a aba "%"', coalesce(nullif(trim(p_onde), ''), 'sua');
  end if;
  v_casa := v_conta.tipo = 'compartilhada';

  if nullif(trim(p_categoria), '') is not null then
    select id into v_categoria from categorias
    where tipo = 'saida' and not arquivada and lower(nome) = lower(trim(p_categoria)) limit 1;
  end if;
  v_categoria := coalesce(v_categoria, categoria_do_texto(v_desc));
  select nome into v_nome_cat from categorias where id = v_categoria;

  if v_casa then
    -- Divide igual; os centavos que sobram ficam com quem lançou
    select array_agg(id order by criado_em) into v_membros from membros;
    v_parte := v_centavos / array_length(v_membros, 1);
    v_resto := v_centavos - v_parte * array_length(v_membros, 1);
    foreach m in array v_membros loop
      v_valor_m := v_parte + case when m = v_membro then v_resto else 0 end;
      continue when v_valor_m = 0;
      insert into lancamentos (conta_id, membro_id, tipo, descricao, valor_centavos, categoria_id,
                               competencia, pago, pago_em, grupo_id, criado_por)
      values (v_conta.id, m, 'saida', v_desc, v_valor_m, v_categoria,
              v_comp, m = v_membro, case when m = v_membro then v_hoje end, v_grupo, v_membro);
    end loop;
  else
    insert into lancamentos (conta_id, membro_id, tipo, descricao, valor_centavos, categoria_id,
                             competencia, pago, pago_em, criado_por)
    values (v_conta.id, v_membro, 'saida', v_desc, v_centavos, v_categoria,
            v_comp, true, v_hoje, v_membro);
  end if;

  update atalhos set usado_em = now() where membro_id = v_membro;

  return 'R$ ' || replace(replace(replace(to_char(v_centavos / 100.0, 'FM999G999G990D00'), ',', '#'), '.', ','), '#', '.')
    || coalesce(' em ' || v_nome_cat, '') || ': ' || v_desc
    || case when v_casa then ' (' || v_conta.nome || ', dividido)' else '' end;
end;
$$;

-- O atalho chama sem login (só com a chave pública do app): o código secreto é a senha
revoke all on function public.lancar_rapido(text, text, text, text, text) from public;
grant execute on function public.lancar_rapido(text, text, text, text, text) to anon, authenticated;
revoke all on function public.valor_em_centavos(text) from public, anon;
revoke all on function public.categoria_do_texto(text) from public, anon;
grant execute on function public.valor_em_centavos(text) to authenticated;
grant execute on function public.categoria_do_texto(text) to authenticated;
