import { Link } from 'react-router-dom'
import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { useContas, useMembros } from '../hooks/useDados.ts'
import { nomeDaCompetencia } from '../lib/datas.ts'
import { Bolinha, Carregando } from '../components/ui.tsx'

export default function Resumo() {
  const { competencia } = useCompetencia()
  const membros = useMembros()
  const contas = useContas()

  if (membros.isPending || contas.isPending) return <Carregando />

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
          return (
            <CardResumo
              key={m.id}
              titulo={m.nome}
              cor={m.cor}
              para={conta ? `/conta/${conta.id}` : undefined}
            />
          )
        })}
        {compartilhadas.map((c) => (
          <CardResumo key={c.id} titulo={c.nome} cor={c.cor} para={`/conta/${c.id}`} />
        ))}
      </div>

      <p className="text-center text-xs text-stone-400">
        Os totais, vencimentos e atrasados aparecem aqui na etapa 7.
      </p>
    </div>
  )
}

function CardResumo({ titulo, cor, para }: { titulo: string; cor: string | null; para?: string }) {
  const conteudo = (
    <>
      <div className="flex items-center gap-2">
        <Bolinha cor={cor} />
        <span className="font-semibold">{titulo}</span>
      </div>
      <p className="mt-3 text-sm text-stone-500">Nenhum lançamento neste mês.</p>
    </>
  )
  const classe =
    'block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-stone-300'
  return para ? (
    <Link to={para} className={classe}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  )
}
