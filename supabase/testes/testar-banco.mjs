// Testa as migrations num Postgres local (PGlite), simulando o Supabase:
// schema auth, auth.uid(), papéis anon e authenticated.
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'

const repo = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
const ler = (f) => readFileSync(`${repo}/${f}`, 'utf8')

const db = new PGlite()
let falhas = 0
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`)
  if (!cond) falhas++
}
async function deveFalhar(sql, msg, params = []) {
  try {
    await db.query(sql, params)
    ok(false, `${msg} (deveria ter falhado)`)
  } catch (e) {
    ok(true, `${msg} → ${e.message.split('\n')[0]}`)
  }
}

// --- Simulação do Supabase ---
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  insert into auth.users (email) values
    ('lucascoelho855@gmail.com'), ('emillia@teste.com'), ('estranho@teste.com');
`)

// --- Migrations (todas, em ordem) ---
const migrations = readdirSync(`${repo}/migrations`).filter((f) => f.endsWith('.sql')).sort()
for (const f of migrations) {
  await db.exec(ler(`migrations/${f}`))
  ok(true, `aplicou ${f}`)
}
await db.exec(ler('migrations/0003_categorias.sql'))
ok((await db.query('select count(*)::int n from categorias')).rows[0].n === 16, 'categorias: 16, e rodar de novo não duplica')

// --- Setup do casal (como administrador, igual ao SQL Editor) ---
await db.exec(ler('setup_casal.sql').replace('EMAIL-DA-EMILLIA@exemplo.com', 'emillia@teste.com'))
const contas = (await db.query('select nome, tipo from contas order by ordem')).rows
ok(JSON.stringify(contas.map((c) => c.nome)) === '["Lucas","Emillia","Casa"]', 'setup criou abas Lucas, Emillia, Casa')

const ids = Object.fromEntries(
  (await db.query(`select u.email, m.id membro from auth.users u left join membros m on m.user_id = u.id`)).rows.map(
    (r) => [r.email, r.membro],
  ),
)
const userId = async (email) => (await db.query('select id from auth.users where email=$1', [email])).rows[0].id
const contaId = async (nome) => (await db.query('select id from contas where nome=$1', [nome])).rows[0].id
const idCasa = await contaId('Casa')
const idContaLucas = await contaId('Lucas')
const lucas = ids['lucascoelho855@gmail.com']
const emillia = ids['emillia@teste.com']

async function como(papel, email) {
  await db.exec('reset role')
  const sub = email ? await userId(email) : ''
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub])
  await db.exec(`set role ${papel}`)
}

// --- Lucas logado (membro) ---
await como('authenticated', 'lucascoelho855@gmail.com')
ok((await db.query('select count(*)::int n from categorias')).rows[0].n === 16, 'Lucas lê as categorias')
ok((await db.query('select count(*)::int n from membros')).rows[0].n === 2, 'Lucas vê os dois membros')

// Mercado R$ 300 na Casa, 60/40
await db.query(
  `insert into lancamentos (conta_id, membro_id, tipo, descricao, valor_centavos, competencia, grupo_id, criado_por)
   values ($1,$2,'saida','Mercado',18000,'2026-10-01','11111111-1111-1111-1111-111111111111',$2),
          ($1,$3,'saida','Mercado',12000,'2026-10-01','11111111-1111-1111-1111-111111111111',$2)`,
  [idCasa, lucas, emillia],
)
ok(true, 'Lucas lança mercado 60/40 na Casa')

await deveFalhar(
  `insert into lancamentos (conta_id, membro_id, tipo, descricao, valor_centavos, competencia) values ($1,$2,'saida','x',100,'2026-10-01')`,
  'lançamento da Emillia na conta pessoal do Lucas é bloqueado',
  [idContaLucas, emillia],
)
await deveFalhar(
  `insert into lancamentos (conta_id, membro_id, tipo, descricao, valor_centavos, competencia) values ($1,$2,'saida','x',100,'2026-10-15')`,
  'competência fora do dia 1 é bloqueada',
  [idCasa, lucas],
)
await deveFalhar(
  `insert into lancamentos (conta_id, membro_id, tipo, descricao, valor_centavos, competencia) values ($1,$2,'saida','x',0,'2026-10-01')`,
  'valor zero é bloqueado',
  [idCasa, lucas],
)

// Recorrente + índice único contra duplicação
const rec = (
  await db.query(
    `insert into recorrentes (conta_id, descricao, dia_vencimento, inicio) values ($1,'Aluguel',10,'2026-10-01') returning id`,
    [idCasa],
  )
).rows[0].id
const insRec = `insert into lancamentos (conta_id, membro_id, tipo, descricao, valor_centavos, competencia, origem, recorrente_id)
                values ($1,$2,'saida','Aluguel',120000,'2026-10-01','recorrente',$3)`
await db.query(insRec, [idCasa, lucas, rec])
await deveFalhar(insRec, 'mesma recorrente no mesmo mês não duplica', [idCasa, lucas, rec])

// --- Emillia logada vê o que o Lucas lançou ---
await como('authenticated', 'emillia@teste.com')
ok((await db.query('select count(*)::int n from lancamentos')).rows[0].n === 3, 'Emillia vê os lançamentos do Lucas')

// --- Usuário logado que NÃO é membro ---
await como('authenticated', 'estranho@teste.com')
ok((await db.query('select count(*)::int n from lancamentos')).rows[0].n === 0, 'estranho logado não vê lançamentos')
ok((await db.query('select count(*)::int n from membros')).rows[0].n === 0, 'estranho logado não vê membros')
ok((await db.query('select count(*)::int n from categorias')).rows[0].n === 0, 'estranho logado não vê categorias')
await deveFalhar(
  `insert into contas (nome, tipo) values ('Invasor', 'compartilhada')`,
  'estranho logado não consegue criar conta',
)
await deveFalhar(
  `insert into membros (user_id, nome) values (auth.uid(), 'Invasor')`,
  'estranho não consegue se cadastrar como membro',
)

// --- Visitante sem login ---
await como('anon', null)
await deveFalhar('select * from lancamentos', 'visitante sem login não lê lançamentos')
await deveFalhar('select * from membros', 'visitante sem login não lê membros')

await db.exec('reset role')

// =============================================================================
// Etapa 5 · Contas fixas e geração do mês (0004)
// =============================================================================
console.log('\n— Contas fixas —')
await como('authenticated', 'lucascoelho855@gmail.com')
const q = async (sql, params = []) => (await db.query(sql, params)).rows
const gerar = async (mes) => (await q('select gerar_competencia($1::date) n', [mes]))[0].n
const linhasDe = async (rec, mes) =>
  Object.fromEntries(
    (await q(
      `select m.nome, l.valor_centavos v from lancamentos l join membros m on m.id = l.membro_id
       where l.recorrente_id = $1 and l.competencia = $2::date order by m.nome`,
      [rec, mes],
    )).map((r) => [r.nome, r.v]),
  )
const partes = (l, e) => JSON.stringify({ [lucas]: l, [emillia]: e })

const aluguel = (
  await q(`select criar_recorrente($1, 'saida', 'Aluguel', null, 31, '2026-10-01', $2::jsonb) id`, [
    idCasa,
    partes(120000, 80000),
  ])
)[0].id
ok(Boolean(aluguel), 'criou a conta fixa Aluguel (Lucas 1.200 / Emillia 800, vence dia 31, desde outubro)')

ok((await gerar('2026-09-01')) === 0, 'setembro (antes do início): nada gerado')
const nOut = await gerar('2026-10-01')
ok(nOut === 2, `outubro: gerou ${nOut} lançamentos (1 por pessoa)`)
ok((await gerar('2026-10-01')) === 0, 'gerar outubro de novo não duplica')
ok(JSON.stringify(await linhasDe(aluguel, '2026-10-01')) === '{"Emillia":80000,"Lucas":120000}', 'outubro: Lucas 1.200, Emillia 800')
const vencNov = (await (async () => { await gerar('2026-11-01'); return q(`select distinct vencimento::text v from lancamentos where recorrente_id=$1 and competencia='2026-11-01'`, [aluguel]) })())[0].v
ok(vencNov === '2026-11-30', `vencimento dia 31 em novembro vira ${vencNov}`)

// Critério da etapa: mudar a divisão a partir de novembro não altera outubro
await q(`select alterar_recorrente($1, '2026-11-01', 'Aluguel', null, 31, $2::jsonb)`, [aluguel, partes(100000, 100000)])
ok(JSON.stringify(await linhasDe(aluguel, '2026-10-01')) === '{"Emillia":80000,"Lucas":120000}', 'mudar a partir de novembro: outubro continua 1.200 / 800')
ok(JSON.stringify(await linhasDe(aluguel, '2026-11-01')) === '{"Emillia":100000,"Lucas":100000}', 'novembro (já gerado) passou para 1.000 / 1.000')
await gerar('2026-12-01')
ok(JSON.stringify(await linhasDe(aluguel, '2026-12-01')) === '{"Emillia":100000,"Lucas":100000}', 'dezembro (gerado depois) já nasce 1.000 / 1.000')

// Pago e editado à mão não são sobrescritos
await q(`update lancamentos set pago = true, pago_em = '2026-12-05' where recorrente_id=$1 and competencia='2026-12-01' and membro_id=$2`, [aluguel, lucas])
await q(`update lancamentos set valor_centavos = 95000, editado_manualmente = true where recorrente_id=$1 and competencia='2026-12-01' and membro_id=$2`, [aluguel, emillia])
await q(`select alterar_recorrente($1, '2026-12-01', 'Aluguel', null, 10, $2::jsonb)`, [aluguel, partes(110000, 90000)])
ok(JSON.stringify(await linhasDe(aluguel, '2026-12-01')) === '{"Emillia":95000,"Lucas":100000}', 'dezembro: parte paga e parte editada à mão não mudam')

// Quem passa a 0 perde a linha; quem volta a pagar ganha a linha
await gerar('2027-01-01')
await q(`select alterar_recorrente($1, '2027-01-01', 'Aluguel', null, 10, $2::jsonb)`, [aluguel, partes(200000, 0)])
ok(JSON.stringify(await linhasDe(aluguel, '2027-01-01')) === '{"Lucas":200000}', 'janeiro: só Lucas (linha da Emillia removida)')
ok((await gerar('2027-01-01')) === 0, 'e a geração não recria a linha removida')
await q(`select alterar_recorrente($1, '2027-01-01', 'Aluguel', null, 10, $2::jsonb)`, [aluguel, partes(100000, 100000)])
ok(JSON.stringify(await linhasDe(aluguel, '2027-01-01')) === '{"Emillia":100000,"Lucas":100000}', 'janeiro: Emillia volta a pagar e ganha a linha')

// Encerrar e excluir
await gerar('2027-02-01')
await q(`select encerrar_recorrente($1, '2027-01-01')`, [aluguel])
ok(Object.keys(await linhasDe(aluguel, '2027-02-01')).length === 0, 'encerrar em janeiro remove fevereiro (não pago)')
ok((await gerar('2027-03-01')) === 0, 'depois de encerrada, março não é gerado')
await deveFalhar(`select excluir_recorrente('${aluguel}')`, 'não exclui conta fixa com mês pago')

const internet = (await q(`select criar_recorrente($1, 'saida', 'Internet', null, 15, '2026-10-01', $2::jsonb) id`, [idCasa, partes(5000, 5000)]))[0].id
await gerar('2026-10-01')
await q(`select excluir_recorrente($1)`, [internet])
ok((await q(`select count(*)::int n from lancamentos where descricao='Internet'`))[0].n === 0, 'exclui conta fixa sem meses pagos (com os lançamentos)')

// Conta fixa pessoal e entrada
const salario = (await q(`select criar_recorrente($1, 'entrada', 'Salário', null, 5, '2026-10-01', $2::jsonb) id`, [idContaLucas, JSON.stringify({ [lucas]: 500000 })]))[0].id
await gerar('2026-10-01')
ok((await q(`select tipo from lancamentos where recorrente_id=$1`, [salario]))[0]?.tipo === 'entrada', 'salário fixo na conta do Lucas gera uma entrada')
await deveFalhar(
  `select criar_recorrente('${idContaLucas}', 'saida', 'Errado', null, 5, '2026-10-01', '${JSON.stringify({ [emillia]: 100 })}'::jsonb)`,
  'conta fixa na conta do Lucas com parte da Emillia é bloqueada no cadastro',
)
await deveFalhar(
  `select alterar_recorrente('${salario}', '2026-10-01', 'Salário', null, 5, '${JSON.stringify({ [lucas]: 1, [emillia]: 100 })}'::jsonb)`,
  'e também ao alterar',
)
// Mesmo com um dado inválido gravado direto no banco, a geração não trava
await db.exec('reset role')
await q(`insert into recorrente_divisoes (recorrente_id, membro_id, valor_centavos, vigente_desde) values ($1, $2, 777, '2026-11-01')`, [salario, emillia])
await como('authenticated', 'lucascoelho855@gmail.com')
await gerar('2026-11-01')
ok((await q(`select count(*)::int n from lancamentos where recorrente_id=$1 and competencia='2026-11-01'`, [salario]))[0].n === 1, 'divisão inválida numa conta pessoal é ignorada, sem travar a geração')
await deveFalhar(`select criar_recorrente('${idCasa}', 'saida', 'Zero', null, 5, '2026-10-01', '${partes(0, 0)}'::jsonb)`, 'conta fixa com valor zero é bloqueada')
await deveFalhar(`select gerar_competencia('2026-10-15')`, 'gerar com data fora do dia 1 é bloqueado')

// Parcelas (a função já gera; as telas chegam na etapa 6)
const compra = (await q(
  `insert into compras_parceladas (conta_id, descricao, valor_total_centavos, num_parcelas, primeira_competencia, dia_vencimento)
   values ($1, 'Geladeira', 360000, 12, '2026-10-01', 10) returning id`, [idCasa]))[0].id
await q(`insert into compra_divisoes (compra_id, membro_id, valor_mensal_centavos) values ($1,$2,15000),($1,$3,15000)`, [compra, lucas, emillia])
await gerar('2026-10-01')
ok((await q(`select descricao from lancamentos where compra_id=$1 and competencia='2026-10-01' limit 1`, [compra]))[0]?.descricao === 'Geladeira (1/12)', 'geladeira: outubro gera "Geladeira (1/12)"')
await gerar('2027-09-01'); await gerar('2027-10-01')
ok((await q(`select count(*)::int n from lancamentos where compra_id=$1 and competencia='2027-09-01' and parcela_numero=12`, [compra]))[0].n === 2, 'setembro/2027: parcela 12/12 para os dois')
ok((await q(`select count(*)::int n from lancamentos where compra_id=$1 and competencia='2027-10-01'`, [compra]))[0].n === 0, 'outubro/2027: acabou, nada gerado')

// Quem não é membro não consegue nada
await como('authenticated', 'estranho@teste.com')
ok((await gerar('2026-10-01')) === 0, 'estranho: gerar não cria nada')
await deveFalhar(`select criar_recorrente('${idCasa}', 'saida', 'Invasão', null, 5, '2026-10-01', '${partes(1, 1)}'::jsonb)`, 'estranho não cria conta fixa')
await como('anon', null)
await deveFalhar(`select gerar_competencia('2026-10-01')`, 'visitante sem login não executa a geração')

await db.exec('reset role')
console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
