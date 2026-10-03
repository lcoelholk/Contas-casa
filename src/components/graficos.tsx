import { useEffect, useRef, useState, type ReactNode } from 'react'
import { formatarCentavos, formatarCentavosCurto } from '../lib/dinheiro.ts'

/**
 * Gráficos simples em SVG, no padrão do app:
 * barras finas (até 24px) com ponta arredondada, grade discreta, legenda sempre
 * que houver 2+ séries, toque/hover mostra os valores e há uma tabela com os números.
 */

/** Cores das séries (ordem fixa; validadas para daltonismo) */
/** Cores das séries: variáveis do tema (claro/escuro), ordem fixa */
export const CORES_SERIES = ['var(--color-serie-1)', 'var(--color-serie-2)', 'var(--color-serie-3)'] as const

export type Serie = { nome: string; cor: string; valores: number[] }

/** Largura do elemento, atualizada quando a tela muda */
export function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [largura, setLargura] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => setLargura(Math.floor(e.contentRect.width)))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, largura] as const
}

/**
 * Marcas "redondas" do eixo Y: passo de 1, 2 ou 5 × 10^n (em centavos),
 * com 3 a 5 intervalos até passar do maior valor.
 */
export function marcasDoEixo(maior: number): number[] {
  const alvo = Math.max(maior, 10000) / 4
  const base = 10 ** Math.floor(Math.log10(alvo))
  const passo = [1, 2, 5, 10].map((m) => m * base).find((p) => p >= alvo) ?? 10 * base
  const n = Math.max(1, Math.ceil(maior / passo))
  return Array.from({ length: n + 1 }, (_, i) => i * passo)
}

/** Barra com 4px arredondados só na ponta (a base fica reta) */
function caminhoBarra(x: number, y: number, w: number, h: number) {
  if (h <= 0) return ''
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

export function Legenda({ series }: { series: Pick<Serie, 'nome' | 'cor'>[] }) {
  if (series.length < 2) return null
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
      {series.map((s) => (
        <li key={s.nome} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: s.cor }} />
          {s.nome}
        </li>
      ))}
    </ul>
  )
}

/**
 * Colunas por mês (ou outra categoria no eixo X), agrupadas ou empilhadas.
 * Só valores >= 0.
 */
export function GraficoColunas({
  titulo,
  rotulos,
  rotulosLongos,
  series,
  empilhado = false,
  altura = 180,
  destaque,
  extras,
}: {
  /** Nome do gráfico, para leitores de tela e para a tabela */
  titulo: string
  rotulos: string[]
  /** Rótulos completos (tooltip e tabela); padrão = rotulos */
  rotulosLongos?: string[]
  series: Serie[]
  empilhado?: boolean
  altura?: number
  /** Índice do X em destaque (ex.: mês selecionado) */
  destaque?: number
  /** Linhas a mais no tooltip/tabela (ex.: saldo) */
  extras?: (i: number) => { rotulo: string; valor: string }[]
}) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = useState<number | null>(null)
  const longos = rotulosLongos ?? rotulos

  const n = rotulos.length
  const totais = rotulos.map((_, i) => series.reduce((s, se) => s + se.valores[i], 0))
  const maior = empilhado ? Math.max(0, ...totais) : Math.max(0, ...series.flatMap((s) => s.valores))
  const ticks = marcasDoEixo(maior)
  const topo = ticks[ticks.length - 1]

  const margemEsq = 52
  const margemTopo = 8
  const margemBaixo = 22
  const areaW = Math.max(0, largura - margemEsq)
  const areaH = altura - margemTopo - margemBaixo
  const banda = n > 0 ? areaW / n : 0
  const yDe = (v: number) => margemTopo + areaH - (v / topo) * areaH
  const nBarras = empilhado ? 1 : series.length
  const larguraBarra = Math.max(4, Math.min(24, (banda * 0.7 - (nBarras - 1) * 2) / nBarras))
  const larguraGrupo = nBarras * larguraBarra + (nBarras - 1) * 2
  // Sem espaço para todos os nomes no eixo X: mostra um sim, um não (sempre o último)
  const pulo = banda > 0 && banda < 38 ? 2 : 1
  const mostraRotulo = (i: number) => (n - 1 - i) % pulo === 0 || i === destaque

  const linhasTooltip = (i: number) => [
    ...series.map((s) => ({ cor: s.cor, rotulo: s.nome, valor: formatarCentavos(s.valores[i]) })),
    ...(empilhado && series.length > 1 ? [{ cor: null, rotulo: 'Total', valor: formatarCentavos(totais[i]) }] : []),
    ...(extras?.(i).map((e) => ({ cor: null, ...e })) ?? []),
  ]

  return (
    <figure className="flex flex-col gap-2" aria-label={titulo}>
      <Legenda series={series} />
      <div ref={ref} className="relative" onPointerLeave={(e) => e.pointerType === 'mouse' && setAtivo(null)}>
        {largura > 0 && (
          <svg width={largura} height={altura} role="img" aria-label={titulo} className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={margemEsq} x2={largura} y1={yDe(t)} y2={yDe(t)} style={{ stroke: 'var(--color-stone-200)' }} strokeWidth={1} />
                <text
                  x={margemEsq - 6}
                  y={yDe(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-stone-500 text-[11px] tabular-nums"
                >
                  {formatarCentavosCurto(t)}
                </text>
              </g>
            ))}
            {rotulos.map((rotulo, i) => {
              const x0 = margemEsq + i * banda + (banda - larguraGrupo) / 2
              let acumulado = 0
              return (
                <g key={i} opacity={ativo === null || ativo === i ? 1 : 0.55}>
                  {series.map((s, k) => {
                    const v = s.valores[i]
                    if (empilhado) {
                      const yTopo = yDe(acumulado + v)
                      const yBase = yDe(acumulado)
                      acumulado += v
                      if (v <= 0) return null
                      const ehTopo = series.slice(k + 1).every((o) => o.valores[i] <= 0)
                      // 2px de respiro entre os segmentos
                      const h = Math.max(0, yBase - yTopo - (k > 0 ? 2 : 0))
                      return ehTopo ? (
                        <path key={s.nome} d={caminhoBarra(x0, yTopo, larguraBarra, h)} style={{ fill: s.cor }} />
                      ) : (
                        <rect key={s.nome} x={x0} y={yTopo} width={larguraBarra} height={h} style={{ fill: s.cor }} />
                      )
                    }
                    const x = x0 + k * (larguraBarra + 2)
                    return <path key={s.nome} d={caminhoBarra(x, yDe(v), larguraBarra, yDe(0) - yDe(v))} style={{ fill: s.cor }} />
                  })}
                  {mostraRotulo(i) && (
                    <text
                      x={margemEsq + i * banda + banda / 2}
                      y={altura - 6}
                      textAnchor="middle"
                      className={`text-xs ${destaque === i ? 'fill-stone-900 font-semibold' : 'fill-stone-500'}`}
                    >
                      {rotulo}
                    </text>
                  )}
                  {/* Área de toque: a coluna inteira, maior que a barra */}
                  <rect
                    x={margemEsq + i * banda}
                    y={0}
                    width={banda}
                    height={altura}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${longos[i]}: ${linhasTooltip(i)
                      .map((l) => `${l.rotulo} ${l.valor}`)
                      .join(', ')}`}
                    onPointerEnter={() => setAtivo(i)}
                    onPointerDown={() => setAtivo(i)}
                    onFocus={() => setAtivo(i)}
                    onBlur={() => setAtivo(null)}
                    className="cursor-pointer outline-none"
                  />
                </g>
              )
            })}
            <line x1={margemEsq} x2={largura} y1={yDe(0)} y2={yDe(0)} style={{ stroke: 'var(--color-stone-400)' }} strokeWidth={1} />
          </svg>
        )}
        {ativo !== null && largura > 0 && (
          <Dica
            x={Math.min(Math.max(margemEsq + ativo * banda + banda / 2, 100), largura - 100)}
            titulo={longos[ativo]}
            linhas={linhasTooltip(ativo)}
          />
        )}
      </div>
      <TabelaDados
        titulo={titulo}
        cabecalho={['', ...series.map((s) => s.nome), ...(extras ? extras(0).map((e) => e.rotulo) : [])]}
        linhas={rotulos.map((_, i) => [
          longos[i],
          ...series.map((s) => formatarCentavos(s.valores[i])),
          ...(extras ? extras(i).map((e) => e.valor) : []),
        ])}
      />
    </figure>
  )
}

/** Caixinha com os valores do ponto tocado */
export function Dica({
  x,
  titulo,
  linhas,
}: {
  x: number
  titulo: string
  linhas: { cor: string | null; rotulo: string; valor: string }[]
}) {
  return (
    <div
      role="status"
      className="pointer-events-none absolute -top-2 z-10 w-max max-w-64 min-w-40 -translate-x-1/2 -translate-y-full rounded-xl border border-stone-200 bg-superficie px-3 py-2 text-xs shadow-lg"
      style={{ left: x }}
    >
      <p className="mb-1 font-medium text-stone-500">{titulo}</p>
      <ul className="flex flex-col gap-0.5">
        {linhas.map((l) => (
          <li key={l.rotulo} className="flex items-center gap-1.5">
            {l.cor ? (
              <span aria-hidden className="h-0.5 w-3 shrink-0 rounded" style={{ backgroundColor: l.cor }} />
            ) : (
              <span aria-hidden className="w-3 shrink-0" />
            )}
            <span className="flex-1 text-stone-500">{l.rotulo}</span>
            <span className="font-semibold text-stone-900 tabular-nums">{l.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Os mesmos números do gráfico, numa tabela que abre ao tocar */
export function TabelaDados({
  titulo,
  cabecalho,
  linhas,
}: {
  titulo: string
  cabecalho: string[]
  linhas: string[][]
}) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer py-1 text-stone-500">Ver em tabela</summary>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <caption className="sr-only">{titulo}</caption>
          <thead>
            <tr className="text-stone-500">
              {cabecalho.map((c, i) => (
                <th key={i} scope="col" className={`py-1 pr-3 font-medium ${i > 0 ? 'text-right' : ''}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {linhas.map((l, i) => (
              <tr key={i}>
                {l.map((c, j) => (
                  <td key={j} className={`py-1 pr-3 ${j > 0 ? 'text-right' : ''}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/** Número de destaque com rótulo e, opcionalmente, comparação */
export function Indicador({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
}: {
  rotulo: string
  valor: string
  detalhe?: ReactNode
  tom?: 'neutro' | 'bom' | 'ruim'
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-superficie p-3 shadow-sm">
      <p className="text-xs text-stone-500">{rotulo}</p>
      <p className="mt-0.5 text-xl font-semibold tracking-tight">{valor}</p>
      {detalhe && (
        <p
          className={`mt-0.5 text-xs ${tom === 'bom' ? 'text-emerald-700' : tom === 'ruim' ? 'text-red-700' : 'text-stone-500'}`}
        >
          {detalhe}
        </p>
      )}
    </div>
  )
}

/** Barra de progresso (fundo num tom claro da mesma cor) */
export function Medidor({ percentual, cor, rotulo }: { percentual: number; cor: string; rotulo: string }) {
  const p = Math.max(0, Math.min(100, percentual))
  return (
    <div
      role="meter"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p)}
      className="relative h-2.5 overflow-hidden rounded-full"
    >
      <div className="absolute inset-0 opacity-15" style={{ backgroundColor: cor }} />
      <div
        className="relative h-full rounded-full transition-[width] duration-300"
        style={{ width: `${p}%`, backgroundColor: cor }}
      />
    </div>
  )
}

/**
 * Linhas acumuladas dia a dia (ex.: ritmo de gastos deste mês vs o anterior).
 * A primeira série é a principal (cor forte, ponto no fim); as outras ficam em cinza.
 * Valores null não são desenhados (dias que ainda não chegaram).
 */
export function GraficoLinhas({
  titulo,
  series,
  altura = 180,
  rotuloX = (i) => String(i + 1),
  tituloDica = (i) => `Dia ${i + 1}`,
}: {
  titulo: string
  series: { nome: string; cor: string; valores: (number | null)[] }[]
  altura?: number
  rotuloX?: (i: number) => string
  tituloDica?: (i: number) => string
}) {
  const [ref, largura] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = useState<number | null>(null)
  const n = Math.max(...series.map((s) => s.valores.length))
  const maior = Math.max(0, ...series.flatMap((s) => s.valores.map((v) => v ?? 0)))
  const ticks = marcasDoEixo(maior)
  const topo = ticks[ticks.length - 1]
  const margemEsq = 52
  const margemTopo = 8
  const margemBaixo = 22
  const areaW = Math.max(0, largura - margemEsq - 8)
  const areaH = altura - margemTopo - margemBaixo
  const xDe = (i: number) => margemEsq + (n > 1 ? (i / (n - 1)) * areaW : 0)
  const yDe = (v: number) => margemTopo + areaH - (v / topo) * areaH
  const caminho = (vs: (number | null)[]) =>
    vs.reduce<string>((d, v, i) => (v === null ? d : `${d}${d ? 'L' : 'M'}${xDe(i)},${yDe(v)}`), '')
  const marcasX = [0, Math.round((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i)

  const indiceDo = (clientX: number, el: SVGSVGElement) => {
    const x = clientX - el.getBoundingClientRect().left
    return Math.max(0, Math.min(n - 1, Math.round(((x - margemEsq) / areaW) * (n - 1))))
  }

  return (
    <figure className="flex flex-col gap-2" aria-label={titulo}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
        {series.map((s) => (
          <li key={s.nome} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: s.cor }} />
            {s.nome}
          </li>
        ))}
      </ul>
      <div ref={ref} className="relative" onPointerLeave={(e) => e.pointerType === 'mouse' && setAtivo(null)}>
        {largura > 0 && (
          <svg
            width={largura}
            height={altura}
            role="img"
            aria-label={titulo}
            className="block touch-pan-y overflow-visible"
            onPointerMove={(e) => setAtivo(indiceDo(e.clientX, e.currentTarget))}
            onPointerDown={(e) => setAtivo(indiceDo(e.clientX, e.currentTarget))}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={margemEsq} x2={largura - 8} y1={yDe(t)} y2={yDe(t)} style={{ stroke: 'var(--color-stone-200)' }} strokeWidth={1} />
                <text
                  x={margemEsq - 6}
                  y={yDe(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-stone-500 text-[11px] tabular-nums"
                >
                  {formatarCentavosCurto(t)}
                </text>
              </g>
            ))}
            {marcasX.map((i) => (
              <text key={i} x={xDe(i)} y={altura - 6} textAnchor="middle" className="fill-stone-500 text-xs">
                {rotuloX(i)}
              </text>
            ))}
            {ativo !== null && (
              <line
                x1={xDe(ativo)}
                x2={xDe(ativo)}
                y1={margemTopo}
                y2={margemTopo + areaH}
                style={{ stroke: 'var(--color-stone-400)' }}
                strokeWidth={1}
              />
            )}
            {/* As de fundo primeiro, a principal por cima */}
            {[...series].reverse().map((s) => (
              <path
                key={s.nome}
                d={caminho(s.valores)}
                fill="none"
                style={{ stroke: s.cor }}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {series.map((s, k) => {
              const i = ativo ?? (k === 0 ? s.valores.findLastIndex((v) => v !== null) : -1)
              const v = i >= 0 ? s.valores[i] : null
              if (v === null || v === undefined) return null
              return <circle key={s.nome} cx={xDe(i)} cy={yDe(v)} r={4} style={{ fill: s.cor, stroke: 'var(--color-superficie)' }} strokeWidth={2} />
            })}
          </svg>
        )}
        {ativo !== null && largura > 0 && (
          <Dica
            x={Math.min(Math.max(xDe(ativo), 100), largura - 100)}
            titulo={tituloDica(ativo)}
            linhas={series.map((s) => ({
              cor: s.cor,
              rotulo: s.nome,
              valor:
                s.valores[ativo] === null || s.valores[ativo] === undefined ? '—' : formatarCentavos(s.valores[ativo]!),
            }))}
          />
        )}
      </div>
    </figure>
  )
}

/** Tons de verde-água do mais claro ao mais escuro (menos → mais gasto) */
const TONS_CALOR = ['#ccfbf1', '#5eead4', '#14b8a6', '#0f766e'] as const

/** Em qual tom cai um valor: 0 = sem gasto, 1 a 4 = quartis do maior dia */
export function tomDoCalor(valor: number, maior: number): number {
  if (valor <= 0 || maior <= 0) return 0
  return Math.min(4, Math.ceil((valor / maior) * 4))
}

/** Calendário do mês com a cor de cada dia pelo quanto foi gasto */
export function MapaDeCalor({
  titulo,
  valores,
  inicioSemana,
  diaDestaque,
}: {
  titulo: string
  /** Gasto de cada dia (índice 0 = dia 1) */
  valores: number[]
  /** Dia da semana do dia 1 (0 = domingo) */
  inicioSemana: number
  /** Dia de hoje, se for o mês atual */
  diaDestaque?: number
}) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const maior = Math.max(0, ...valores)
  const celulas: (number | null)[] = [...Array(inicioSemana).fill(null), ...valores.map((_, i) => i)]
  while (celulas.length % 7) celulas.push(null)

  return (
    <figure aria-label={titulo} className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-stone-500">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid">
        {celulas.map((i, k) =>
          i === null ? (
            <span key={k} aria-hidden />
          ) : (
            <button
              key={k}
              type="button"
              aria-label={`Dia ${i + 1}: ${formatarCentavos(valores[i])}`}
              aria-pressed={ativo === i}
              onClick={() => setAtivo(ativo === i ? null : i)}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setAtivo(i)}
              className={`flex aspect-square items-center justify-center rounded-md text-xs tabular-nums transition-transform ${
                ativo === i ? 'scale-110 ring-2 ring-stone-900' : ''
              } ${diaDestaque === i + 1 ? 'font-bold' : ''}`}
              style={{
                backgroundColor:
                  tomDoCalor(valores[i], maior) === 0 ? 'var(--color-stone-100)' : TONS_CALOR[tomDoCalor(valores[i], maior) - 1],
                color: tomDoCalor(valores[i], maior) >= 3 ? '#fff' : tomDoCalor(valores[i], maior) === 0 ? 'var(--color-stone-600)' : '#134e4a',
              }}
            >
              {i + 1}
            </button>
          ),
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-stone-500">
        <span className="min-h-4">
          {ativo !== null && (
            <>
              Dia {ativo + 1}: <span className="font-semibold text-stone-900">{formatarCentavos(valores[ativo])}</span>
            </>
          )}
        </span>
        <span className="flex items-center gap-1" aria-hidden>
          Menos
          {['var(--color-stone-100)', ...TONS_CALOR].map((c) => (
            <span key={c} className="inline-block size-3 rounded-sm" style={{ backgroundColor: c }} />
          ))}
          Mais
        </span>
      </div>
    </figure>
  )
}
