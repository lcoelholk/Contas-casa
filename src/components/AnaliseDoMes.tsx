import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { useMembroAtual } from '../hooks/useDados.ts'
import { competenciaAtual, diaDaSemanaDoInicio, diaDe, hoje, nomeCurtoDoMes, somarMeses } from '../lib/datas.ts'
import { acumulado, comparativoCategorias, gastoPorDia, ritmo } from '../lib/visaoGeral.ts'
import { formatarCentavos } from '../lib/dinheiro.ts'
import { GraficoLinhas, MapaDeCalor } from './graficos.tsx'
import type { Categoria, Lancamento } from '../types/banco.ts'

/**
 * Análise do mês aberto no seletor: ritmo de gastos vs o mês passado,
 * mapa de calor dos dias e categorias vs o mês anterior (tela Análises).
 */
export function AnaliseDoMes({
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
  return (
    <>
      <RitmoDoMes atual={atual} anterior={anterior} categorias={categorias} nome={nome} />
      <CartaoMapaDeCalor lancamentos={atual} />
      <PrincipaisCategorias atual={atual} anterior={anterior} categorias={categorias} />
    </>
  )
}

export function Painel({
  titulo,
  link,
  children,
}: {
  titulo: string
  link?: { texto: string; para: string }
  children: ReactNode
}) {
  return (
    <section aria-label={titulo} className="rounded-2xl border border-stone-200 bg-superficie p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">{titulo}</h2>
        {link && (
          <Link
            to={link.para}
            className="-my-3 -mr-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-marca-700 hover:bg-marca-50"
          >
            {link.texto} ›
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
    <section aria-label="Ritmo do mês" className="rounded-2xl border border-stone-200 bg-superficie p-4 shadow-sm">
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Ritmo do mês</h2>
      <p className="mt-2 text-sm text-stone-700">
        {ehFuturo ? 'Este mês ainda não começou: aparecem só as contas fixas e parcelas já previstas.' : frase}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniNumero
          rotulo={ehMesAtual ? 'Gasto até hoje' : `Gasto em ${nomeCurtoDoMes(competencia)}`}
          valor={formatarCentavos(r.atual)}
        />
        <MiniNumero
          rotulo={`vs ${mesAnterior}`}
          valor={
            r.percentual === null
              ? '—'
              : `${r.percentual > 0 ? '▲' : r.percentual < 0 ? '▼' : ''} ${Math.abs(r.percentual)}%`
          }
          tom={
            r.percentual === null || r.percentual === 0
              ? undefined
              : r.percentual < 0
                ? 'text-emerald-700'
                : 'text-red-700'
          }
        />
        <MiniNumero
          largo
          rotulo="Maior gasto"
          valor={maior && maior.atual > 0 ? `${maior.icone ?? ''} ${maior.nome}` : '—'}
          detalhe={maior && maior.atual > 0 ? formatarCentavos(maior.atual) : undefined}
        />
      </div>

      <div className="mt-4 border-t border-stone-100 pt-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium text-stone-600">Gasto acumulado</h3>
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
            { nome: 'Mês passado', cor: 'var(--color-stone-400)', valores: acumAnterior },
          ]}
        />
      </div>
    </section>
  )
}

/** Número pequeno com rótulo; o valor quebra linha em vez de ser cortado */
function MiniNumero({
  rotulo,
  valor,
  detalhe,
  tom,
  largo,
}: {
  rotulo: string
  valor: string
  detalhe?: string
  tom?: string
  largo?: boolean
}) {
  return (
    <div className={`min-w-0 rounded-xl bg-stone-50 p-2.5 ${largo ? 'col-span-2' : ''}`}>
      <p className="text-xs leading-tight font-medium text-stone-500">{rotulo}</p>
      <p className={`mt-1 text-base font-semibold ${tom ?? 'text-stone-900'}`}>
        {valor}
        {detalhe && <span className="ml-1.5 text-sm font-normal text-stone-500">{detalhe}</span>}
      </p>
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
    <Painel titulo="Mapa de calor">
      <p className="text-2xl font-semibold tracking-tight">{formatarCentavos(total)}</p>
      <p className="mb-3 text-xs text-stone-500">
        Média por dia:{' '}
        <span className="font-semibold text-stone-900">
          {formatarCentavos(Math.round(total / Math.max(1, diasPassados)))}
        </span>
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
  const linhas = comparativoCategorias(atual, anterior, categorias)
    .filter((c) => c.atual > 0)
    .slice(0, 8)
  const maior = Math.max(0, ...linhas.map((c) => Math.max(c.atual, c.anterior)))
  const mesAnterior = nomeCurtoDoMes(somarMeses(competencia, -1))

  return (
    <Painel titulo="Categorias vs mês anterior">
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
