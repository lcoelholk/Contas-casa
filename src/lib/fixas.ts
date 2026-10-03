/** Contas fixas (recorrentes) de um mês, com a divisão que vale nele */
import { divisaoVigente, somaPartes, type Partes } from './divisao.ts'
import { mesesEntre, nomeCurtoDoMes, type Competencia } from './datas.ts'
import type { Recorrente, RecorrenteDivisao } from '../types/banco.ts'

export type FixaDoMes = { recorrente: Recorrente; partes: Partes; total: number }

/** Ativa no mês: começou até ele e não terminou antes dele */
export function ativaNoMes(r: Pick<Recorrente, 'inicio' | 'fim'>, competencia: Competencia): boolean {
  return r.inicio <= competencia && (r.fim === null || r.fim >= competencia)
}

/** Contas fixas ativas no mês, com quanto cada um paga, por dia de vencimento */
export function fixasDoMes(
  recorrentes: Recorrente[],
  divisoes: RecorrenteDivisao[],
  competencia: Competencia,
): FixaDoMes[] {
  return recorrentes
    .filter((r) => ativaNoMes(r, competencia))
    .map((recorrente) => {
      const partes = divisaoVigente(divisoes, recorrente.id, competencia)
      return { recorrente, partes, total: somaPartes(partes) }
    })
    .sort(
      (a, b) =>
        (a.recorrente.dia_vencimento ?? 99) - (b.recorrente.dia_vencimento ?? 99) ||
        a.recorrente.descricao.localeCompare(b.recorrente.descricao, 'pt-BR'),
    )
}

/** Total fixo por mês de cada membro: gastos e entradas separados */
export function totaisFixos(fixas: FixaDoMes[], membroIds: string[]) {
  return membroIds.map((id) => ({
    membroId: id,
    saidas: fixas.filter((f) => f.recorrente.tipo === 'saida').reduce((s, f) => s + (f.partes[id] ?? 0), 0),
    entradas: fixas.filter((f) => f.recorrente.tipo === 'entrada').reduce((s, f) => s + (f.partes[id] ?? 0), 0),
  }))
}

/** "até jul/27 · faltam 10 meses", "último mês" ou null (sem data limite) */
export function textoDoLimite(r: Pick<Recorrente, 'fim'>, competencia: Competencia): string | null {
  if (!r.fim) return null
  const faltam = mesesEntre(competencia, r.fim)
  if (faltam <= 0) return 'último mês'
  return `até ${nomeCurtoDoMes(r.fim, true)} · ${faltam === 1 ? 'falta 1 mês' : `faltam ${faltam} meses`}`
}
