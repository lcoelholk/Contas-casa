import { useParams } from 'react-router-dom'
import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { useContas, useMembros } from '../hooks/useDados.ts'
import { nomeDaCompetencia } from '../lib/datas.ts'
import { Aviso, Bolinha, Carregando } from '../components/ui.tsx'
import type { Conta, Membro } from '../types/banco.ts'

/** Página de uma aba: pessoal (Lucas / Emillia) ou compartilhada (Casa...) */
export default function ContaPage() {
  const { id } = useParams()
  const contas = useContas()
  const membros = useMembros()

  if (contas.isPending || membros.isPending) return <Carregando />

  const conta = contas.data?.find((c) => c.id === id)
  if (!conta) return <Aviso titulo="Conta não encontrada">Ela pode ter sido arquivada.</Aviso>

  const dono = membros.data?.find((m) => m.id === conta.dono_id) ?? null
  const compartilhadas = contas.data?.filter((c) => c.tipo === 'compartilhada') ?? []

  return conta.tipo === 'pessoal' ? (
    <PaginaPessoal conta={conta} dono={dono} compartilhadas={compartilhadas} />
  ) : (
    <PaginaCompartilhada conta={conta} membros={membros.data ?? []} />
  )
}

function Cabecalho({ conta, subtitulo }: { conta: Conta; subtitulo: string }) {
  const { competencia } = useCompetencia()
  return (
    <div>
      <h1 className="flex items-center gap-2 text-lg font-semibold">
        <Bolinha cor={conta.cor} className="size-3" />
        {conta.nome}
      </h1>
      <p className="text-sm text-stone-500">
        {subtitulo} · <span className="lowercase">{nomeDaCompetencia(competencia)}</span>
      </p>
    </div>
  )
}

function Secao({ titulo, vazio }: { titulo: string; vazio: string }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">{titulo}</h2>
      <p className="mt-3 text-sm text-stone-500">{vazio}</p>
    </section>
  )
}

function PaginaPessoal({
  conta,
  dono,
  compartilhadas,
}: {
  conta: Conta
  dono: Membro | null
  compartilhadas: Conta[]
}) {
  return (
    <div className="flex flex-col gap-4">
      <Cabecalho conta={conta} subtitulo={`Conta pessoal${dono ? ` de ${dono.nome}` : ''}`} />
      <Secao titulo="Pessoal" vazio="Nenhum gasto ou entrada neste mês." />
      {compartilhadas.map((c) => (
        <Secao
          key={c.id}
          titulo={`Parte em ${c.nome}`}
          vazio={`Nada de ${c.nome} para ${dono?.nome ?? 'esta pessoa'} neste mês.`}
        />
      ))}
      <p className="text-center text-xs text-stone-400">Adicionar gastos e entradas chega na etapa 4.</p>
    </div>
  )
}

function PaginaCompartilhada({ conta, membros }: { conta: Conta; membros: Membro[] }) {
  return (
    <div className="flex flex-col gap-4">
      <Cabecalho conta={conta} subtitulo={`Dividida entre ${membros.map((m) => m.nome).join(' e ')}`} />
      <Secao titulo="Contas do mês" vazio="Nenhuma conta recorrente ainda (etapa 5)." />
      <Secao titulo="Compras parceladas" vazio="Nenhuma compra parcelada ainda (etapa 6)." />
      <Secao titulo="Gastos avulsos" vazio="Nenhum gasto avulso neste mês (etapa 4)." />
    </div>
  )
}
