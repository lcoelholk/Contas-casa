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

// =============================================================================
// Etapa 6 · Compras parceladas (0005)
// =============================================================================
console.log('\n— Compras parceladas —')
const partesDaCompra = async (compraId, mes) =>
  Object.fromEntries(
    (await q(
      `select m.nome, l.valor_centavos v, l.descricao d from lancamentos l join membros m on m.id = l.membro_id
       where l.compra_id = $1 and l.competencia = $2::date order by m.nome, l.descricao`,
      [compraId, mes],
    )).map((r) => [`${r.nome}:${r.d}`, r.v]),
  )
const sofa = (await q(
  `select criar_compra($1, 'Sofá', null, 240000, 6, '2026-10-01', 15, $2::jsonb) id`, [idCasa, partes(20000, 20000)]))[0].id
ok(Boolean(sofa), 'criou a compra Sofá R$ 2.400 em 6x (200 / 200)')
await gerar('2026-10-01'); await gerar('2026-11-01'); await gerar('2026-12-01')
ok(JSON.stringify(await partesDaCompra(sofa, '2026-11-01')) === '{"Emillia:Sofá (2/6)":20000,"Lucas:Sofá (2/6)":20000}', 'novembro: Sofá (2/6) para os dois')

// Alterar a partir de dezembro: Emillia paga mais
await q(`update lancamentos set pago = true where compra_id = $1 and competencia = '2026-10-01'`, [sofa])
await q(`select alterar_compra($1, '2026-12-01', 'Sofá novo', null, 15, $2::jsonb)`, [sofa, partes(10000, 30000)])
ok(JSON.stringify(await partesDaCompra(sofa, '2026-11-01')) === '{"Emillia:Sofá (2/6)":20000,"Lucas:Sofá (2/6)":20000}', 'alterar a partir de dezembro não muda novembro')
ok(JSON.stringify(await partesDaCompra(sofa, '2026-12-01')) === '{"Emillia:Sofá novo (3/6)":30000,"Lucas:Sofá novo (3/6)":10000}', 'dezembro: Sofá novo (3/6) 100 / 300')
await gerar('2027-01-01')
ok(JSON.stringify(await partesDaCompra(sofa, '2027-01-01')) === '{"Emillia:Sofá novo (4/6)":30000,"Lucas:Sofá novo (4/6)":10000}', 'janeiro já nasce com os valores novos')

// Quitar em janeiro (parcela 4 de 6), lançando o saldo: faltam 5 e 6
await gerar('2027-02-01')
await q(`update lancamentos set pago = true where compra_id = $1 and competencia = '2027-02-01' and membro_id = $2`, [sofa, lucas])
await q(`select quitar_compra($1, '2027-01-01', true)`, [sofa])
const jan = await partesDaCompra(sofa, '2027-01-01')
ok(jan['Lucas:Sofá novo (quitação)'] === 10000 && jan['Emillia:Sofá novo (quitação)'] === 60000,
  `quitação em janeiro: Lucas 100 (a parcela 5 já estava paga), Emillia 600 → ${JSON.stringify(jan)}`)
ok(JSON.stringify(await partesDaCompra(sofa, '2027-02-01')) === '{"Lucas:Sofá novo (5/6)":10000}', 'fevereiro: só fica a parcela que já estava paga')
await gerar('2027-03-01')
ok(Object.keys(await partesDaCompra(sofa, '2027-03-01')).length === 0, 'depois de quitada, março não tem parcela do sofá')
await deveFalhar(`select quitar_compra('${sofa}', '2027-01-01', true)`, 'não quita duas vezes')
await deveFalhar(`select excluir_compra('${sofa}')`, 'não exclui compra com parcela paga')

const tv = (await q(`select criar_compra($1, 'TV', null, 300000, 10, '2026-11-01', null, $2::jsonb) id`, [idCasa, partes(15000, 15000)]))[0].id
await deveFalhar(`select quitar_compra('${tv}', '2026-10-01', false)`, 'não quita antes de a compra começar')
await gerar('2026-11-01')
await q(`select excluir_compra($1)`, [tv])
ok((await q(`select count(*)::int n from lancamentos where compra_id = $1`, [tv]))[0].n === 0, 'exclui compra sem parcela paga (com as parcelas)')

const celular = (await q(`select criar_compra($1, 'Celular', null, 120000, 10, '2026-10-01', 5, $2::jsonb) id`, [idContaLucas, JSON.stringify({ [lucas]: 12000 })]))[0].id
await gerar('2026-10-01')
ok((await q(`select descricao from lancamentos where compra_id = $1`, [celular]))[0]?.descricao === 'Celular (1/10)', 'compra parcelada pessoal (celular do Lucas)')
await deveFalhar(`select criar_compra('${idContaLucas}', 'Errado', null, 100, 1, '2026-10-01', null, '${JSON.stringify({ [emillia]: 100 })}'::jsonb)`, 'compra na conta do Lucas com parte da Emillia é bloqueada')
await deveFalhar(`select criar_compra('${idCasa}', 'Zero', null, 100, 2, '2026-10-01', null, '${partes(0, 0)}'::jsonb)`, 'compra sem valor por pessoa é bloqueada')

// Quem não é membro não consegue nada
await como('authenticated', 'estranho@teste.com')
await deveFalhar(`select criar_compra('${idCasa}', 'Invasão', null, 100, 2, '2026-10-01', null, '${partes(50, 50)}'::jsonb)`, 'estranho não cria compra')
ok((await gerar('2026-10-01')) === 0, 'estranho: gerar não cria nada')
await deveFalhar(`select criar_recorrente('${idCasa}', 'saida', 'Invasão', null, 5, '2026-10-01', '${partes(1, 1)}'::jsonb)`, 'estranho não cria conta fixa')
await como('anon', null)
await deveFalhar(`select gerar_competencia('2026-10-01')`, 'visitante sem login não executa a geração')

// =============================================================================
// Etapa 8 · Contas dinâmicas e configurações (0006)
// =============================================================================
console.log('\n— Contas dinâmicas —')
await como('authenticated', 'lucascoelho855@gmail.com')
const viagem = (await q(`insert into contas (nome, tipo, cor, ordem) values ('Viagem', 'compartilhada', '#7c3aed', 4) returning id`))[0].id
const hotel = (await q(`select criar_recorrente($1, 'saida', 'Hotel', null, 10, '2027-03-01', $2::jsonb) id`, [viagem, partes(30000, 30000)]))[0].id
await gerar('2027-03-01')
ok(JSON.stringify(await linhasDe(hotel, '2027-03-01')) === '{"Emillia":30000,"Lucas":30000}', 'conta nova "Viagem" funciona igual à Casa')
await q(`insert into lancamentos (conta_id, membro_id, tipo, descricao, valor_centavos, competencia, grupo_id)
         values ($1, $2, 'saida', 'Passagem', 50000, '2027-03-01', gen_random_uuid())`, [viagem, emillia])

await q(`update contas set nome = 'Viagem 2027', ordem = 0 where id = $1`, [viagem])
ok((await q(`select nome from contas where id = $1`, [viagem]))[0].nome === 'Viagem 2027', 'renomeia e reordena conta')
await deveFalhar(`update contas set tipo = 'pessoal', dono_id = '${lucas}' where id = '${viagem}'`, 'tipo da conta não muda depois de criada')
await deveFalhar(`update contas set dono_id = '${emillia}' where id = '${idContaLucas}'`, 'dono da conta não muda depois de criado')
await deveFalhar(`delete from contas where id = '${viagem}'`, 'conta com lançamentos não pode ser excluída')

await q(`update contas set arquivada = true where id = $1`, [viagem])
ok((await gerar('2027-04-01')) >= 0 && Object.keys(await linhasDe(hotel, '2027-04-01')).length === 0, 'conta arquivada não gera mais contas fixas')
ok(Object.keys(await linhasDe(hotel, '2027-03-01')).length === 2, 'conta arquivada mantém o histórico')
const tv2 = (await q(`select criar_compra($1, 'Mala', null, 20000, 4, '2027-03-01', 5, $2::jsonb) id`, [viagem, partes(2500, 2500)]))[0].id
await gerar('2027-05-01')
ok((await q(`select count(*)::int n from lancamentos where compra_id = $1`, [tv2]))[0].n === 0, 'conta arquivada não gera parcelas')
await q(`update contas set arquivada = false where id = $1`, [viagem])
await gerar('2027-05-01')
ok((await q(`select count(*)::int n from lancamentos where compra_id = $1`, [tv2]))[0].n === 2, 'desarquivar volta a gerar')

console.log('\n— Configurações —')
const viagens = (await q(`insert into categorias (nome, tipo, icone) values ('Viagens', 'saida', '✈️') returning id`))[0].id
await deveFalhar(`insert into categorias (nome, tipo) values ('Viagens', 'saida')`, 'categoria com nome repetido é bloqueada')
await q(`update categorias set nome = 'Passeios', arquivada = true where id = $1`, [viagens])
ok((await q(`select nome, arquivada from categorias where id = $1`, [viagens]))[0].arquivada === true, 'renomeia e arquiva categoria')
await q(`update membros set nome = 'Emi', cor = '#db2777' where id = $1`, [emillia])
await como('authenticated', 'emillia@teste.com')
ok((await q(`select nome from membros where id = $1`, [emillia]))[0].nome === 'Emi', 'nome do membro alterado aparece para o outro')

await como('authenticated', 'estranho@teste.com')
await deveFalhar(`insert into contas (nome, tipo) values ('Invasão', 'compartilhada')`, 'estranho não cria conta')
ok((await q(`update categorias set nome = 'x' returning id`)).length === 0, 'estranho não altera categorias')
ok((await q(`update membros set nome = 'x' returning id`)).length === 0, 'estranho não altera membros')

// =============================================================================
// Etapa 9 · Tempo real (0007)
// =============================================================================
console.log('\n— Tempo real —')
await db.exec('reset role')
await db.exec('create publication supabase_realtime')
await db.exec(ler('migrations/0007_tempo_real.sql'))
await db.exec(ler('migrations/0007_tempo_real.sql'))
const publicadas = (await q(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`)).map((r) => r.tablename)
ok(publicadas.length === 8 && publicadas.includes('lancamentos'), 'as 8 tabelas entram no tempo real (e rodar de novo não dá erro)')

// =============================================================================
// Metas e análises (0008)
// =============================================================================
console.log('\n— Metas e orçamentos —')
await como('authenticated', 'lucascoelho855@gmail.com')
const mercado = (await q(`select id from categorias where nome = 'Mercado'`))[0].id
await q(`insert into orcamentos (categoria_id, membro_id, valor_centavos) values ($1, null, 150000), ($1, $2, 80000)`, [mercado, lucas])
await deveFalhar(`insert into orcamentos (categoria_id, membro_id, valor_centavos) values ('${mercado}', null, 1000)`, 'só um orçamento dos dois por categoria')
await deveFalhar(`insert into orcamentos (categoria_id, membro_id, valor_centavos) values ('${mercado}', '${lucas}', 1000)`, 'só um orçamento por pessoa por categoria')
await deveFalhar(`insert into orcamentos (categoria_id, valor_centavos) values ('${mercado}', 0)`, 'orçamento zero é bloqueado')

const metaViagem = (await q(`insert into metas (nome, valor_alvo_centavos, prazo) values ('Viagem', 600000, '2027-06-01') returning id`))[0].id
await q(`insert into meta_aportes (meta_id, membro_id, valor_centavos, data) values ($1, $2, 50000, '2026-10-05'), ($1, $3, 30000, '2026-10-06'), ($1, $2, -10000, '2026-10-20')`, [metaViagem, lucas, emillia])
ok((await q(`select sum(valor_centavos)::int s from meta_aportes where meta_id = $1`, [metaViagem]))[0].s === 70000, 'aportes e retiradas da meta somam certo')
await deveFalhar(`insert into meta_aportes (meta_id, membro_id, valor_centavos, data) values ('${metaViagem}', '${lucas}', 0, '2026-10-01')`, 'aporte zero é bloqueado')
await como('authenticated', 'emillia@teste.com')
ok((await q(`select count(*)::int n from metas`))[0].n === 1, 'Emillia vê a meta criada pelo Lucas')

const streaming = (await q(`select criar_recorrente($1, 'saida', 'Streaming', null, 10, '2028-01-01', $2::jsonb) id`, [idCasa, partes(5000, 5000)]))[0].id
await q(`select gerar_periodo('2028-01-01', '2028-03-01')`)
ok((await q(`select count(*)::int n from lancamentos where recorrente_id = $1`, [streaming]))[0].n === 6, 'gerar_periodo gera vários meses de uma vez (3 meses × 2 pessoas)')
ok((await q(`select gerar_periodo('2028-01-01', '2028-03-01') n`))[0].n === 0, 'gerar_periodo de novo não duplica')
await deveFalhar(`select gerar_periodo('2026-01-01', '2028-06-01')`, 'período longo demais é recusado')

await como('authenticated', 'estranho@teste.com')
ok((await q(`select count(*)::int n from metas`))[0].n === 0, 'estranho não vê metas')
ok((await q(`select count(*)::int n from orcamentos`))[0].n === 0, 'estranho não vê orçamentos')
await deveFalhar(`insert into metas (nome, valor_alvo_centavos) values ('Invasão', 100)`, 'estranho não cria meta')
await como('anon', null)
await deveFalhar(`select count(*) from meta_aportes`, 'visitante sem login não lê aportes')
await deveFalhar(`select gerar_periodo('2026-10-01', '2026-11-01')`, 'visitante sem login não gera período')

// Conta fixa com data limite (ex.: aluguel com contrato) e depois sem limite
console.log('\n— Conta fixa com data limite —')
await como('authenticated', 'lucascoelho855@gmail.com')
const contrato = (await q(`select criar_recorrente($1, 'saida', 'Aluguel contrato', null, 5, '2029-01-01', $2::jsonb) id`, [idCasa, partes(100000, 100000)]))[0].id
await q(`select encerrar_recorrente($1, '2029-03-01')`, [contrato])
await q(`select gerar_periodo('2029-01-01', '2029-06-01')`)
const mesesDe = async (id) => (await q(`select count(distinct competencia)::int n from lancamentos where recorrente_id = $1`, [id]))[0].n
ok((await mesesDe(contrato)) === 3, 'com data limite: aparece só até o último mês (jan a mar)')
await q(`update recorrentes set fim = null where id = $1`, [contrato])
await q(`select gerar_periodo('2029-01-01', '2029-06-01')`)
ok((await mesesDe(contrato)) === 6, 'tirando o limite, volta a aparecer nos meses seguintes')

// Gasto rápido pelo atalho do iPhone (sem login, só com o código secreto)
console.log('\n— Gasto rápido —')
await como('authenticated', 'lucascoelho855@gmail.com')
const token = (await q(`select gerar_token_atalho() t`))[0].t
ok(/^[0-9a-f]{64}$/.test(token), 'gera um código secreto de 64 caracteres')
ok((await q(`select count(*)::int n from atalhos where token_hash = $1`, [token]))[0].n === 0, 'no banco fica só o hash, não o código')
ok((await q(`select valor_em_centavos('12,50') a, valor_em_centavos('12.5') b, valor_em_centavos('R$ 1.234,56') c, valor_em_centavos('1.500') d, valor_em_centavos('abc') e`))
  .map((r) => [r.a, r.b, r.c, r.d, r.e].join())[0] === '1250,1250,123456,150000,', 'entende o valor de vários jeitos')

await como('anon', null)
const msg1 = (await q(`select lancar_rapido($1, '23,90', 'Padaria') m`, [token]))[0].m
ok(msg1 === 'R$ 23,90 em Mercado: Padaria', `lança na aba do Lucas e adivinha a categoria → ${msg1}`)
const msg2 = (await q(`select lancar_rapido($1, '120', 'iFood', 'Casa') m`, [token]))[0].m
ok(msg2.includes('dividido'), `"casa" divide entre os dois → ${msg2}`)
await q(`select lancar_rapido($1, '10,01', 'Uber', 'casa', 'lazer')`, [token])
await deveFalhar(`select lancar_rapido('${token}', '10', 'Teste', 'Aba que não existe')`, 'aba desconhecida é recusada')
await deveFalhar(`select lancar_rapido('codigo-errado', '10', 'Teste')`, 'código errado é recusado')
await deveFalhar(`select lancar_rapido('${token}', '0', 'Teste')`, 'valor zero é recusado')
await deveFalhar(`select count(*) from atalhos`, 'visitante sem login não lê os códigos')
await deveFalhar(`select gerar_token_atalho()`, 'visitante sem login não gera código')

await como('authenticated', 'lucascoelho855@gmail.com')
const padaria = (await q(`select l.*, c.nome cat, k.nome conta from lancamentos l left join categorias c on c.id = l.categoria_id join contas k on k.id = l.conta_id where descricao = 'Padaria'`))[0]
ok(padaria.conta === 'Lucas' && padaria.pago && padaria.valor_centavos === 2390 && padaria.membro_id === lucas, 'gasto pessoal: na aba do Lucas, já pago')
const ifood = await q(`select membro_id, valor_centavos, pago, conta_id, grupo_id from lancamentos where descricao = 'iFood' order by valor_centavos`)
ok(ifood.length === 2 && ifood.every((l) => l.conta_id === idCasa && l.valor_centavos === 6000) && ifood[0].grupo_id === ifood[1].grupo_id, 'na Casa: R$ 60 para cada, no mesmo grupo')
ok(ifood.find((l) => l.membro_id === lucas).pago && !ifood.find((l) => l.membro_id === emillia).pago, 'a parte de quem lançou já pago; a do outro a pagar')
const uber = await q(`select membro_id, valor_centavos, c.nome cat from lancamentos l join categorias c on c.id = l.categoria_id where descricao = 'Uber'`)
ok(uber.find((l) => l.membro_id === lucas).valor_centavos === 501 && uber.find((l) => l.membro_id === emillia).valor_centavos === 500, 'centavo que sobra fica com quem lançou')
ok(uber.every((l) => l.cat === 'Lazer'), 'categoria escolhida no atalho vale mais que o palpite')
const novoToken = (await q(`select gerar_token_atalho() t`))[0].t
await como('anon', null)
await deveFalhar(`select lancar_rapido('${token}', '5', 'Velho')`, 'gerar outro código desliga o antigo')
ok((await q(`select lancar_rapido($1, '5', 'Novo') m`, [novoToken])).length === 1, 'o código novo funciona')

// Importar extrato (OFX/CSV lido no app)
console.log('\n— Importar extrato —')
await como('authenticated', 'lucascoelho855@gmail.com')
const itens = JSON.stringify([
  { data: '2030-03-05', descricao: 'Supermercado Bom', centavos: -12345, id: 'ofx:1' },
  { data: '2030-03-01', descricao: 'Salário empresa', centavos: 500000, id: 'ofx:2' },
  { data: '2030-02-28', descricao: 'Uber trip', centavos: -2000, id: 'ofx:3' },
])
const r1 = (await q(`select importar_lancamentos($1, $2::jsonb) r`, [idContaLucas, itens]))[0].r
ok(r1.novos === 3 && r1.repetidos === 0, `importa na aba do Lucas → ${JSON.stringify(r1)}`)
const r2 = (await q(`select importar_lancamentos($1, $2::jsonb) r`, [idContaLucas, itens]))[0].r
ok(r2.novos === 0 && r2.repetidos === 3, 'importar o mesmo extrato de novo não duplica')
const imp = await q(`select l.*, c.nome cat from lancamentos l left join categorias c on c.id = l.categoria_id where id_externo like 'ofx:%' and conta_id = $1 order by id_externo`, [idContaLucas])
ok(imp[0].tipo === 'saida' && imp[0].valor_centavos === 12345 && imp[0].cat === 'Mercado' && imp[0].pago && imp[0].competencia.toISOString().startsWith('2030-03-01'), 'gasto: valor positivo, categoria adivinhada, pago, no mês da data')
ok(imp[1].tipo === 'entrada' && imp[1].cat === 'Salário', 'entrada vira entrada (Salário)')
ok(imp[2].competencia.toISOString().startsWith('2030-02-01'), 'cada linha vai para o mês da própria data')
const r3 = (await q(`select importar_lancamentos($1, $2::jsonb) r`, [idCasa, JSON.stringify([
  { data: '2030-03-10', descricao: 'Mercado do mês', centavos: -30001, id: 'csv:9' },
  { data: '2030-03-11', descricao: 'Pix recebido', centavos: 1000, id: 'csv:10' },
])]))[0].r
ok(r3.novos === 1 && r3.ignorados === 1, `na Casa: gasto dividido e entrada ignorada → ${JSON.stringify(r3)}`)
const casaImp = await q(`select membro_id, valor_centavos, pago from lancamentos where id_externo = 'csv:9' order by valor_centavos desc`)
ok(casaImp.length === 2 && casaImp[0].membro_id === lucas && casaImp[0].valor_centavos === 15001 && casaImp[0].pago && !casaImp[1].pago, 'parte de quem importou (com o centavo a mais) paga; a do outro a pagar')
const r4 = (await q(`select importar_lancamentos($1, $2::jsonb) r`, [idCasa, JSON.stringify([{ data: '2030-03-10', descricao: 'Mercado do mês', centavos: -30001, id: 'csv:9' }])]))[0].r
ok(r4.repetidos === 1, 'na Casa também não duplica')
await deveFalhar(`select importar_lancamentos('${idContaLucas}', '[{"data":"2030-01-01","centavos":-1}]'::jsonb)`, 'linha sem identificador é recusada')
await como('authenticated', 'estranho@teste.com')
await deveFalhar(`select importar_lancamentos('${idContaLucas}', '${itens}'::jsonb)`, 'quem não é membro não importa')
await como('anon', null)
await deveFalhar(`select importar_lancamentos('${idContaLucas}', '${itens}'::jsonb)`, 'visitante sem login não importa')

await db.exec('reset role')
console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
