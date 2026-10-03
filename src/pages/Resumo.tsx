import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { usePessoa } from '../hooks/usePessoa.tsx'
import { useNovoLancamento } from '../hooks/useNovoLancamento.tsx'
import { abasDoMembro } from '../lib/contas.ts'
import { useMembroAtual, useMembros, useTodasContas } from '../hooks/useDados.ts'
import { useAlertas, useCategorias, useLancamentos, useMarcarPago } from '../hooks/useLancamentos.ts'
import {
  competenciaAtual,
  diaDaSemanaDoInicio,
  diaDe,
  formatarDiaComSemana,
  formatarDiaMes,
  hoje,
  nomeCurtoDoMes,
  nomeDaCompetencia,
  somarMeses,
} from '../lib/datas.ts'
import { acumulado, comparativoCategorias, dataDoLancamento, gastoPorDia, ritmo } from '../lib/visaoGeral.ts'
import { GraficoLinhas, MapaDeCalor } from '../components/graficos.tsx'
import { formatarCentavos } from '../lib/dinheiro.ts'
import { calcularTotais } from '../lib/totais.ts'
import { contaPrincipalDe } from '../lib/contas.ts'
import { situacoesDoMes } from '../lib/analises.ts'
import { useOrcamentos } from '../hooks/useAnalises.ts'
import { separarAlertas } from '../lib/resumo.ts'
import { Aviso, Bolinha, Carregando } from '../components/ui.tsx'
import { CheckPago } from '../components/lancamentos.tsx'
import { BarraFiltros, EscolhaFiltro } from '../components/Filtros.tsx'
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

  return (
    <div className="flex flex-col gap-4">
      <BarraFiltros
        ativos={
          pessoa === 'todos'
            ? []
            : [
                {
                  chave: 'pessoa',
                  texto: listaMembros.find((m) => m.id === pessoa)?.nome ?? 'Pessoa',
                  onRemover: () => setPessoa('todos'),
                },
              ]
        }
        onLimpar={() => setPessoa('todos')}
        painel={
          <EscolhaFiltro
            rotulo="De quem"
            valor={pessoa}
            onChange={setPessoa}
            opcoes={[{ valor: 'todos', texto: 'Os dois' }, ...listaMembros.map((m) => ({ valor: m.id, texto: m.nome }))]}
          />
        }
      />
      <Atalhos contas={listaContas} />
      <RitmoDoMes
        atual={doMes}
        anterior={doMesAnterior}
        categorias={categorias.data ?? []}
        nome={listaMembros.find((m) => m.id === pessoa)?.nome}
      />
      <Alertas membros={listaMembros} contas={listaContas} pessoa={pessoa} />

      <h1 className="mt-2 text-lg font-semibold">
        Resumo de <span className="lowercase">{nomeDaCompetencia(competencia)}</span>
      </h1>

      <div className="grid gap-3 sm:grid-cols-2">
        {listaMembros.filter((m) => pessoa === 'todos' || m.id === pessoa).map((m) => {
          const conta = contaPrincipalDe(listaContas, m.id)
          const t = calcularTotais(todos.filter((l) => l.membro_id === m.id))
          return (
            <Card key={m.id} titulo={m.nome} cor={m.cor} para={conta ? `/conta/${conta.id}` : undefined}>
              {t.saidas === 0 && t.entradas === 0 ? (
                <Vazio />
              ) : (
                <>
                  <Linha rotulo="A pagar no mês" valor={t.saidas} forte />
                  <Linha rotulo="Pago" valor={t.pago} />
                  <Linha rotulo="Pendente" valor={t.pendente} destaque={t.pendente > 0 ? 'text-amber-700' : ''} />
                  <div className="my-1 border-t border-stone-100" />
                  <Linha rotulo="Entradas" valor={t.entradas} />
                  <Linha rotulo="Saldo" valor={t.saldo} forte destaque={t.saldo < 0 ? 'text-red-700' : ''} />
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
                  <Linha rotulo="Total do mês" valor={t.saidas} forte />
                  <Linha rotulo="Pendente" valor={t.pendente} destaque={t.pendente > 0 ? 'text-amber-700' : ''} />
                  <div className="my-1 border-t border-stone-100" />
                  {listaMembros.map((m) => (
                    <Linha
                      key={m.id}
                      rotulo={`Parte de ${m.nome}`}
                      valor={calcularTotais(daConta.filter((l) => l.membro_id === m.id)).saidas}
                    />
                  ))}
                </>
              )}
            </Card>
          )
        })}
      </div>

      <AlertaLimites lancamentos={todos} categorias={categorias.data ?? []} />

      <div className="grid gap-4 sm:grid-cols-2">
        <CartaoMapaDeCalor lancamentos={doMes} />
        <TransacoesRecentes lancamentos={doMes} categorias={categorias.data ?? []} membros={listaMembros} />
      </div>
      <PrincipaisCategorias atual={doMes} anterior={doMesAnterior} categorias={categorias.data ?? []} />
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
        tom === 'vermelho' ? 'border-red-200 bg-red-50/60' : 'border-stone-200 bg-white'
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

function Vazio() {
  return <p className="text-sm text-stone-500">Nenhum lançamento neste mês.</p>
}

function Linha({
  rotulo,
  valor,
  destaque = '',
  forte,
}: {
  rotulo: string
  valor: number
  destaque?: string
  forte?: boolean
}) {
  return (
    <div className={`flex items-baseline justify-between text-sm ${forte ? '' : 'text-stone-600'}`}>
      <span>{rotulo}</span>
      <span className={`tabular-nums ${forte ? 'font-semibold' : ''} ${destaque}`}>{formatarCentavos(valor)}</span>
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
  children: ReactNode
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
    <Link to={para} className={classe} aria-label={`Resumo de ${titulo}`}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  )
}

function Painel({
  titulo,
  link,
  children,
}: {
  titulo: string
  link?: { texto: string; para: string }
  children: ReactNode
}) {
  return (
    <section aria-label={titulo} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">{titulo}</h2>
        {link && (
          <Link to={link.para} className="text-sm font-medium text-marca-700">
            {link.texto} ↗
          </Link>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** "Como está o mês": gasto até hoje vs o mesmo ponto do mês passado, com a curva do mês */
function RitmoDoMes({
  atual,
  anterior,
  categorias,
  nome,
}: {
  atual: Lancamento[]
  anterior: Lancamento[]
  categorias: Categoria[]
  nome?: string
}) {
  const { competencia } = useCompetencia()
  const { membro: eu } = useMembroAtual()
  const ehMesAtual = competencia === competenciaAtual()
  const ehFuturo = competencia > competenciaAtual()
  const porDia = gastoPorDia(atual, competencia)
  const porDiaAnterior = gastoPorDia(anterior, somarMeses(competencia, -1))
  // No mês atual compara até hoje; em meses passados, o mês inteiro
  const diaHoje = ehMesAtual ? diaDe(hoje()) : porDia.length
  const r = ritmo(porDia, porDiaAnterior, diaHoje)
  const maior = comparativoCategorias(atual, [], categorias)[0]
  const ehEu = Boolean(nome) && nome === eu?.nome
  const doMes = ehEu ? 'o seu mês' : nome ? `o mês de ${nome}` : 'o mês de vocês'
  const previstoNoMes = porDia.reduce((s, v) => s + v, 0)
  const mesAnterior = nomeCurtoDoMes(somarMeses(competencia, -1))

  const frase =
    r.percentual === null
      ? r.atual === 0
        ? previstoNoMes > 0
          ? `Até hoje nada saiu. Previsto para o mês: ${formatarCentavos(previstoNoMes)}.`
          : 'Nenhum gasto lançado ainda neste mês.'
        : porDiaAnterior.some((v) => v > 0)
          ? `Até agora, ${formatarCentavos(r.atual)}. No mesmo ponto de ${mesAnterior} ainda não tinha gasto nada.`
          : `Primeiro mês com gastos para comparar. Até agora, ${formatarCentavos(r.atual)}.`
      : `${ehEu ? 'Você' : (nome ?? 'Vocês')} ${ehMesAtual ? (nome ? 'começou' : 'começaram') : nome ? 'fechou' : 'fecharam'} o mês gastando ${Math.abs(r.percentual)}% ${
          r.percentual <= 0 ? 'menos' : 'mais'
        } que ${ehMesAtual ? `no mesmo ponto de ${mesAnterior}` : `em ${mesAnterior}`}.${
          r.percentual <= -10 ? ' Bom ritmo!' : r.percentual >= 10 ? ' Vale ficar de olho.' : ''
        }`

  const acumAtual = acumulado(porDia).map((v, i) => (i < diaHoje ? v : null))
  const acumAnterior = acumulado(porDiaAnterior)

  return (
    <section aria-label="Como está o mês" className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="text-lg font-semibold text-marca-700">Oi, {eu?.nome ?? 'tudo bem'}! Como está {doMes}?</p>
      <p className="mt-1 text-sm text-stone-700">{ehFuturo ? 'Este mês ainda não começou: aparecem só as contas fixas e parcelas já previstas.' : frase}</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniNumero rotulo={ehMesAtual ? 'Gasto até hoje' : `Gasto em ${nomeCurtoDoMes(competencia)}`} valor={formatarCentavos(r.atual)} />
        <MiniNumero
          rotulo={`vs ${mesAnterior}`}
          valor={r.percentual === null ? '—' : `${r.percentual > 0 ? '▲' : r.percentual < 0 ? '▼' : ''} ${Math.abs(r.percentual)}%`}
          tom={r.percentual === null || r.percentual === 0 ? undefined : r.percentual < 0 ? 'text-emerald-700' : 'text-red-700'}
        />
        <MiniNumero
          rotulo="Maior gasto"
          valor={maior && maior.atual > 0 ? `${maior.icone ?? ''} ${maior.nome}` : '—'}
          detalhe={maior && maior.atual > 0 ? formatarCentavos(maior.atual) : undefined}
        />
      </div>

      <div className="mt-4 border-t border-stone-100 pt-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Ritmo de gastos</h2>
          {r.percentual !== null && (
            <span className="text-xs text-stone-500">
              {formatarCentavos(Math.abs(r.diferenca))} {r.diferenca <= 0 ? 'abaixo' : 'acima'} de {mesAnterior}
            </span>
          )}
        </div>
        <GraficoLinhas
          titulo="Gasto acumulado dia a dia: este mês e o mês passado"
          tituloDica={(i) => `Até o dia ${i + 1}`}
          series={[
            { nome: 'Este mês', cor: '#0d9488', valores: acumAtual },
            { nome: 'Mês passado', cor: '#a8a29e', valores: acumAnterior },
          ]}
        />
      </div>
    </section>
  )
}

function MiniNumero({ rotulo, valor, detalhe, tom }: { rotulo: string; valor: string; detalhe?: string; tom?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-stone-50 p-2.5">
      <p className="text-[11px] leading-tight font-medium text-stone-500 uppercase">{rotulo}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${tom ?? 'text-stone-900'}`}>{valor}</p>
      {detalhe && <p className="truncate text-xs text-stone-500">{detalhe}</p>}
    </div>
  )
}

function CartaoMapaDeCalor({ lancamentos }: { lancamentos: Lancamento[] }) {
  const { competencia } = useCompetencia()
  const porDia = gastoPorDia(lancamentos, competencia)
  const total = porDia.reduce((s, v) => s + v, 0)
  const ehMesAtual = competencia === competenciaAtual()
  const diasPassados = ehMesAtual ? diaDe(hoje()) : porDia.length
  const maior = porDia.reduce((m, v, i) => (v > porDia[m] ? i : m), 0)

  return (
    <Painel titulo="Mapa de calor" link={{ texto: 'ver gráficos', para: '/graficos' }}>
      <p className="text-2xl font-semibold tracking-tight">{formatarCentavos(total)}</p>
      <p className="mb-3 text-xs text-stone-500">
        Média por dia: <span className="font-semibold text-stone-900">{formatarCentavos(Math.round(total / Math.max(1, diasPassados)))}</span>
        {porDia[maior] > 0 && (
          <>
            {' · '}maior gasto no dia {maior + 1} ({formatarCentavos(porDia[maior])})
          </>
        )}
      </p>
      <MapaDeCalor
        titulo="Gasto de cada dia do mês"
        valores={porDia}
        inicioSemana={diaDaSemanaDoInicio(competencia)}
        diaDestaque={ehMesAtual ? diaDe(hoje()) : undefined}
      />
    </Painel>
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

/** Tabela: cada categoria neste mês e no anterior */
function PrincipaisCategorias({
  atual,
  anterior,
  categorias,
}: {
  atual: Lancamento[]
  anterior: Lancamento[]
  categorias: Categoria[]
}) {
  const { competencia } = useCompetencia()
  const linhas = comparativoCategorias(atual, anterior, categorias).filter((c) => c.atual > 0).slice(0, 8)
  const maior = Math.max(0, ...linhas.map((c) => Math.max(c.atual, c.anterior)))
  const mesAnterior = nomeCurtoDoMes(somarMeses(competencia, -1))

  return (
    <Painel titulo="Principais categorias" link={{ texto: 'ver mais', para: '/graficos' }}>
      {linhas.length === 0 ? (
        <p className="text-sm text-stone-500">Nenhum gasto neste mês.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {linhas.map((c) => (
              <li key={c.chave}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {c.icone ? `${c.icone} ` : ''}
                    {c.nome}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatarCentavos(c.atual)}</span>
                </div>
                {/* Barra cheia = este mês; tracinho = onde estava no mês anterior */}
                <div className="relative mt-1 h-2 rounded-full bg-stone-100" aria-hidden>
                  <div
                    className="h-full rounded-full bg-marca-600"
                    style={{ width: `${maior > 0 ? Math.max(2, (c.atual / maior) * 100) : 0}%` }}
                  />
                  {c.anterior > 0 && (
                    <div
                      className="absolute -top-0.5 h-3 w-0.5 rounded bg-stone-500"
                      style={{ left: `calc(${(c.anterior / maior) * 100}% - 1px)` }}
                    />
                  )}
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  {c.variacao === null ? (
                    `nada em ${mesAnterior}`
                  ) : (
                    <>
                      <span className={c.variacao > 0 ? 'text-red-700' : c.variacao < 0 ? 'text-emerald-700' : ''}>
                        {c.variacao > 0 ? '▲' : c.variacao < 0 ? '▼' : ''} {Math.abs(c.variacao)}%
                      </span>{' '}
                      vs {formatarCentavos(c.anterior)} em {mesAnterior}
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-stone-500">
            <span aria-hidden className="inline-block h-3 w-0.5 rounded bg-stone-500" /> = quanto foi em {mesAnterior}
          </p>
        </>
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
    'flex shrink-0 items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-medium shadow-sm hover:border-stone-300'
  const classeAcao =
    'flex flex-col items-center gap-1 rounded-2xl bg-marca-50 px-2 py-3 text-xs font-semibold text-marca-700 hover:bg-marca-100'
  return (
    <section aria-label="Atalhos" className="flex flex-col gap-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {[...minhas, ...compartilhadas].map((c) => (
          <Link key={c.id} to={`/conta/${c.id}`} className={classeLink}>
            <Bolinha cor={c.cor} />
            {c.tipo === 'pessoal' && c.dono_id === eu?.id && minhas[0]?.id === c.id ? 'Minhas contas' : c.nome}
            <span aria-hidden className="text-stone-400">
              ›
            </span>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => novo('avulso')} className={classeAcao}>
          <span aria-hidden className="text-xl">
            🧾
          </span>
          Gasto ou entrada
        </button>
        <button type="button" onClick={() => novo('fixa')} className={classeAcao}>
          <span aria-hidden className="text-xl">
            🔁
          </span>
          Conta fixa
        </button>
        <button type="button" onClick={() => novo('parcelada')} className={classeAcao}>
          <span aria-hidden className="text-xl">
            💳
          </span>
          Parcelado
        </button>
      </div>
    </section>
  )
}
