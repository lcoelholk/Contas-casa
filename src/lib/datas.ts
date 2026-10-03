/**
 * Datas do app. Regras:
 * - Fuso: America/Sao_Paulo ("hoje" e "mês atual" são calculados nele).
 * - Datas trafegam como texto ISO "AAAA-MM-DD" (igual ao tipo `date` do Postgres).
 * - Competência = mês de referência, sempre o 1º dia do mês: "2026-10-01".
 */

export const FUSO = 'America/Sao_Paulo'

/** Texto ISO de data: "2026-10-15" */
export type DataISO = string
/** Competência: sempre "AAAA-MM-01" */
export type Competencia = string

const formatadorISO = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function lerData(data: DataISO): { ano: number; mes: number; dia: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data)
  if (!m) throw new Error(`Data inválida: "${data}" (use AAAA-MM-DD)`)
  return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) }
}

function montarData(ano: number, mes: number, dia: number): DataISO {
  return `${ano}-${pad2(mes)}-${pad2(dia)}`
}

/** Data de hoje no fuso de São Paulo */
export function hoje(agora: Date = new Date()): DataISO {
  return formatadorISO.format(agora)
}

/** "2026-10-15" → "2026-10-01" */
export function competenciaDe(data: DataISO): Competencia {
  const { ano, mes } = lerData(data)
  return montarData(ano, mes, 1)
}

/** Competência do mês atual no fuso de São Paulo */
export function competenciaAtual(agora: Date = new Date()): Competencia {
  return competenciaDe(hoje(agora))
}

/** Soma (ou subtrai) meses de uma competência: ("2026-11-01", 3) → "2027-02-01" */
export function somarMeses(competencia: Competencia, meses: number): Competencia {
  const { ano, mes } = lerData(competencia)
  const total = ano * 12 + (mes - 1) + meses
  return montarData(Math.floor(total / 12), (total % 12) + 1, 1)
}

/** Quantos meses de `de` até `ate`: ("2026-10-01", "2027-01-01") → 3 */
export function mesesEntre(de: Competencia, ate: Competencia): number {
  const a = lerData(de)
  const b = lerData(ate)
  return (b.ano - a.ano) * 12 + (b.mes - a.mes)
}

/** Último dia do mês (mes de 1 a 12) */
export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

/**
 * Data de vencimento no mês da competência.
 * Se o dia não existe no mês (31 em abril), usa o último dia.
 */
export function vencimentoNoMes(competencia: Competencia, dia: number): DataISO {
  const { ano, mes } = lerData(competencia)
  return montarData(ano, mes, Math.min(dia, ultimoDiaDoMes(ano, mes)))
}

/**
 * Número da parcela de uma compra numa competência.
 * primeira = "2026-10-01", competência = "2026-12-01" → 3
 */
export function numeroDaParcela(primeira: Competencia, competencia: Competencia): number {
  return mesesEntre(primeira, competencia) + 1
}

const formatadorMes = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const formatadorDiaMes = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
})

/** "2026-10-01" → "outubro de 2026" */
export function nomeDaCompetencia(competencia: Competencia): string {
  const { ano, mes } = lerData(competencia)
  return formatadorMes.format(new Date(Date.UTC(ano, mes - 1, 1)))
}

/** "2026-10-05" → "05/10" */
export function formatarDiaMes(data: DataISO): string {
  const { ano, mes, dia } = lerData(data)
  return formatadorDiaMes.format(new Date(Date.UTC(ano, mes - 1, dia)))
}

/** Diferença em dias de `de` até `ate` (negativo se `ate` já passou) */
export function diasEntre(de: DataISO, ate: DataISO): number {
  const a = lerData(de)
  const b = lerData(ate)
  const ms = Date.UTC(b.ano, b.mes - 1, b.dia) - Date.UTC(a.ano, a.mes - 1, a.dia)
  return Math.round(ms / 86_400_000)
}

/** Todas as competências de `de` até `ate`, inclusive */
export function listaDeMeses(de: Competencia, ate: Competencia): Competencia[] {
  const n = mesesEntre(de, ate)
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => somarMeses(de, i))
}

const NOMES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-10-01" → "out" (ou "out/26" com o ano) */
export function nomeCurtoDoMes(competencia: Competencia, comAno = false): string {
  const { ano, mes } = lerData(competencia)
  return comAno ? `${NOMES_CURTOS[mes - 1]}/${String(ano).slice(2)}` : NOMES_CURTOS[mes - 1]
}
