import { describe, expect, it } from 'vitest'
import { ativaNoMes, fixasDoMes, textoDoLimite, totaisFixos } from './fixas.ts'
import type { Recorrente, RecorrenteDivisao } from '../types/banco.ts'

const r = (id: string, extra: Partial<Recorrente> = {}): Recorrente => ({
  id,
  conta_id: 'casa',
  tipo: 'saida',
  descricao: id,
  categoria_id: null,
  dia_vencimento: null,
  inicio: '2026-10-01',
  fim: null,
  ...extra,
})
const d = (
  recorrente_id: string,
  membro_id: string,
  valor_centavos: number,
  vigente_desde = '2026-10-01',
): RecorrenteDivisao => ({
  id: `${recorrente_id}${membro_id}${vigente_desde}`,
  recorrente_id,
  membro_id,
  valor_centavos,
  vigente_desde,
})

describe('ativaNoMes', () => {
  it('entre o início e o fim, inclusive', () => {
    expect(ativaNoMes({ inicio: '2026-10-01', fim: null }, '2026-09-01')).toBe(false)
    expect(ativaNoMes({ inicio: '2026-10-01', fim: null }, '2027-05-01')).toBe(true)
    expect(ativaNoMes({ inicio: '2026-10-01', fim: '2026-12-01' }, '2026-12-01')).toBe(true)
    expect(ativaNoMes({ inicio: '2026-10-01', fim: '2026-12-01' }, '2027-01-01')).toBe(false)
  })
})

describe('fixasDoMes e totaisFixos', () => {
  const recorrentes = [
    r('aluguel', { dia_vencimento: 10 }),
    r('academia', { conta_id: 'lucas', dia_vencimento: 5 }),
    r('salario', { conta_id: 'lucas', tipo: 'entrada', dia_vencimento: 5 }),
    r('antiga', { fim: '2026-09-01', inicio: '2026-01-01' }),
  ]
  const divisoes = [
    d('aluguel', 'L', 120000),
    d('aluguel', 'E', 80000),
    d('aluguel', 'L', 100000, '2026-11-01'),
    d('aluguel', 'E', 100000, '2026-11-01'),
    d('academia', 'L', 12000),
    d('salario', 'L', 500000),
    d('antiga', 'L', 999),
  ]

  it('só as ativas, por dia de vencimento, com a divisão do mês', () => {
    const out = fixasDoMes(recorrentes, divisoes, '2026-10-01')
    expect(out.map((f) => [f.recorrente.id, f.total])).toEqual([
      ['academia', 12000],
      ['salario', 500000],
      ['aluguel', 200000],
    ])
    const nov = fixasDoMes(recorrentes, divisoes, '2026-11-01')
    expect(nov.find((f) => f.recorrente.id === 'aluguel')?.partes).toEqual({ L: 100000, E: 100000 })
  })

  it('total fixo de cada um, separando entradas', () => {
    expect(totaisFixos(fixasDoMes(recorrentes, divisoes, '2026-10-01'), ['L', 'E'])).toEqual([
      { membroId: 'L', saidas: 132000, entradas: 500000 },
      { membroId: 'E', saidas: 80000, entradas: 0 },
    ])
  })
})

describe('textoDoLimite', () => {
  it('sem limite, meses que faltam e último mês', () => {
    expect(textoDoLimite({ fim: null }, '2026-10-01')).toBeNull()
    expect(textoDoLimite({ fim: '2027-07-01' }, '2026-10-01')).toBe('até jul/27 · faltam 9 meses')
    expect(textoDoLimite({ fim: '2026-11-01' }, '2026-10-01')).toBe('até nov/26 · falta 1 mês')
    expect(textoDoLimite({ fim: '2026-10-01' }, '2026-10-01')).toBe('último mês')
  })
})
