// Testa as migrations num Postgres local (PGlite), simulando o Supabase:
// schema auth, auth.uid(), papéis anon e authenticated.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

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

// --- Migrations ---
for (const f of ['migrations/0001_estrutura.sql', 'migrations/0002_seguranca.sql', 'migrations/0003_categorias.sql']) {
  await db.exec(ler(f))
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
console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)
