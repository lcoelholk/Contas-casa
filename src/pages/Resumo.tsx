import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { usePessoa } from '../hooks/usePessoa.tsx'
import { useNovoLancamento } from '../hooks/useNovoLancamento.tsx'
import { abasDoMembro } from '../lib/contas.ts'
import { useMembroAtual, useMembros, useTodasContas } from '../hooks/useDados.ts'
import { useAlertas, useCategorias, useLancamentos, useMarcarPago } from '../hooks/useLancamentos.ts'
import {
  competenciaAtual,
  diaDe,
  formatarDiaComSemana,
  formatarDiaMes,
  hoje,
  nomeCurtoDoMes,
  somarMeses,
} from '../lib/datas.ts'
import { dataDoLancamento, gastoPorDia, ritmo } from '../lib/visaoGeral.ts'
import { Painel } from '../components/AnaliseDoMes.tsx'
import { Folha } from '../components/Folha.tsx'
import { IconeCartao, IconeGrafico, IconeRecibo, IconeRepetir } from '../components/icones.tsx'
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
    <div className="flex flex-col gap-4">
      <CartaoDoMes
        lancamentos={doMes}
        anteriores={doMesAnterior}
        todos={todos}
        membros={listaMembros}
        contas={listaContas}
        compartilhadas={compartilhadas}
        pessoa={pessoa}
        setPessoa={setPessoa}
      />
      <Alertas membros={listaMembros} contas={listaContas} pessoa={pessoa} />
      <AlertaLimites lancamentos={todos} categorias={categorias.data ?? []} />
      <Atalhos contas={listaContas} />
      <TransacoesRecentes lancamentos={doMes} categorias={categorias.data ?? []} membros={listaMembros} />
      <Link
        to="/graficos"
        className="flex min-h-14 items-center gap-3 rounded-2xl border border-stone-200 bg-superficie px-4 shadow-sm hover:border-stone-300"
      >
        <IconeGrafico className="size-6 text-marca-700" />
        <span className="flex flex-1 flex-col">
          <span className="font-medium">Análise do mês</span>
          <span className="text-xs text-stone-500">
            Ritmo de gastos, mapa de calor e categorias{nomePessoa ? ` de ${nomePessoa}` : ''}
          </span>
        </span>
        <span aria-hidden className="text-stone-500">
          ›
        </span>
      </Link>
    </div>
  )
}

/**
 * O número que importa primeiro: quanto ainda falta pagar no mês.
 * Abaixo: pago, entradas e saldo; a comparação com o mês passado; e as contas compartilhadas.
 */
function CartaoDoMes({
  lancamentos,
  anteriores,
  todos,
  membros,
  contas,
  compartilhadas,
  pessoa,
  setPessoa,
}: {
  lancamentos: Lancamento[]
  anteriores: Lancamento[]
  todos: Lancamento[]
  membros: Membro[]
  contas: Conta[]
  compartilhadas: Conta[]
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
    <section aria-label={titulo} className="rounded-2xl border border-stone-200 bg-superficie p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setEscolhendo(true)}
          aria-label={`${titulo}. Trocar de quem ver`}
          className="-my-2 -ml-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-stone-600 hover:bg-stone-100"
        >
          {titulo}
          <span aria-hidden className="text-xs">
            ▾
          </span>
        </button>
        {principal && (
          <Link
            to={`/conta/${principal.id}`}
            className="-my-2 -mr-2 flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-marca-700 hover:bg-marca-50"
          >
            Ver contas ›
          </Link>
        )}
      </div>

      {t.saidas === 0 && t.entradas === 0 ? (
        <p className="mt-2 text-sm text-stone-500">Nada lançado neste mês ainda. Use o + para começar.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-stone-600">{t.pendente > 0 ? 'Falta pagar' : 'Tudo pago'}</p>
          <p className={`text-4xl font-bold tracking-tight ${t.pendente > 0 ? '' : 'text-emerald-700'}`}>
            {formatarCentavos(t.pendente)}
          </p>
          <dl className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-2 text-sm">
            <Numero rotulo="Já pago" valor={t.pago} />
            <Numero rotulo="Entradas" valor={t.entradas} />
            <Numero rotulo="Saldo" valor={t.saldo} tom={t.saldo < 0 ? 'text-red-700' : undefined} />
          </dl>
          {r.percentual !== null && r.percentual !== 0 && (
            <p className="mt-3 text-sm text-stone-600">
              <span className={`font-semibold ${r.percentual > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {r.percentual > 0 ? '▲' : '▼'} {Math.abs(r.percentual)}%
              </span>{' '}
              de gasto vs o mesmo ponto de {mesAnterior}
            </p>
          )}
        </>
      )}

      {compartilhadas.length > 0 && (
        <ul className="mt-3 divide-y divide-stone-100 border-t border-stone-100">
          {compartilhadas.map((c) => {
            const daConta = todos.filter((l) => l.conta_id === c.id)
            const total = calcularTotais(daConta).saidas
            const parte = pessoa === 'todos' ? null : calcularTotais(daConta.filter((l) => l.membro_id === pessoa)).saidas
            return (
              <li key={c.id}>
                <Link to={`/conta/${c.id}`} className="flex min-h-12 items-center gap-2 py-2 text-sm">
                  <Bolinha cor={c.cor} />
                  <span className="flex-1 font-medium">{c.nome}</span>
                  <span className="text-right text-stone-600 tabular-nums">
                    {parte !== null ? (
                      <>
                        sua parte <span className="font-semibold text-stone-900">{formatarCentavos(parte)}</span>
                        <span className="block text-xs">de {formatarCentavos(total)}</span>
                      </>
                    ) : (
                      <span className="font-semibold text-stone-900">{formatarCentavos(total)}</span>
                    )}
                  </span>
                  <span aria-hidden className="text-stone-500">
                    ›
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

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
    </section>
  )
}

function Numero({ rotulo, valor, tom }: { rotulo: string; valor: number; tom?: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{rotulo}</dt>
      <dd className={`font-semibold whitespace-nowrap tabular-nums ${tom ?? ''}`}>{formatarCentavos(valor)}</dd>
    </div>
  )
}

/** Atrasados e o que vence nos próximos 7 dias (a partir de hoje, de qualquer mês) */
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
    const dias = l.vencimento === dataHoje ? 'vence hoje' : `${atrasado ? 'venceu' : 'vence'} ${formatarDiaMes(l.vencimento!)}`
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
            <span className="text-xs text-stone-500">
              <Bolinha cor={membro?.cor ?? null} className="mr-1 size-2 align-middle" />
              {membro?.nome}
              {conta && conta.tipo === 'compartilhada' ? ` · ${conta.nome}` : ''}
              {' · '}
              <span className={atrasado ? 'font-medium text-red-700' : l.vencimento === dataHoje ? 'font-medium text-amber-700' : ''}>
                {dias}
              </span>
            </span>
          </span>
          <span className="shrink-0 font-semibold tabular-nums">{formatarCentavos(l.valor_centavos)}</span>
        </button>
      </li>
    )
  }

  if (atrasados.length === 0 && proximos.length === 0) {
    return (
      <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <span aria-hidden>✓ </span>Nada atrasado nem vencendo nos próximos 7 dias.
      </p>
    )
  }

  return (
    <>
      {atrasados.length > 0 && (
        <Bloco titulo={`Atrasados (${atrasados.length})`} tom="vermelho">
          {atrasados.map((l) => item(l, true))}
        </Bloco>
      )}
      {proximos.length > 0 && (
        <Bloco titulo="Vence nos próximos 7 dias" tom="neutro">
          {proximos.map((l) => item(l, false))}
        </Bloco>
      )}
    </>
  )
}

function Bloco({ titulo, tom, children }: { titulo: string; tom: 'vermelho' | 'neutro'; children: ReactNode }) {
  return (
    <section
      aria-label={titulo}
      className={`rounded-2xl border px-4 pt-3 pb-1 shadow-sm ${
        tom === 'vermelho' ? 'border-red-200 bg-red-50/60' : 'border-stone-200 bg-superficie'
      }`}
    >
      <h2
        className={`text-sm font-semibold tracking-wide uppercase ${tom === 'vermelho' ? 'text-red-800' : 'text-stone-500'}`}
      >
        {titulo}
      </h2>
      <ul className="divide-y divide-stone-100">{children}</ul>
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
  return (
    <Link
      to="/metas"
      className="block rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
    >
      <p className="font-semibold">
        <span aria-hidden>⚠ </span>Limite de gastos
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {preocupantes.map(({ orcamento, situacao }) => (
          <li key={orcamento.id}>
            {nome(orcamento.categoria_id)}:{' '}
            {situacao.status === 'estourou'
              ? `passou ${formatarCentavos(-situacao.restante)} do limite`
              : `${situacao.percentual}% do limite`}
          </li>
        ))}
      </ul>
    </Link>
  )
}

function TransacoesRecentes({
  lancamentos,
  categorias,
  membros,
}: {
  lancamentos: Lancamento[]
  categorias: Categoria[]
  membros: Membro[]
}) {
  const recentes = [...lancamentos].sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1)).slice(0, 6)
  const porData = new Map<string, Lancamento[]>()
  for (const l of [...recentes].sort((a, b) => (dataDoLancamento(a) < dataDoLancamento(b) ? 1 : -1))) {
    const d = dataDoLancamento(l)
    porData.set(d, [...(porData.get(d) ?? []), l])
  }
  return (
    <Painel titulo="Transações recentes" link={{ texto: 'ver todas', para: '/transacoes' }}>
      {recentes.length === 0 ? (
        <p className="text-sm text-stone-500">Nenhuma transação neste mês.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {[...porData.entries()].map(([data, ls]) => (
            <div key={data}>
              <p className="text-xs font-medium text-stone-500 uppercase">{formatarDiaComSemana(data)}</p>
              <ul>
                {ls.map((l) => {
                  const cat = categorias.find((c) => c.id === l.categoria_id)
                  const membro = membros.find((m) => m.id === l.membro_id)
                  return (
                    <li key={l.id} className="flex items-center gap-2 py-1.5">
                      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                        {cat?.icone ?? (l.tipo === 'entrada' ? '💰' : '•')}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{l.descricao}</span>
                        <span className="truncate text-xs text-stone-500">
                          {cat?.nome ?? 'Sem categoria'} · {membro?.nome}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 text-sm font-semibold tabular-nums ${l.tipo === 'entrada' ? 'text-emerald-700' : ''}`}
                      >
                        {l.tipo === 'entrada' ? '+' : '−'}
                        {formatarCentavos(l.valor_centavos)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Painel>
  )
}

/** Atalhos do Início: ir para as abas de quem entrou e lançar sem trocar de tela */
function Atalhos({ contas }: { contas: Conta[] }) {
  const { membro: eu } = useMembroAtual()
  const novo = useNovoLancamento()
  const { minhas, compartilhadas } = abasDoMembro(contas, eu?.id)
  const classeLink =
    'flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border border-stone-200 bg-superficie px-3 text-sm font-medium shadow-sm hover:border-stone-300'
  const classeAcao =
    'flex flex-col items-center gap-1 rounded-2xl bg-marca-50 px-2 py-3 text-xs font-semibold text-marca-700 hover:bg-marca-100'
  return (
    <section aria-label="Atalhos" className="flex flex-col gap-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {[...minhas, ...compartilhadas].map((c) => (
          <Link key={c.id} to={`/conta/${c.id}`} className={classeLink}>
            <Bolinha cor={c.cor} />
            {c.tipo === 'pessoal' && c.dono_id === eu?.id && minhas[0]?.id === c.id ? 'Minhas contas' : c.nome}
            <span aria-hidden className="text-stone-500">
              ›
            </span>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => novo('avulso')} className={classeAcao}>
          <IconeRecibo />
          Gasto ou entrada
        </button>
        <button type="button" onClick={() => novo('fixa')} className={classeAcao}>
          <IconeRepetir />
          Conta fixa
        </button>
        <button type="button" onClick={() => novo('parcelada')} className={classeAcao}>
          <IconeCartao />
          Parcelado
        </button>
      </div>
    </section>
  )
}
