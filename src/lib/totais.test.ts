import { describe, expect, it } from 'vitest'
import { agruparPorGrupo, calcularTotais, ordenarLancamentos, statusVencimento } from './totais.ts'

describe('calcularTotais', () => {
  it('soma saídas, pagas, pendentes, entradas e saldo', () => {
    const t = calcularTotais([
      { tipo: 'saida', valor_centavos: 120000, pago: true },
      { tipo: 'saida', valor_centavos: 18000, pago: false },
      { tipo: 'entrada', valor_centavos: 500000, pago: false },
    ])
    expect(t).toEqual({ saidas: 138000, pago: 120000, pendente: 18000, entradas: 500000, saldo: 362000 })
  })

  it('lista vazia', () => {
    expect(calcularTotais([])).toEqual({ saidas: 0, pago: 0, pendente: 0, entradas: 0, saldo: 0 })
  })
})

describe('statusVencimento', () => {
  const hoje = '2026-10-10'
  const s = (vencimento: string | null, pago = false, tipo: 'saida' | 'entrada' = 'saida') =>
    statusVencimento({ tipo, pago, vencimento }, hoje)

  it('classifica', () => {
    expect(s('2026-10-05')).toBe('atrasado')
    expect(s('2026-10-10')).toBe('hoje')
    expect(s('2026-10-17')).toBe('em-breve')
    expect(s('2026-10-18')).toBe('normal')
    expect(s(null)).toBe('sem-vencimento')
    expect(s('2026-10-05', true)).toBe('pago')
    expect(s('2026-10-05', false, 'entrada')).toBe('normal')
  })
})

describe('ordenarLancamentos', () => {
  it('vencimento mais cedo primeiro, sem vencimento no fim', () => {
    const ls = [
      { id: 'a', vencimento: null, criado_em: '2026-10-01T10:00:00Z' },
      { id: 'b', vencimento: '2026-10-20', criado_em: '2026-10-01T09:00:00Z' },
      { id: 'c', vencimento: '2026-10-05', criado_em: '2026-10-01T11:00:00Z' },
      { id: 'd', vencimento: null, criado_em: '2026-10-01T08:00:00Z' },
    ]
    expect(ordenarLancamentos(ls).map((l) => l.id)).toEqual(['c', 'b', 'd', 'a'])
  })
})

describe('agruparPorGrupo', () => {
  it('junta as partes do mesmo gasto', () => {
    const grupos = agruparPorGrupo([
      { id: '1', grupo_id: 'g', valor_centavos: 18000 },
      { id: '2', grupo_id: 'g', valor_centavos: 12000 },
      { id: '3', grupo_id: null, valor_centavos: 500 },
    ])
    expect(grupos).toEqual([
      { chave: 'g', linhas: [expect.objectContaining({ id: '1' }), expect.objectContaining({ id: '2' })], total: 30000 },
      { chave: '3', linhas: [expect.objectContaining({ id: '3' })], total: 500 },
    ])
  })
})
