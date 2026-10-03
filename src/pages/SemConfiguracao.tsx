import { useQuery } from '@tanstack/react-query'
import { verificarConexao, supabaseConfigurado } from '../lib/supabase.ts'
import { competenciaAtual, nomeDaCompetencia } from '../lib/datas.ts'
import { formatarCentavos } from '../lib/dinheiro.ts'

const ABAS = [
  { nome: 'Lucas', cor: 'bg-sky-100 text-sky-800' },
  { nome: 'Emillia', cor: 'bg-rose-100 text-rose-800' },
  { nome: 'Casa', cor: 'bg-marca-100 text-marca-900' },
]

export default function SemConfiguracao() {
  const conexao = useQuery({
    queryKey: ['conexao-supabase'],
    queryFn: verificarConexao,
  })

  const mes = nomeDaCompetencia(competenciaAtual())

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
      <header>
        <p className="text-sm font-medium text-marca-700 first-letter:uppercase">{mes}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Olá, Lucas e Emillia 👋</h1>
        <p className="mt-2 text-stone-600">
          Falta ligar o app ao banco de dados. Siga o aviso abaixo e recarregue a página.
        </p>
      </header>

      <section aria-label="Abas planejadas" className="flex flex-wrap gap-2">
        {ABAS.map((aba) => (
          <span key={aba.nome} className={`rounded-full px-3 py-1 text-sm font-medium ${aba.cor}`}>
            {aba.nome}
          </span>
        ))}
        <span className="rounded-full border border-dashed border-stone-300 px-3 py-1 text-sm text-stone-500">
          + nova conta
        </span>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-superficie p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">
          Conexão com o Supabase
        </h2>
        <StatusConexao
          carregando={conexao.isPending}
          dados={conexao.data}
          configurado={supabaseConfigurado}
        />
      </section>

      <footer className="mt-auto text-center text-xs text-stone-500">
        Exemplo de formatação: {formatarCentavos(360000)} em 12x de {formatarCentavos(30000)}
      </footer>
    </main>
  )
}

function StatusConexao({
  carregando,
  dados,
  configurado,
}: {
  carregando: boolean
  dados: Awaited<ReturnType<typeof verificarConexao>> | undefined
  configurado: boolean
}) {
  if (!configurado) {
    return (
      <div className="mt-2 flex gap-3">
        <Bolinha cor="bg-amber-400" />
        <div className="text-sm">
          <p className="font-medium">Ainda não configurado</p>
          <p className="mt-1 text-stone-600">
            Copie <code className="rounded bg-stone-100 px-1">.env.example</code> para{' '}
            <code className="rounded bg-stone-100 px-1">.env.local</code> e preencha com a URL e a
            chave anon do projeto Supabase.
          </p>
        </div>
      </div>
    )
  }

  if (carregando || !dados) {
    return (
      <div className="mt-2 flex items-center gap-3 text-sm">
        <Bolinha cor="bg-stone-300 animate-pulse" />
        Verificando…
      </div>
    )
  }

  if (dados.ok) {
    return (
      <div className="mt-2 flex items-center gap-3 text-sm font-medium">
        <Bolinha cor="bg-emerald-500" />
        Conectado
      </div>
    )
  }

  const mensagens = {
    'nao-configurado': 'Ainda não configurado',
    'chave-invalida': 'A chave anon foi recusada. Confira o valor no .env.local.',
    'sem-resposta': 'O Supabase não respondeu. Confira a URL no .env.local.',
  }

  return (
    <div className="mt-2 flex gap-3 text-sm">
      <Bolinha cor="bg-red-500" />
      <div>
        <p className="font-medium">{mensagens[dados.motivo]}</p>
        {dados.detalhe && <p className="mt-1 text-stone-500">{dados.detalhe}</p>}
      </div>
    </div>
  )
}

function Bolinha({ cor }: { cor: string }) {
  return <span aria-hidden className={`mt-1.5 inline-block size-2.5 shrink-0 rounded-full ${cor}`} />
}
