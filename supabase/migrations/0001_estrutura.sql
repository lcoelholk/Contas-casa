-- =============================================================================
-- 0001 · Estrutura do banco
-- Rodar no Supabase: SQL Editor → New query → colar tudo → Run
-- =============================================================================

-- Pessoas do casal (ligadas ao login do Supabase)
create table public.membros (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references auth.users(id) on delete set null,
  nome       text not null check (length(trim(nome)) > 0),
  cor        text,
  criado_em  timestamptz not null default now()
);

-- Abas: pessoais (com dono) ou compartilhadas (sem dono, com divisão)
create table public.contas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(trim(nome)) > 0),
  tipo       text not null check (tipo in ('pessoal', 'compartilhada')),
  dono_id    uuid references public.membros(id),
  cor        text,
  ordem      int  not null default 0,
  arquivada  boolean not null default false,
  criado_em  timestamptz not null default now(),
  constraint contas_dono_conforme_tipo check (
    (tipo = 'pessoal' and dono_id is not null) or
    (tipo = 'compartilhada' and dono_id is null)
  )
);

create table public.categorias (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(trim(nome)) > 0),
  tipo       text not null check (tipo in ('saida', 'entrada')),
  icone      text,
  arquivada  boolean not null default false,
  unique (nome, tipo)
);

-- Contas que se repetem todo mês (aluguel, luz, academia...)
create table public.recorrentes (
  id              uuid primary key default gen_random_uuid(),
  conta_id        uuid not null references public.contas(id),
  descricao       text not null check (length(trim(descricao)) > 0),
  categoria_id    uuid references public.categorias(id),
  dia_vencimento  int check (dia_vencimento between 1 and 31),
  inicio          date not null,   -- 1º dia do mês de início
  fim             date,            -- null = sem fim
  criado_em       timestamptz not null default now(),
  constraint recorrentes_inicio_dia_1 check (extract(day from inicio) = 1),
  constraint recorrentes_fim_dia_1    check (fim is null or extract(day from fim) = 1),
  constraint recorrentes_fim_depois   check (fim is null or fim >= inicio)
);

-- Quanto cada membro paga de cada recorrente, a partir de qual mês
create table public.recorrente_divisoes (
  id              uuid primary key default gen_random_uuid(),
  recorrente_id   uuid not null references public.recorrentes(id) on delete cascade,
  membro_id       uuid not null references public.membros(id),
  valor_centavos  int  not null check (valor_centavos >= 0),
  vigente_desde   date not null,
  unique (recorrente_id, membro_id, vigente_desde),
  constraint divisoes_vigencia_dia_1 check (extract(day from vigente_desde) = 1)
);

-- Compras parceladas (geladeira, sofá...)
create table public.compras_parceladas (
  id                    uuid primary key default gen_random_uuid(),
  conta_id              uuid not null references public.contas(id),
  descricao             text not null check (length(trim(descricao)) > 0),
  categoria_id          uuid references public.categorias(id),
  valor_total_centavos  int  not null check (valor_total_centavos > 0),
  num_parcelas          int  not null check (num_parcelas between 1 and 120),
  primeira_competencia  date not null,
  dia_vencimento        int  check (dia_vencimento between 1 and 31),
  quitada_em            date,
  criado_em             timestamptz not null default now(),
  constraint compras_primeira_dia_1 check (extract(day from primeira_competencia) = 1),
  constraint compras_quitada_dia_1  check (quitada_em is null or extract(day from quitada_em) = 1)
);

-- Quanto cada membro paga por mês de cada compra
create table public.compra_divisoes (
  id                     uuid primary key default gen_random_uuid(),
  compra_id              uuid not null references public.compras_parceladas(id) on delete cascade,
  membro_id              uuid not null references public.membros(id),
  valor_mensal_centavos  int  not null check (valor_mensal_centavos >= 0),
  unique (compra_id, membro_id)
);

-- Cada linha de dinheiro
create table public.lancamentos (
  id                   uuid primary key default gen_random_uuid(),
  conta_id             uuid not null references public.contas(id),
  membro_id            uuid not null references public.membros(id),
  tipo                 text not null check (tipo in ('saida', 'entrada')),
  descricao            text not null check (length(trim(descricao)) > 0),
  valor_centavos       int  not null check (valor_centavos > 0),
  categoria_id         uuid references public.categorias(id),
  competencia          date not null,
  vencimento           date,
  pago                 boolean not null default false,
  pago_em              date,
  origem               text not null default 'avulso'
                         check (origem in ('avulso', 'recorrente', 'parcela')),
  recorrente_id        uuid references public.recorrentes(id) on delete set null,
  compra_id            uuid references public.compras_parceladas(id) on delete set null,
  parcela_numero       int check (parcela_numero is null or parcela_numero >= 1),
  grupo_id             uuid,
  editado_manualmente  boolean not null default false,
  observacao           text,
  criado_por           uuid references public.membros(id),
  criado_em            timestamptz not null default now(),
  constraint lancamentos_competencia_dia_1 check (extract(day from competencia) = 1),
  constraint lancamentos_pago_em check (pago or pago_em is null)
);

-- Impede duplicar lançamentos gerados (a geração do mês pode rodar várias vezes)
create unique index lanc_recorrente_unico
  on public.lancamentos (recorrente_id, membro_id, competencia)
  where recorrente_id is not null;

create unique index lanc_parcela_unica
  on public.lancamentos (compra_id, membro_id, parcela_numero)
  where compra_id is not null;

create index lanc_competencia on public.lancamentos (competencia);
create index lanc_membro_comp on public.lancamentos (membro_id, competencia);
create index lanc_conta_comp  on public.lancamentos (conta_id, competencia);
create index lanc_grupo       on public.lancamentos (grupo_id) where grupo_id is not null;

-- Numa conta pessoal, o lançamento tem que ser do dono da conta
create function public.validar_lancamento_conta_pessoal()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tipo text;
  v_dono uuid;
begin
  select tipo, dono_id into v_tipo, v_dono from contas where id = new.conta_id;
  if v_tipo = 'pessoal' and new.membro_id <> v_dono then
    raise exception 'Lançamento em conta pessoal precisa ser do dono da conta';
  end if;
  return new;
end;
$$;

create trigger lancamentos_conta_pessoal
  before insert or update of conta_id, membro_id on public.lancamentos
  for each row execute function public.validar_lancamento_conta_pessoal();
