import { Link } from 'react-router-dom'
import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { useContas, useMembros } from '../hooks/useDados.ts'
import { useLancamentos } from '../hooks/useLancamentos.ts'
import { nomeDaCompetencia } from '../lib/datas.ts'
import { formatarCentavos } from '../lib/dinheiro.ts'
import { calcularTotais } from '../lib/totais.ts'
import { Aviso, Bolinha, Carregando } from '../components/ui.tsx'

export default function Resumo() {
  const { competencia } = useCompetencia()
  const membros = useMembros()
  const contas = useContas()
  const lancamentos = useLancamentos(competencia)

  if (membros.isPending || contas.isPending || lancamentos.isPending) return <Carregando />
  if (lancamentos.isError) {
    return <Aviso titulo="Não foi possível carregar os lançamentos">{lancamentos.error.message}</Aviso>
  }

  const todos = lancamentos.data ?? []
  const compartilhadas = contas.data?.filter((c) => c.tipo === 'compartilhada') ?? []
  const pessoalDe = (membroId: string) =>
    contas.data?.find((c) => c.tipo === 'pessoal' && c.dono_id === membroId)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">
        Resumo de <span className="lowercase">{nomeDaCompetencia(competencia)}</span>
      </h1>

      <div className="grid gap-3 sm:grid-cols-2">
        {membros.data?.map((m) => {
          const conta = pessoalDe(m.id)
          const t = calcularTotais(todos.filter((l) => l.membro_id === m.id))
          return (
            <Card key={m.id} titulo={m.nome} cor={m.cor} para={conta ? `/conta/${conta.id}` : undefined}>
              {t.saidas === 0 && t.entradas === 0 ? (
                <Vazio />
              ) : (
                <>
                  <Linha rotulo="A pagar no mês" valor={t.saidas} />
                  <Linha rotulo="Pendente" valor={t.pendente} destaque={t.pendente > 0 ? 'text-amber-700' : ''} />
                  {t.entradas > 0 && <Linha rotulo="Saldo" valor={t.saldo} destaque={t.saldo < 0 ? 'text-red-700' : ''} />}
                </>
              )}
            </Card>
          )
        })}

        {compartilhadas.map((c) => {
          const daConta = todos.filter((l) => l.conta_id === c.id)
          const t = calcularTotais(daConta)
          return (
            <Card key={c.id} titulo={c.nome} cor={c.cor} para={`/conta/${c.id}`}>
              {t.saidas === 0 ? (
                <Vazio />
              ) : (
                <>
                  <Linha rotulo="Total do mês" valor={t.saidas} />
                  {membros.data?.map((m) => (
                    <Linha
                      key={m.id}
                      rotulo={m.nome}
                      valor={calcularTotais(daConta.filter((l) => l.membro_id === m.id)).saidas}
                      suave
                    />
                  ))}
                </>
              )}
            </Card>
          )
        })}
      </div>

      <p className="text-center text-xs text-stone-400">
        Vencimentos próximos, atrasados e gastos por categoria aparecem aqui na etapa 7.
      </p>
    </div>
  )
}

function Vazio() {
  return <p className="text-sm text-stone-500">Nenhum lançamento neste mês.</p>
}

function Linha({
  rotulo,
  valor,
  destaque = '',
  suave,
}: {
  rotulo: string
  valor: number
  destaque?: string
  suave?: boolean
}) {
  return (
    <div className={`flex items-baseline justify-between text-sm ${suave ? 'text-stone-500' : ''}`}>
      <span>{rotulo}</span>
      <span className={`tabular-nums ${suave ? '' : 'font-semibold'} ${destaque}`}>{formatarCentavos(valor)}</span>
    </div>
  )
}

function Card({
  titulo,
  cor,
  para,
  children,
}: {
  titulo: string
  cor: string | null
  para?: string
  children: React.ReactNode
}) {
  const conteudo = (
    <>
      <div className="mb-3 flex items-center gap-2">
        <Bolinha cor={cor} />
        <span className="font-semibold">{titulo}</span>
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </>
  )
  const classe =
    'block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-colors hover:border-stone-300'
  return para ? (
    <Link to={para} className={classe}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  )
}
