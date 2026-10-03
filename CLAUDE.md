# Finanças do Casal — Documento do Projeto

App web (instalável no celular) para Lucas e Emillia organizarem as finanças pessoais e as da casa, com divisão livre dos gastos compartilhados. Custo zero: código no GitHub, banco no Supabase (plano gratuito), hospedagem no GitHub Pages.

> Este arquivo é a fonte de verdade do projeto. Antes de implementar qualquer coisa, leia a seção relevante. Se uma decisão mudar, atualize este documento junto com o código.

---

## 1. Visão geral

### Objetivo
- Cada um vê as próprias contas (fixas e avulsas) e a sua parte nas despesas da casa, numa aba só.
- As despesas da casa são divididas de forma **livre**: para cada item, define-se quanto cada pessoa paga. A divisão pode mudar de um mês para o outro, porque a renda muda.
- Compras grandes da casa (ex.: geladeira) são parceladas, e a parte mensal de cada um entra sozinha na aba de cada pessoa até a última parcela.
- É possível criar novas contas/abas além das três iniciais.

### Usuários
Dois usuários, cada um com login próprio (e-mail). Os dois veem e editam **todos** os dados. Não existe dado privado entre eles na v1.

### Abas iniciais
| Aba | Tipo | O que mostra |
|---|---|---|
| Lucas | pessoal | Gastos, entradas e contas do Lucas + a parte dele nas contas compartilhadas |
| Emillia | pessoal | Idem, para a Emillia |
| Casa | compartilhada | Contas recorrentes da casa, compras parceladas e gastos avulsos da casa, com a divisão de cada um |

Botão **"+ Nova conta"** cria outra aba, pessoal (tem dono) ou compartilhada (funciona igual à Casa). Exemplos: Viagem, Pet, Carro.

**Aba principal de cada pessoa:** é a conta pessoal ativa mais antiga dela (Lucas, Emillia). Ela reúne tudo da pessoa no mês: a própria conta, as outras contas pessoais dela e a parte dela nas compartilhadas. Outra conta pessoal criada depois (ex.: "Carro" do Lucas) mostra só os próprios lançamentos.

---

## 2. Conceitos

**Conta (aba):** agrupador de lançamentos. Pode ser `pessoal`, com um dono, ou `compartilhada`, sem dono e com divisão entre membros.

**Lançamento:** uma linha de dinheiro, que pode ser uma saída ou uma entrada. Tem valor, categoria, **competência** (o mês a que pertence), vencimento opcional e status pago / não pago. Todo lançamento pertence a **uma conta** e a **um membro**, que é quem paga ou recebe.

**Competência:** o mês de referência do lançamento, guardado como o primeiro dia do mês (`2026-10-01`). É o que define em que mês o lançamento aparece. A data de vencimento é separada.

**Conta recorrente:** despesa que se repete todo mês numa conta compartilhada (aluguel, luz, internet, mercado). Cada recorrente tem uma **divisão por membro** com vigência: "a partir de outubro, Lucas R$ 1.200 e Emillia R$ 800". Quando a divisão muda, cria-se uma nova vigência; os meses anteriores não mudam.
- Contas fixas **pessoais** (ex.: academia do Lucas) usam a mesma estrutura, numa conta pessoal, com divisão de 100% para o dono.

**Compra parcelada:** compra com valor total e número de parcelas, com valor mensal por membro. Exemplo: geladeira de R$ 3.600 em 12x, Lucas R$ 150/mês e Emillia R$ 150/mês. Gera uma parcela por mês para cada membro até terminar.

**Gasto avulso compartilhado:** gasto único numa conta compartilhada (ex.: compra de R$ 300 no mercado). Ao lançar, informa-se quanto cabe a cada um (atalhos: 50/50, tudo para um, valores livres). Gera um lançamento por membro, ligados pelo mesmo `grupo_id`.

### Como a parte da casa aparece na aba pessoal
A aba **Lucas** mostra todos os lançamentos com `membro_id = Lucas`, de qualquer conta, agrupados assim:
- **Pessoal:** lançamentos da conta pessoal do Lucas
- **Casa** (e outras compartilhadas): a parte do Lucas em cada item, com um selo indicando a origem (recorrente, parcela X/12, avulso)

A aba **Casa** mostra todos os lançamentos da conta Casa, agrupados por item, com a parte de cada membro lado a lado.

---

## 3. Funcionalidades da v1

### Geral
- Login por e-mail e senha (Supabase Auth)
- Seletor de mês (← outubro 2026 →) em todas as telas; o padrão é o mês atual
- Sincronização em tempo real: o que um lança, o outro vê sem recarregar (Supabase Realtime)
- Interface em português, pensada primeiro para celular
- Valores em reais, formatados com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`

### Navegação
- **Barra fixa embaixo:** Início · Transações · **(+)** · Análises · Mais
- **(+)** abre "novo lançamento" de qualquer tela: escolhe a aba (as de quem entrou primeiro) e o tipo (só desta vez, todo mês, parcelado)
- **Análises** = Gráficos + Metas e limites (alternados no topo)
- **Mais:** suas contas (a sua aba e as compartilhadas), Contas fixas, Nova conta, Ajustes, as abas do outro ("Do outro") e Sair
- **Filtros e ordenação ficam escondidos:** cada tela com filtro mostra só os botões **Filtrar** e **Ordenar** (`BarraFiltros` em `src/components/Filtros.tsx`). Filtrar abre um painel com as opções em etiquetas; os filtros ligados aparecem como etiquetas com ✕ (e "Limpar tudo"). Vale para Início, Transações e Gráficos.
- **Cada um vê primeiro o que é seu:** o filtro de pessoa (Início, Transações, Gráficos) começa em quem entrou e vale para todas as telas até sair do app (`usePessoa`); um toque troca para "Os dois". Os dados continuam compartilhados (RLS igual).

### Início (antigo "Resumo"/"Visão geral")
- Atalhos: ir para "Minhas contas" e as compartilhadas, e lançar gasto, conta fixa ou parcelado sem trocar de tela
- Filtro de pessoa no topo; cards de pessoa e vencimentos seguem o filtro
- **Como está o mês:** frase comparando o gasto até hoje com o mesmo ponto do mês passado, gasto até hoje, variação % e maior categoria
- **Ritmo de gastos:** linha do gasto acumulado dia a dia, este mês vs mês passado
- Lista **"Vence nos próximos 7 dias"** e **atrasados** (não pagos, dos dois)
- Card por membro (a pagar, pago, pendente, entradas, saldo) e card de cada conta compartilhada
- Aviso de limite de gastos perto ou estourado
- **Mapa de calor:** calendário do mês com a cor de cada dia pelo quanto foi gasto
- **Transações recentes** (últimas lançadas no mês) e **principais categorias** vs mês anterior
- "Data" de um lançamento (para ritmo, mapa e listas) = vencimento, senão quando foi pago, senão quando foi lançado; fora do mês da competência vira o dia 1 (`dataDoLancamento` em `src/lib/visaoGeral.ts`)

### Transações (tela "Transações")
- Todas as linhas do período (mês do seletor ou últimos 3/6/12 meses), com busca (sem acento) e filtros: pessoa, conta, tipo, situação, categoria e ordem
- Totais do que está filtrado: quantidade, gastos, entradas e saldo
- Marcar pago direto na lista; tocar abre a aba da conta no mês certo
- "Nova transação": escolhe a conta e abre o formulário dela

### Aba de pessoa (Lucas / Emillia)
- Lista do mês agrupada em Pessoal e cada conta compartilhada
- Marcar como pago / desfazer, com um toque
- Adicionar gasto, entrada ou conta fixa pessoal
- Totais no topo: a pagar, pago, pendente, entradas, saldo

### Aba Casa (e outras compartilhadas)
- **Contas recorrentes:** lista com valor do mês e divisão; criar, editar, alterar divisão "a partir do mês X" e encerrar
- **Compras parceladas:** lista com progresso (ex.: 4/12), valor restante e divisão; criar, editar e quitar antecipadamente
- **Avulsos do mês:** lista com divisão; adicionar com atalhos 50/50, "tudo Lucas", "tudo Emillia" e "valores livres"
- Total do mês e total por membro

### Contas (abas) dinâmicas
- Criar conta: nome, tipo (pessoal com dono, ou compartilhada), cor
- Renomear, mudar a cor, reordenar e arquivar. Arquivar esconde a aba mas mantém o histórico; na v1 não existe excluir conta com lançamentos.
- Tipo e dono **não mudam** depois de criada (trigger na migration 0006).
- Conta arquivada **não gera** mais contas fixas nem parcelas; desarquivar volta a gerar. Se ainda tiver lançamentos no mês aberto, ela continua aparecendo na aba da pessoa e no Resumo.

### Contas fixas (tela "Contas fixas")
- Todas as contas fixas ativas no mês, agrupadas por aba (Casa, Lucas, Emillia...), com dia de vencimento e quanto cada um paga
- Total fixo por mês de cada pessoa (e entradas fixas, como salário)
- "Começam depois" e "Encerradas" em listas recolhidas; tocar abre a edição
- "+ Nova conta fixa": escolhe a aba e abre o formulário
- **Até quando:** sem data limite (academia) ou até um mês (aluguel com contrato). Com limite, a lista mostra "até jul/27 · faltam 9 meses". Criar com limite = `criar_recorrente` + `encerrar_recorrente`; tirar o limite = `fim = null` (a geração volta a criar os meses)

### Novo lançamento em qualquer conta
- `NovoLancamento` (Transações e Contas fixas): escolhe a aba e depois o tipo: **só desta vez** (avulso), **todo mês** (conta fixa) ou **parcelado**

### Gráficos (tela "Gráficos")
- Filtros no topo: período (3, 6 ou 12 meses, terminando no mês do seletor) e pessoa (os dois, Lucas, Emillia)
- Números do período: gasto do mês vs média dos anteriores, gasto médio, entrada média, quanto sobrou das entradas
- Entradas e gastos mês a mês (colunas; tocar mostra o saldo)
- Gastos por categoria no período; tocar numa categoria mostra a evolução dela mês a mês
- Divisão das contas compartilhadas entre os dois (quem pagou quanto)
- Próximos 6 meses: o que já está comprometido (contas fixas, parcelas, outros)
- Gráficos em SVG próprio (`src/components/graficos.tsx`), sem biblioteca: barras finas, legenda, toque mostra valores e "Ver em tabela" mostra os números

### Metas (tela "Metas")
- **Metas de economia:** nome, valor, de quem (dos dois ou de uma pessoa), prazo opcional e cor. Guardar e retirar dinheiro (aportes), com histórico. Com prazo, mostra quanto guardar por mês. Arquivar ou excluir.
- **Limite de gastos:** limite mensal por categoria, de uma pessoa ou dos dois somados. Barra com status (dentro, perto a partir de 80%, passou). Os limites perto ou acima aparecem também no Resumo.
- Guardar dinheiro numa meta **não** vira lançamento: é só um registro do quanto foi separado.

### Tema claro/escuro e legibilidade
- **Padrão: segue o celular** (automático). Em Ajustes → Aparência: Automático, Claro ou Escuro, guardado no aparelho (`src/lib/tema.ts`; o `index.html` aplica antes de desenhar para não piscar)
- Escuro = classe `dark` no `<html>`; `src/index.css` troca os valores das cores (cinzas invertidos, tons de aviso escuros, textos coloridos mais claros, séries dos gráficos validadas para o fundo escuro). As telas usam as mesmas classes; fundo de cartão é `bg-superficie` (nunca `bg-white`). Para ajuste só no escuro: `dark:`
- **Contraste mínimo 4,5:1** para texto nos dois temas: texto secundário é `text-stone-500` ou mais forte (nada de `text-stone-400` em texto); botões com letra branca usam `marca-600`, `red-600`, `amber-600` ou `emerald-600` (escurecidos no `@theme`); letra mínima 11px

### Configurações (tela "Ajustes")
- Aparência: tema automático, claro ou escuro
- Contas: criar, editar, reordenar (↑ ↓), arquivar e desarquivar
- Categorias: criar, renomear, trocar ícone, arquivar e desarquivar. Arquivada some dos formulários, mas os lançamentos antigos continuam com ela.
- Nome e cor de cada membro

---

## 4. Regras de negócio

1. **Dinheiro em centavos (inteiro).** Nunca usar `float` para valores. `R$ 12,50` é guardado como `1250`. Converter só na exibição e na entrada de dados.
2. **Fuso horário:** `America/Sao_Paulo`. "Hoje" e "mês atual" são calculados nesse fuso.
3. **Geração de lançamentos:** recorrentes e parcelas viram lançamentos pela função `gerar_competencia(mes)` (seção 6), chamada pelo app sempre que um mês é aberto. A função é **idempotente**: chamar duas vezes não duplica nada.
4. **Vencimento em mês curto:** se o dia de vencimento é 31 e o mês tem 30 dias, usa o último dia do mês.
5. **Mudança de divisão de uma recorrente** a partir do mês X:
   - cria nova linha em `recorrente_divisoes` com `vigente_desde = X`
   - atualiza os lançamentos **não pagos** dessa recorrente com competência ≥ X
   - não mexe em lançamentos pagos nem em meses anteriores a X
6. **Membro com valor 0** numa divisão não recebe lançamento naquele mês.
7. **Compra parcelada:** a soma das partes × número de parcelas pode diferir do valor total (juros, arredondamento). O app mostra a diferença como aviso, sem bloquear.
8. **Quitar compra antecipadamente:** marca a compra como quitada no mês escolhido e remove as parcelas **não pagas** das competências seguintes.
9. **Encerrar recorrente:** define `fim`; os lançamentos não pagos de meses depois do fim são removidos.
10. **Excluir recorrente ou compra** só é permitido se nenhum lançamento dela estiver pago. Caso contrário, só encerrar ou quitar.
11. **Editar um lançamento gerado** (ex.: a conta de luz deste mês veio R$ 30 mais cara) altera só aquele lançamento, e ele passa a ter `editado_manualmente = true`. Mudanças posteriores na divisão não sobrescrevem lançamentos editados manualmente.

---

## 5. Stack técnica

| Parte | Escolha | Observação |
|---|---|---|
| Front-end | React + Vite + TypeScript | |
| Estilo | Tailwind CSS | Mobile-first |
| Rotas | React Router com `HashRouter` | Evita erro 404 ao recarregar no GitHub Pages |
| Estado do servidor | TanStack Query | Cache e revalidação |
| Banco, login e tempo real | Supabase (Postgres, Auth, Realtime) | Plano gratuito |
| Instalável no celular | `vite-plugin-pwa` | Manifesto e ícones |
| Testes | Vitest | Obrigatório nas funções de dinheiro e datas |
| Hospedagem | GitHub Pages via GitHub Actions | Alternativa: Vercel (também gratuita) |

**Plano gratuito do Supabase:** o volume de dados de duas pessoas é muito pequeno. Projetos gratuitos podem ser pausados após um período sem uso; confira a política atual no site do Supabase. Com uso semanal isso não deve acontecer.

### Estrutura de pastas
```
/
├── CLAUDE.md                  ← este documento
├── supabase/
│   ├── migrations/            ← SQL numerado (0001_estrutura.sql, 0002_seguranca.sql, ...)
│   ├── setup_casal.sql        ← cadastra Lucas, Emillia e as abas iniciais (rodar 1 vez)
│   └── testes/                ← teste do banco em Postgres local (npm run test:banco)
├── src/
│   ├── lib/
│   │   ├── supabase.ts        ← cliente
│   │   ├── dinheiro.ts        ← centavos <-> texto, formatação BRL
│   │   └── datas.ts           ← competência, vencimento, fuso
│   ├── hooks/                 ← useLancamentos, useContas, useCompetencia...
│   ├── components/            ← UI reutilizável
│   ├── pages/                 ← Resumo (Visão geral), Transacoes, ContaPage, Graficos, Metas, Configuracoes, Login
│   └── types/                 ← tipos gerados do banco
├── public/                    ← ícones do PWA
└── .github/workflows/deploy.yml
```

---

## 6. Modelo de dados (Supabase / Postgres)

```sql
-- Pessoas do casal (ligadas ao login)
create table membros (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references auth.users(id),
  nome       text not null,
  cor        text,
  criado_em  timestamptz default now()
);

-- Abas
create table contas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  tipo       text not null check (tipo in ('pessoal', 'compartilhada')),
  dono_id    uuid references membros(id),
  cor        text,
  ordem      int  default 0,
  arquivada  boolean default false,
  criado_em  timestamptz default now(),
  check (
    (tipo = 'pessoal' and dono_id is not null) or
    (tipo = 'compartilhada' and dono_id is null)
  )
);

create table categorias (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  tipo       text not null check (tipo in ('saida', 'entrada')),
  icone      text,
  arquivada  boolean default false
);

-- Contas que se repetem todo mês
create table recorrentes (
  id              uuid primary key default gen_random_uuid(),
  conta_id        uuid not null references contas(id),
  descricao       text not null,
  categoria_id    uuid references categorias(id),
  dia_vencimento  int check (dia_vencimento between 1 and 31),
  inicio          date not null,   -- 1º dia do mês de início
  fim             date,            -- null = sem fim
  criado_em       timestamptz default now()
);

-- Quanto cada membro paga de cada recorrente, com vigência
create table recorrente_divisoes (
  id              uuid primary key default gen_random_uuid(),
  recorrente_id   uuid not null references recorrentes(id) on delete cascade,
  membro_id       uuid not null references membros(id),
  valor_centavos  int  not null check (valor_centavos >= 0),
  vigente_desde   date not null,   -- 1º dia do mês
  unique (recorrente_id, membro_id, vigente_desde)
);

-- Compras parceladas (geladeira, sofá...)
create table compras_parceladas (
  id                    uuid primary key default gen_random_uuid(),
  conta_id              uuid not null references contas(id),
  descricao             text not null,
  categoria_id          uuid references categorias(id),
  valor_total_centavos  int  not null check (valor_total_centavos > 0),
  num_parcelas          int  not null check (num_parcelas >= 1),
  primeira_competencia  date not null,
  dia_vencimento        int  check (dia_vencimento between 1 and 31),
  quitada_em            date,
  criado_em             timestamptz default now()
);

create table compra_divisoes (
  id                     uuid primary key default gen_random_uuid(),
  compra_id              uuid not null references compras_parceladas(id) on delete cascade,
  membro_id              uuid not null references membros(id),
  valor_mensal_centavos  int  not null check (valor_mensal_centavos >= 0),
  unique (compra_id, membro_id)
);

-- Cada linha de dinheiro
create table lancamentos (
  id                   uuid primary key default gen_random_uuid(),
  conta_id             uuid not null references contas(id),
  membro_id            uuid not null references membros(id),
  tipo                 text not null check (tipo in ('saida', 'entrada')),
  descricao            text not null,
  valor_centavos       int  not null check (valor_centavos > 0),
  categoria_id         uuid references categorias(id),
  competencia          date not null,   -- 1º dia do mês
  vencimento           date,
  pago                 boolean default false,
  pago_em              date,
  origem               text not null default 'avulso'
                         check (origem in ('avulso', 'recorrente', 'parcela')),
  recorrente_id        uuid references recorrentes(id) on delete set null,
  compra_id            uuid references compras_parceladas(id) on delete set null,
  parcela_numero       int,
  grupo_id             uuid,            -- liga as partes de um avulso compartilhado
  editado_manualmente  boolean default false,
  observacao           text,
  criado_por           uuid references membros(id),
  criado_em            timestamptz default now()
);

create unique index lanc_recorrente_unico
  on lancamentos (recorrente_id, membro_id, competencia)
  where recorrente_id is not null;

create unique index lanc_parcela_unica
  on lancamentos (compra_id, membro_id, parcela_numero)
  where compra_id is not null;

create index lanc_competencia on lancamentos (competencia);
create index lanc_membro_comp on lancamentos (membro_id, competencia);
```

### Funções do banco (migration 0004)
Todas `security invoker` (o RLS vale), executáveis só por `authenticated`:

| Função | O que faz |
|---|---|
| `gerar_competencia(p_mes)` | Gera o mês a partir de contas fixas e parcelas. Chamada pelo app antes de ler os lançamentos do mês. |
| `criar_recorrente(conta, tipo, descricao, categoria, dia, inicio, partes jsonb)` | Cria conta fixa + divisão inicial |
| `alterar_recorrente(id, desde, descricao, categoria, dia, partes jsonb)` | Muda deste mês em diante (regra 5) |
| `encerrar_recorrente(id, ultimo_mes)` | Regra 9 |
| `excluir_recorrente(id)` | Regra 10 (recusa se houver mês pago) |

Migration 0005 (compras parceladas), mesmas regras de segurança:

| Função | O que faz |
|---|---|
| `criar_compra(conta, descricao, categoria, total, parcelas, primeira, dia, partes jsonb)` | Cria compra + valor mensal de cada um |
| `alterar_compra(id, desde, descricao, categoria, dia, partes jsonb)` | Muda deste mês em diante (parcelas pagas não mudam). Total, nº de parcelas e 1º mês não mudam. |
| `quitar_compra(id, mes, lancar_saldo)` | Regra 8. Com `lancar_saldo`, o que falta entra no mês como "<descrição> (quitação)" (`parcela_numero` nulo) |
| `excluir_compra(id)` | Regra 10 |

Migration 0008 (metas): tabelas `orcamentos`, `metas` e `meta_aportes` (com RLS e tempo real) e a função `gerar_periodo(de, ate)`, que gera vários meses de uma vez (até 25) para os gráficos.

Migration 0007 (tempo real): coloca as 8 tabelas na publicação `supabase_realtime`. O app escuta as mudanças (`useTempoReal`) e recarrega só os dados afetados (`src/lib/tempoReal.ts`). **Tabela nova precisa entrar nas duas listas.**

Migration 0006 (contas dinâmicas): `gerar_competencia` passa a ignorar contas arquivadas, e um trigger impede mudar `tipo`/`dono_id` de uma conta.

`partes` é `{"<membro_id>": centavos}`. Em conta pessoal, só o dono pode ter valor (validado).
`recorrentes` tem a coluna `tipo` (`saida`/`entrada`), para gasto fixo ou entrada fixa (salário).

**"Só este mês"** (ex.: luz veio diferente) é feito pelo app editando as linhas do mês com `editado_manualmente = true`.
A geração **não** gera de novo um mês que já tem qualquer linha daquela conta fixa, então remover a parte de alguém só num mês é respeitado.

### Função de geração do mês
`gerar_competencia(p_mes date)` em PL/pgSQL, chamada via `supabase.rpc('gerar_competencia', { p_mes })`:

1. **Recorrentes** ativas no mês (`inicio <= p_mes` e `fim` nulo ou `>= p_mes`): para cada membro, pega a divisão com o maior `vigente_desde <= p_mes`. Se o valor for > 0, insere o lançamento com `origem = 'recorrente'` e vencimento calculado (regra 4), usando `on conflict do nothing`.
2. **Compras parceladas** não quitadas: `parcela = meses entre primeira_competencia e p_mes + 1`. Se estiver entre 1 e `num_parcelas`, insere para cada membro com valor > 0, com descrição `"Geladeira (4/12)"` e `on conflict do nothing`.

### Segurança (RLS)
Todas as tabelas com Row Level Security ligado. Regra única da v1: **quem está na tabela `membros` pode ler e escrever tudo.**

```sql
create function eh_membro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where user_id = auth.uid());
$$;

-- repetir para cada tabela:
alter table lancamentos enable row level security;
create policy "membros acessam tudo" on lancamentos
  for all using (eh_membro()) with check (eh_membro());
```

Depois que Lucas e Emillia criarem as contas, **desativar novos cadastros** no Supabase (Authentication → Settings), para ninguém mais conseguir se registrar.

### Dados iniciais
- **Categorias de saída:** Moradia, Contas de consumo, Mercado, Alimentação fora, Transporte, Saúde, Lazer, Compras, Assinaturas, Educação, Pets, Outros
- **Categorias de entrada:** Salário, Freela, Reembolso, Outros
- **Contas:** Lucas (pessoal), Emillia (pessoal) e Casa (compartilhada), criadas depois que os membros existirem

---

## 7. Configuração inicial (passo a passo)

1. Criar conta no **GitHub** e um repositório `Contas-casa` (https://github.com/lcoelholk/Contas-casa).
2. Criar conta no **Supabase** (dá para entrar com o GitHub) e um projeto novo, na região São Paulo se disponível.
3. Rodar as migrations em `supabase/migrations/` no SQL Editor do Supabase, em ordem.
4. Criar os dois usuários em **Authentication → Users → Add user → Create new user** (e-mail e senha, com "Auto Confirm User" marcado). O app não tem tela de cadastro: ninguém de fora consegue criar conta.
5. Em **Authentication → Sign In / Providers**, desligar **"Allow new users to sign up"**.
6. Editar os e-mails em `supabase/setup_casal.sql` e rodar no SQL Editor. Ele liga cada login a um membro e cria as abas Lucas, Emillia e Casa.
7. **Variáveis de ambiente**
   - Local: arquivo `.env.local` (já no `.gitignore`) com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. A chave pode ser a `anon` (JWT) ou a nova `sb_publishable_...`.
   - Deploy: as mesmas duas como **Secrets** do repositório no GitHub.
   - A chave pública pode ficar no front-end: quem protege os dados é o RLS. **Nunca** colocar a chave `service_role` / `sb_secret_...` no código nem no repositório.
8. Ativar o **GitHub Pages** com origem "GitHub Actions". O workflow `deploy.yml` faz o build e publica a cada push na `main`. Configurar `base: '/Contas-casa/'` no `vite.config.ts`.
9. No celular, abrir o link e escolher "Adicionar à tela inicial" (iPhone: Safari → Compartilhar → Adicionar à Tela de Início; Android: Chrome → ⋮ → Instalar app). Os ícones estão em `public/` (fonte: `icone.svg` e `icone-maskable.svg`). O service worker guarda só os arquivos do app; os dados vêm sempre do Supabase. Depois de cada publicação, o app se atualiza sozinho ao abrir.

**Mudanças no banco:** toda migration nova deve passar em `npm run test:banco` (Postgres local simulando o Supabase) antes de ser aplicada no projeto real. Ao criar tabela nova, incluir a tabela no laço de RLS/grants (ver `0002_seguranca.sql`) e adicionar testes de acesso.

---

## 8. Roteiro de construção

Cada etapa só termina quando o critério "pronto quando" é atendido e o app roda sem erros.

| # | Etapa | Pronto quando |
|---|---|---|
| 1 | Estrutura: Vite + React + TS + Tailwind + Router + cliente Supabase | App abre localmente com tela "Olá" e conecta no Supabase |
| 2 | Banco: migrations do schema, RLS e seed | Tabelas criadas; usuário fora de `membros` não lê nada |
| 3 | Login e layout: tela de login, navegação por abas, seletor de mês | Os dois conseguem entrar e navegar entre Resumo, Lucas, Emillia e Casa |
| 4 | Lançamentos avulsos: pessoais e compartilhados com divisão; marcar pago | Lançar um gasto de mercado 60/40 na Casa aparece nas abas dos dois |
| 5 | Recorrentes: CRUD, divisão com vigência, `gerar_competencia` | Aluguel cadastrado aparece todo mês; mudar a divisão a partir de novembro não altera outubro |
| 6 | Compras parceladas: CRUD, progresso, quitação | Geladeira em 12x gera parcelas nas abas dos dois até a 12ª |
| 7 | Resumo do mês: totais, vencimentos próximos, atrasados, categorias | Números do resumo batem com a soma das abas |
| 8 | Contas dinâmicas e configurações | Criar a aba "Viagem" compartilhada e lançar nela funciona igual à Casa |
| 9 | Tempo real e PWA | Lançamento feito num celular aparece no outro sem recarregar; app instala na tela inicial |
| 10 | Deploy: workflow do GitHub Pages | Link público funcionando, com login |

---

## 9. Convenções para o Claude Code

- Toda a interface em **português do Brasil**. Nomes de tabelas, colunas e funções de domínio também em português (como no schema acima). Código genérico (hooks, utils) pode ter nomes em inglês.
- **Dinheiro:** sempre usar as funções de `src/lib/dinheiro.ts`; nunca fazer contas com `number` em reais.
- **Datas:** sempre usar `src/lib/datas.ts`; competência é sempre o 1º dia do mês.
- Mudança no banco = **nova migration numerada**. Nunca editar uma migration já aplicada.
- Gerar os tipos TypeScript do banco (`supabase gen types`) depois de cada migration.
- Escrever testes (Vitest) para `dinheiro.ts`, `datas.ts` e para a lógica de divisão e parcelas.
- Mobile-first: testar as telas em largura de 375px.
- Commits pequenos, um por funcionalidade, com mensagem em português.
- Nunca commitar `.env.local` nem chaves.

---

## 10. Fora da v1 (ideias para depois)

- ~~Gráficos de evolução mês a mês~~ (feito: tela Gráficos)
- ~~Metas de economia~~ e ~~orçamento por categoria com alerta~~ (feito: tela Metas)
- Lembrete de vencimento por notificação ou e-mail
- Importar extrato do banco (CSV/OFX)
- Anexar comprovante ao lançamento
- Exportar o mês em PDF ou planilha
