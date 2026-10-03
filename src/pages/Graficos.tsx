import { useState } from 'react'
import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { usePessoa } from '../hooks/usePessoa.tsx'
import { AbasAnalises } from '../components/AbasAnalises.tsx'
import { useMembros, useTodasContas } from '../hooks/useDados.ts'
import { useCategorias } from '../hooks/useLancamentos.ts'
import { useLancamentosPeriodo } from '../hooks/useAnalises.ts'
import {
  compromissosPorMes,
  gastosPorMembro,
  indicadores,
  serieMensal,
  variacao,
  type LinhaAnalise,
} from '../lib/analises.ts'
import { gastosPorCategoria } from '../lib/resumo.ts'
import {
  competenciaAtual,
  listaDeMeses,
  nomeCurtoDoMes,
  nomeDaCompetencia,
  somarMeses,
  type Competencia,
} from '../lib/datas.ts'
import { formatarCentavos, somar } from '../lib/dinheiro.ts'
import { Aviso, Carregando } from '../components/ui.tsx'
import { BarraFiltros, EscolhaFiltro } from '../components/Filtros.tsx'
import { CORES_SERIES, GraficoColunas, Indicador } from '../components/graficos.tsx'
import type { Categoria, Conta, Membro } from '../types/banco.ts'

type Periodo = '3' | '6' | '12'

export default function Graficos() {
  const { competencia } = useCompetencia()
  const membros = useMembros()
  const contas = useTodasContas()
  const categorias = useCategorias()
  const [periodo, setPeriodo] = useState<Periodo>('6')
  const { pessoa, setPessoa } = usePessoa()

  // O período termina no mês escolhido no seletor lá em cima
  const de = somarMeses(competencia, -(Number(periodo) - 1))
  const meses = listaDeMeses(de, competencia)
  const dados = useLancamentosPeriodo(de, competencia)

  if (membros.isPending || contas.isPending || dados.isPending) return <Carregando />
  if (dados.isError) return <Aviso titulo="Não foi possível carregar os gráficos">{dados.error.message}</Aviso>

  const listaMembros = membros.data ?? []
  const todos = dados.data ?? []
  const filtrados = pessoa === 'todos' ? todos : todos.filter((l) => l.membro_id === pessoa)
  const nomePessoa = listaMembros.find((m) => m.id === pessoa)?.nome

  return (
    <div className="flex flex-col gap-4">
      <AbasAnalises />
      <div>
        <h1 className="text-lg font-semibold">Gráficos</h1>
        <p className="text-sm text-stone-500">
          {nomePessoa ?? 'Vocês dois'} · até <span className="lowercase">{nomeDaCompetencia(competencia)}</span>
        </p>
      </div>

      <BarraFiltros
        ativos={[
          ...(periodo !== '6'
            ? [{ chave: 'periodo', texto: `${periodo} meses`, onRemover: () => setPeriodo('6') }]
            : []),
          ...(pessoa !== 'todos'
            ? [{ chave: 'pessoa', texto: nomePessoa ?? 'Pessoa', onRemover: () => setPessoa('todos') }]
            : []),
        ]}
        onLimpar={() => {
          setPeriodo('6')
          setPessoa('todos')
        }}
        painel={
          <>
            <EscolhaFiltro
              rotulo="Período"
              valor={periodo}
              onChange={setPeriodo}
              opcoes={[
                { valor: '3', texto: '3 meses' },
                { valor: '6', texto: '6 meses' },
                { valor: '12', texto: '12 meses' },
              ]}
            />
            <EscolhaFiltro
              rotulo="Pessoa"
              valor={pessoa}
              onChange={setPessoa}
              opcoes={[{ valor: 'todos', texto: 'Os dois' }, ...listaMembros.map((m) => ({ valor: m.id, texto: m.nome }))]}
            />
          </>
        }
      />

      <div className={`flex flex-col gap-4 transition-opacity ${dados.isPlaceholderData ? 'opacity-50' : ''}`}>
        <Numeros linhas={filtrados} meses={meses} />
        <EntradasEGastos linhas={filtrados} meses={meses} />
        <PorCategoria linhas={filtrados} meses={meses} categorias={categorias.data ?? []} />
        {pessoa === 'todos' && (
          <DivisaoCompartilhadas linhas={todos} meses={meses} membros={listaMembros} contas={contas.data ?? []} />
        )}
      </div>
      <ProximosMeses pessoa={pessoa === 'todos' ? null : pessoa} />
    </div>
  )
}

function Cartao({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <section aria-label={titulo} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">{titulo}</h2>
      {subtitulo && <p className="mt-0.5 text-xs text-stone-500">{subtitulo}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

const rotulosDe = (meses: Competencia[]) => {
  // Mostra o ano quando o período vira o ano
  const viraAno = meses.some((m) => m.slice(0, 4) !== meses[0].slice(0, 4))
  return meses.map((m) => nomeCurtoDoMes(m, viraAno && (m.slice(5, 7) === '01' || m === meses[0])))
}
const rotulosLongosDe = (meses: Competencia[]) => meses.map((m) => nomeDaCompetencia(m))

/** Números principais do período */
function Numeros({ linhas, meses }: { linhas: LinhaAnalise[]; meses: Competencia[] }) {
  const serie = serieMensal(linhas, meses)
  const ind = indicadores(serie)
  const atual = serie[serie.length - 1]
  const anteriores = indicadores(serie.slice(0, -1))
  const delta = anteriores.mesesComDados > 0 ? variacao(anteriores.mediaSaidas, atual.saidas) : null

  return (
    <div className="grid grid-cols-2 gap-3">
      <Indicador
        rotulo="Gastos no mês"
        valor={formatarCentavos(atual.saidas)}
        detalhe={
          delta === null
            ? undefined
            : delta === 0
              ? 'igual à média dos meses anteriores'
              : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs média anterior`
        }
        tom={delta === null || delta === 0 ? 'neutro' : delta > 0 ? 'ruim' : 'bom'}
      />
      <Indicador
        rotulo="Gasto médio por mês"
        valor={formatarCentavos(ind.mediaSaidas)}
        detalhe={
          ind.mesesComDados > 0 ? `em ${ind.mesesComDados} ${ind.mesesComDados === 1 ? 'mês' : 'meses'}` : 'sem dados'
        }
      />
      <Indicador rotulo="Entrada média por mês" valor={formatarCentavos(ind.mediaEntradas)} />
      <Indicador
        rotulo="Quanto sobrou das entradas"
        valor={ind.taxaEconomia === null ? '—' : `${ind.taxaEconomia}%`}
        detalhe={
          ind.taxaEconomia === null
            ? 'cadastre as entradas (salário...)'
            : ind.taxaEconomia >= 0
              ? `${formatarCentavos(somar(serie.map((p) => p.saldo)))} no período`
              : `faltaram ${formatarCentavos(-somar(serie.map((p) => p.saldo)))}`
        }
        tom={ind.taxaEconomia === null ? 'neutro' : ind.taxaEconomia >= 0 ? 'bom' : 'ruim'}
      />
    </div>
  )
}

function EntradasEGastos({ linhas, meses }: { linhas: LinhaAnalise[]; meses: Competencia[] }) {
  const serie = serieMensal(linhas, meses)
  return (
    <Cartao titulo="Entradas e gastos" subtitulo="Toque numa coluna para ver os valores e o saldo do mês">
      <GraficoColunas
        titulo="Entradas e gastos por mês"
        rotulos={rotulosDe(meses)}
        rotulosLongos={rotulosLongosDe(meses)}
        destaque={meses.length - 1}
        series={[
          { nome: 'Entradas', cor: CORES_SERIES[0], valores: serie.map((p) => p.entradas) },
          { nome: 'Gastos', cor: CORES_SERIES[1], valores: serie.map((p) => p.saidas) },
        ]}
        extras={(i) => [{ rotulo: 'Saldo', valor: formatarCentavos(serie[i].saldo) }]}
      />
    </Cartao>
  )
}

/** Barras por categoria no período; tocar numa categoria mostra a evolução dela */
function PorCategoria({
  linhas,
  meses,
  categorias,
}: {
  linhas: LinhaAnalise[]
  meses: Competencia[]
  categorias: Categoria[]
}) {
  const [aberta, setAberta] = useState<string | null>(null)
  const lista = gastosPorCategoria(linhas, categorias)
  const maior = lista[0]?.total ?? 0

  return (
    <Cartao
      titulo="Para onde foi o dinheiro"
      subtitulo={`Gastos por categoria nos últimos ${meses.length} meses · toque para ver mês a mês`}
    >
      {lista.length === 0 ? (
        <p className="text-sm text-stone-500">Nenhum gasto no período.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {lista.map((c) => {
            const id = c.chave === 'sem' ? null : c.chave
            const estaAberta = aberta === c.chave
            return (
              <li key={c.chave}>
                <button
                  type="button"
                  aria-expanded={estaAberta}
                  onClick={() => setAberta(estaAberta ? null : c.chave)}
                  className="w-full rounded-xl px-1 py-1.5 text-left hover:bg-stone-50"
                >
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">
                      {c.icone ? `${c.icone} ` : ''}
                      {c.nome}
                    </span>
                    <span className="shrink-0">
                      <span className="font-semibold tabular-nums">{formatarCentavos(c.total)}</span>
                      <span className="ml-1.5 text-xs text-stone-500 tabular-nums">{c.percentual}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-stone-100" aria-hidden>
                    <div
                      className="h-full rounded-full bg-marca-600"
                      style={{ width: `${maior > 0 ? Math.max(2, (c.total / maior) * 100) : 0}%` }}
                    />
                  </div>
                </button>
                {estaAberta && (
                  <div className="px-1 pt-2 pb-3">
                    <p className="mb-1 text-xs text-stone-500">
                      Média de {formatarCentavos(Math.round(c.total / meses.length))} por mês
                    </p>
                    <GraficoColunas
                      titulo={`${c.nome} mês a mês`}
                      altura={140}
                      rotulos={rotulosDe(meses)}
                      rotulosLongos={rotulosLongosDe(meses)}
                      destaque={meses.length - 1}
                      series={[
                        {
                          nome: c.nome,
                          cor: '#0d9488',
                          valores: meses.map((m) =>
                            somar(
                              linhas
                                .filter((l) => l.competencia === m && l.tipo === 'saida' && l.categoria_id === id)
                                .map((l) => l.valor_centavos),
                            ),
                          ),
                        },
                      ]}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Cartao>
  )
}

/** Quanto cada um pagou nas contas compartilhadas (Casa, Viagem...) */
function DivisaoCompartilhadas({
  linhas,
  meses,
  membros,
  contas,
}: {
  linhas: LinhaAnalise[]
  meses: Competencia[]
  membros: Membro[]
  contas: Conta[]
}) {
  const compartilhadas = contas.filter((c) => c.tipo === 'compartilhada').map((c) => c.id)
  const pontos = gastosPorMembro(
    linhas,
    meses,
    membros.map((m) => m.id),
    compartilhadas,
  )
  const totais = membros.map((_, k) => somar(pontos.map((p) => p.valores[k])))
  const total = somar(totais)
  if (compartilhadas.length === 0 || total === 0) return null

  return (
    <Cartao titulo="Divisão das contas da casa" subtitulo="Quanto cada um pagou nas contas compartilhadas">
      <p className="mb-3 text-sm text-stone-600">
        No período:{' '}
        {membros.map((m, k) => (
          <span key={m.id}>
            {k > 0 && ' · '}
            <span className="font-semibold text-stone-900">{m.nome}</span> {Math.round((totais[k] / total) * 100)}% (
            {formatarCentavos(totais[k])})
          </span>
        ))}
      </p>
      <GraficoColunas
        titulo="Divisão das contas compartilhadas por mês"
        empilhado
        rotulos={rotulosDe(meses)}
        rotulosLongos={rotulosLongosDe(meses)}
        destaque={meses.length - 1}
        series={membros.map((m, k) => ({
          nome: m.nome,
          cor: m.cor ?? CORES_SERIES[k % CORES_SERIES.length],
          valores: pontos.map((p) => p.valores[k]),
        }))}
        extras={(i) => {
          const t = somar(pontos[i].valores)
          return membros.map((m, k) => ({
            rotulo: `% ${m.nome}`,
            valor: t > 0 ? `${Math.round((pontos[i].valores[k] / t) * 100)}%` : '—',
          }))
        }}
      />
    </Cartao>
  )
}

/** O que já está comprometido nos próximos 6 meses (contas fixas e parcelas) */
function ProximosMeses({ pessoa }: { pessoa: string | null }) {
  const inicio = somarMeses(competenciaAtual(), 1)
  const fim = somarMeses(inicio, 5)
  const meses = listaDeMeses(inicio, fim)
  const dados = useLancamentosPeriodo(inicio, fim)
  if (dados.isPending || dados.isError) return null

  const linhas = (dados.data ?? []).filter((l) => pessoa === null || l.membro_id === pessoa)
  const pontos = compromissosPorMes(linhas, meses)
  if (pontos.every((p) => p.fixas + p.parcelas + p.outros === 0)) return null

  return (
    <Cartao titulo="Próximos meses" subtitulo="O que já está comprometido: contas fixas, parcelas e gastos já lançados">
      <GraficoColunas
        titulo="Gastos já comprometidos nos próximos meses"
        empilhado
        rotulos={rotulosDe(meses)}
        rotulosLongos={rotulosLongosDe(meses)}
        series={[
          { nome: 'Contas fixas', cor: CORES_SERIES[0], valores: pontos.map((p) => p.fixas) },
          { nome: 'Parcelas', cor: CORES_SERIES[1], valores: pontos.map((p) => p.parcelas) },
          { nome: 'Outros', cor: CORES_SERIES[2], valores: pontos.map((p) => p.outros) },
        ]}
      />
    </Cartao>
  )
}
