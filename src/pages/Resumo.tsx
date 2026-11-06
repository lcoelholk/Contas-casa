import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { usePessoa } from '../hooks/usePessoa.tsx'
import { useMembroAtual, useMembros, useTodasContas } from '../hooks/useDados.ts'
import { useAlertas, useCategorias, useLancamentos, useMarcarPago } from '../hooks/useLancamentos.ts'
import {
  competenciaAtual,
  diaDe,
  formatarDiaMes,
  hoje,
  nomeCurtoDoMes,
  somarMeses,
} from '../lib/datas.ts'
import { dataDoLancamento, gastoPorDia, ritmo } from '../lib/visaoGeral.ts'
import { Painel } from '../components/AnaliseDoMes.tsx'
import { Folha } from '../components/Folha.tsx'
import { IconeGrafico } from '../components/icones.tsx'
import { Destaque } from '../components/Destaque.tsx'
import { formatarCentavos } from '../lib/dinheiro.ts'
import { calcularTotais } from '../lib/totais.ts'
import { contaPrincipalDe } from '../lib/contas.ts'
import { situacoesDoMes } from '../lib/analises.ts'
import { useOrcamentos } from '../hooks/useAnalises.ts'
import { separarAlertas } from '../lib/resumo.ts'
import { Aviso, Bolinha, Carregando } from '../components/ui.tsx'
import { CheckPago } from '../components/lancamentos.tsx'
import { EscolhaFiltro } from '../components/Filtros.tsx'
import type { Categoria, Conta, Lancamento, Membro } from '../types/banco.ts'

export default function Resumo() {
  const { competencia } = useCompetencia()
  const membros = useMembros()
  const contas = useTodasContas()
  const lancamentos = useLancamentos(competencia)
  const anteriores = useLancamentos(somarMeses(competencia, -1))
  const categorias = useCategorias()
  const { pessoa, setPessoa } = usePessoa()

  if (membros.isPending || contas.isPending || lancamentos.isPending) return <Carregando />
  if (lancamentos.isError) {
    return <Aviso titulo="Não foi possível carregar os lançamentos">{lancamentos.error.message}</Aviso>
  }

  const todos = lancamentos.data ?? []
  const listaMembros = membros.data ?? []
  const listaContas = contas.data ?? []
  // Compartilhadas arquivadas só aparecem se tiverem algo neste mês
  const compartilhadas = listaContas.filter(
    (c) => c.tipo === 'compartilhada' && (!c.arquivada || todos.some((l) => l.conta_id === c.id)),
  )

  const daPessoa = <T extends Lancamento>(ls: T[]) => (pessoa === 'todos' ? ls : ls.filter((l) => l.membro_id === pessoa))
  const doMes = daPessoa(todos)
  const doMesAnterior = daPessoa(anteriores.data ?? [])

  const nomePessoa = listaMembros.find((m) => m.id === pessoa)?.nome

  return (
    <div className="flex flex-col gap-5">
      <CartaoDoMes
        lancamentos={doMes}
        anteriores={doMesAnterior}
        membros={listaMembros}
        contas={listaContas}
        pessoa={pessoa}
        setPessoa={setPessoa}
      />
      <SuasContas todos={todos} contas={listaContas} compartilhadas={compartilhadas} pessoa={pessoa} />
      <div className="flex flex-col gap-2 empty:hidden">
        <Alertas membros={listaMembros} contas={listaContas} pessoa={pessoa} />
        <AlertaLimites lancamentos={todos} categorias={categorias.data ?? []} />
      </div>
      <TransacoesRecentes lancamentos={doMes} categorias={categorias.data ?? []} contas={listaContas} />
      <Link
        to="/graficos"
        className="mx-auto flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-marca-700 hover:bg-marca-50"
      >
        <IconeGrafico className="size-5" />
        Análise do mês{nomePessoa ? ` de ${nomePessoa}` : ''} ›
      </Link>
    </div>
  )
}

/**
 * O número que importa primeiro: quanto ainda falta pagar no mês, no bloco colorido do topo.
 * "Seu mês ▾" troca de quem ver; embaixo, a comparação com o mês passado.
 */
function CartaoDoMes({
  lancamentos,
  anteriores,
  membros,
  contas,
  pessoa,
  setPessoa,
}: {
  lancamentos: Lancamento[]
  anteriores: Lancamento[]
  membros: Membro[]
  contas: Conta[]
  pessoa: string
  setPessoa: (p: string) => void
}) {
  const { competencia } = useCompetencia()
  const { membro: eu } = useMembroAtual()
  const [escolhendo, setEscolhendo] = useState(false)
  const t = calcularTotais(lancamentos)
  const ehMesAtual = competencia === competenciaAtual()
  const porDia = gastoPorDia(lancamentos, competencia)
  const r = ritmo(porDia, gastoPorDia(anteriores, somarMeses(competencia, -1)), ehMesAtual ? diaDe(hoje()) : porDia.length)
  const mesAnterior = nomeCurtoDoMes(somarMeses(competencia, -1))
  const nome = membros.find((m) => m.id === pessoa)?.nome
  const titulo = pessoa === 'todos' ? 'Mês de vocês' : pessoa === eu?.id ? 'Seu mês' : `Mês de ${nome}`
  const principal = pessoa === 'todos' ? undefined : contaPrincipalDe(contas, pessoa)

  return (
    <>
      <Destaque
        totais={t}
        topo={
          <>
            <button
              type="button"
              onClick={() => setEscolhendo(true)}
              aria-label={`${titulo}. Trocar de quem ver`}
              className="-ml-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              {titulo}
              <span aria-hidden className="text-xs">
                ▾
              </span>
            </button>
            {principal && (
              <Link
                to={`/conta/${principal.id}`}
                className="-mr-2 flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-white/90 hover:bg-white/10"
              >
                Ver contas ›
              </Link>
            )}
          </>
        }
      >
        {r.percentual !== null && r.percentual !== 0 && (
          <p className="mt-1 text-sm text-white/80">
            {r.percentual > 0 ? '▲' : '▼'} {Math.abs(r.percentual)}% de gasto vs o mesmo ponto de {mesAnterior}
          </p>
        )}
      </Destaque>

      <Folha aberta={escolhendo} onFechar={() => setEscolhendo(false)} titulo="Ver o mês de quem?">
        <EscolhaFiltro
          rotulo="De quem"
          valor={pessoa}
          onChange={(v) => {
            setPessoa(v)
            setEscolhendo(false)
          }}
          opcoes={[{ valor: 'todos', texto: 'Os dois' }, ...membros.map((m) => ({ valor: m.id, texto: m.nome }))]}
        />
      </Folha>
    </>
  )
}

/** As contas compartilhadas como cartões (a sua parte em cada), que rolam de lado */
function SuasContas({
  todos,
  contas,
  compartilhadas,
  pessoa,
}: {
  todos: Lancamento[]
  contas: Conta[]
  compartilhadas: Conta[]
  pessoa: string
}) {
  const principal = pessoa === 'todos' ? undefined : contaPrincipalDe(contas, pessoa)
  if (compartilhadas.length === 0) return null
  return (
    <ul aria-label="Contas compartilhadas" className="-mx-4 flex gap-3 overflow-x-auto px-4 [scrollbar-width:none]">
      {compartilhadas.map((c) => {
        const daConta = todos.filter((l) => l.conta_id === c.id)
        const total = calcularTotais(daConta).saidas
        const parte = principal ? calcularTotais(daConta.filter((l) => l.membro_id === pessoa)).saidas : null
        return (
          <li key={c.id} className="shrink-0">
            <Link to={`/conta/${c.id}`} className="flex min-w-40 flex-col gap-2 rounded-2xl bg-superficie p-4">
              <span className="flex items-center gap-2 text-sm font-medium text-stone-600">
                <Bolinha cor={c.cor} />
                {c.nome}
              </span>
              <span>
                <span className="block text-xl font-semibold whitespace-nowrap tabular-nums">
                  {formatarCentavos(parte ?? total)}
                </span>
                <span className="text-xs whitespace-nowrap text-stone-500 tabular-nums">
                  {parte !== null ? `sua parte de ${formatarCentavos(total)}` : 'total do mês'}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Atrasados e o que vence nos próximos 7 dias (a partir de hoje, de qualquer mês).
 * Cada grupo é uma linha só ("4 contas atrasadas · R$ 322,00") que abre a lista ao tocar.
 */
function Alertas({ membros, contas, pessoa }: { membros: Membro[]; contas: Conta[]; pessoa: string }) {
  const alertas = useAlertas()
  const marcarPago = useMarcarPago()
  const { irPara } = useCompetencia()
  const navigate = useNavigate()
  const dataHoje = hoje()

  if (alertas.isPending) return null
  if (alertas.isError) return <Aviso titulo="Não foi possível carregar os vencimentos">{alertas.error.message}</Aviso>

  const { atrasados, proximos } = separarAlertas(
    (alertas.data ?? []).filter((l) => pessoa === 'todos' || l.membro_id === pessoa),
    dataHoje,
  )
  const abrir = (l: Lancamento) => {
    irPara(l.competencia)
    navigate(`/conta/${l.conta_id}`)
  }
  const item = (l: Lancamento, atrasado: boolean) => {
    const membro = membros.find((m) => m.id === l.membro_id)
    const conta = contas.find((c) => c.id === l.conta_id)
    const quando =
      l.vencimento === dataHoje ? 'vence hoje' : `${atrasado ? 'venceu' : 'vence'} ${formatarDiaMes(l.vencimento!)}`
    const detalhe = [pessoa === 'todos' ? membro?.nome : null, conta?.tipo === 'compartilhada' ? conta.nome : null, quando]
      .filter(Boolean)
      .join(' · ')
    return (
      <li key={l.id} className="flex items-center gap-3 py-2.5">
        <CheckPago
          pago={false}
          onClick={() => marcarPago.mutate({ id: l.id, pago: true })}
          rotulo={`${l.descricao} de ${membro?.nome ?? ''}: marcar como pago`}
        />
        <button type="button" onClick={() => abrir(l)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{l.descricao}</span>
            <span className="truncate text-xs text-stone-500">{detalhe}</span>
          </span>
          <span className="shrink-0 font-semibold whitespace-nowrap tabular-nums">{formatarCentavos(l.valor_centavos)}</span>
        </button>
      </li>
    )
  }

  return (
    <>
      {atrasados.length > 0 && (
        <Recolhido
          tom="vermelho"
          titulo={atrasados.length === 1 ? '1 conta atrasada' : `${atrasados.length} contas atrasadas`}
          total={atrasados.reduce((s, l) => s + l.valor_centavos, 0)}
        >
          {atrasados.map((l) => item(l, true))}
        </Recolhido>
      )}
      {proximos.length > 0 && (
        <Recolhido
          tom="neutro"
          titulo={proximos.length === 1 ? '1 vence em 7 dias' : `${proximos.length} vencem em 7 dias`}
          total={proximos.reduce((s, l) => s + l.valor_centavos, 0)}
        >
          {proximos.map((l) => item(l, false))}
        </Recolhido>
      )}
    </>
  )
}

/** Uma linha com o resumo; tocar mostra a lista embaixo */
function Recolhido({
  titulo,
  total,
  tom,
  children,
}: {
  titulo: string
  total: number
  tom: 'vermelho' | 'neutro'
  children: ReactNode
}) {
  const [aberto, setAberto] = useState(false)
  const cor = tom === 'vermelho' ? 'bg-red-50 text-red-800' : 'bg-superficie text-stone-700'
  return (
    <section aria-label={titulo} className={`rounded-2xl ${tom === 'vermelho' ? 'bg-red-50' : 'bg-superficie'}`}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className={`flex min-h-12 w-full items-center gap-2 rounded-2xl px-4 text-left text-sm font-semibold ${cor}`}
      >
        <span className="flex-1">{titulo}</span>
        <span className="whitespace-nowrap tabular-nums">{formatarCentavos(total)}</span>
        <span aria-hidden className={`transition-transform ${aberto ? 'rotate-90' : ''}`}>
          ›
        </span>
      </button>
      {aberto && <ul className="divide-y divide-stone-100 px-4 pb-1">{children}</ul>}
    </section>
  )
}

/** Categorias perto ou acima do limite do mês (detalhes na tela de Metas) */
function AlertaLimites({ lancamentos, categorias }: { lancamentos: Lancamento[]; categorias: Categoria[] }) {
  const { competencia } = useCompetencia()
  const orcamentos = useOrcamentos()
  if (!orcamentos.data) return null
  const preocupantes = situacoesDoMes(orcamentos.data, lancamentos, competencia).filter((s) => s.situacao.status !== 'ok')
  if (preocupantes.length === 0) return null
  const nome = (id: string) => categorias.find((c) => c.id === id)?.nome ?? 'Categoria'
  const texto = preocupantes
    .map(({ orcamento, situacao }) =>
      situacao.status === 'estourou'
        ? `${nome(orcamento.categoria_id)} passou do limite`
        : `${nome(orcamento.categoria_id)} em ${situacao.percentual}%`,
    )
    .join(' · ')
  return (
    <Link to="/metas" className="flex min-h-12 items-center gap-2 rounded-2xl bg-amber-50 px-4 text-sm text-amber-900">
      <span className="font-semibold">Limite</span>
      <span className="min-w-0 flex-1 truncate">{texto}</span>
      <span aria-hidden>›</span>
    </Link>
  )
}

/** As últimas lançadas no mês, numa lista simples: uma linha de detalhe por gasto */
function TransacoesRecentes({
  lancamentos,
  categorias,
  contas,
}: {
  lancamentos: Lancamento[]
  categorias: Categoria[]
  contas: Conta[]
}) {
  const recentes = [...lancamentos].sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1)).slice(0, 6)
  const dataHoje = hoje()
  return (
    <Painel titulo="Recentes" link={{ texto: 'ver todas', para: '/transacoes' }}>
      {recentes.length === 0 ? (
        <p className="text-sm text-stone-500">Nenhuma transação neste mês.</p>
      ) : (
        <ul className="-my-1 divide-y divide-stone-100">
          {recentes.map((l) => {
            const cat = categorias.find((c) => c.id === l.categoria_id)
            const conta = contas.find((c) => c.id === l.conta_id)
            const data = dataDoLancamento(l)
            const detalhe = [conta?.tipo === 'compartilhada' ? conta.nome : null, data === dataHoje ? 'Hoje' : formatarDiaMes(data)]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-stone-100">
                  {cat?.icone ?? (l.tipo === 'entrada' ? '💰' : '•')}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{l.descricao}</span>
                  <span className="truncate text-xs text-stone-500">{detalhe}</span>
                </span>
                <span
                  className={`shrink-0 font-semibold whitespace-nowrap tabular-nums ${l.tipo === 'entrada' ? 'text-emerald-700' : ''}`}
                >
                  {l.tipo === 'entrada' ? '+' : ''}
                  {formatarCentavos(l.valor_centavos)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Painel>
  )
}
