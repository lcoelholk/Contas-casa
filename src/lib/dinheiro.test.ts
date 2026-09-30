import { describe, expect, it } from 'vitest'
import {
  centavosParaCampo,
  dividirIgual,
  dividirPorPercentual,
  formatarCentavos,
  paraCentavos,
  somar,
} from './dinheiro.ts'

// O Intl usa espaço não separável depois do "R$"; normalizamos para comparar
const norm = (s: string) => s.replace(/\s/g, ' ')

describe('formatarCentavos', () => {
  it('formata em reais', () => {
    expect(norm(formatarCentavos(1250))).toBe('R$ 12,50')
    expect(norm(formatarCentavos(123456))).toBe('R$ 1.234,56')
    expect(norm(formatarCentavos(0))).toBe('R$ 0,00')
    expect(norm(formatarCentavos(5))).toBe('R$ 0,05')
  })
})

describe('paraCentavos', () => {
  it.each([
    ['12,50', 1250],
    ['12,5', 1250],
    ['1.234,56', 123456],
    ['R$ 12', 1200],
    ['R$ 1.200,00', 120000],
    ['12.5', 1250],
    ['12.50', 1250],
    ['1.234', 123400],
    ['1234', 123400],
    [',99', 99],
    ['-10,00', -1000],
    ['0,01', 1],
  ])('"%s" → %i', (entrada, esperado) => {
    expect(paraCentavos(entrada)).toBe(esperado)
  })

  it.each(['', 'abc', '12,345', '1,2,3', '12,5a', 'R$'])('"%s" é inválido', (entrada) => {
    expect(paraCentavos(entrada)).toBeNull()
  })
})

describe('centavosParaCampo', () => {
  it('converte para texto de formulário', () => {
    expect(centavosParaCampo(1250)).toBe('12,50')
    expect(centavosParaCampo(5)).toBe('0,05')
    expect(centavosParaCampo(-1000)).toBe('-10,00')
  })

  it('ida e volta sem perder valor', () => {
    for (const v of [0, 1, 99, 100, 1250, 123456, 999999]) {
      expect(paraCentavos(centavosParaCampo(v))).toBe(v)
    }
  })
})

describe('somar', () => {
  it('soma centavos sem erro de ponto flutuante', () => {
    expect(somar([10, 20])).toBe(30) // 0,10 + 0,20 = 0,30 exato
    expect(somar([])).toBe(0)
  })
})

describe('dividirIgual', () => {
  it('não perde centavos', () => {
    expect(dividirIgual(1000, 3)).toEqual([334, 333, 333])
    expect(dividirIgual(1001, 2)).toEqual([501, 500])
    expect(dividirIgual(360000, 12).every((p) => p === 30000)).toBe(true)
  })

  it('a soma das partes é sempre o total', () => {
    for (const total of [1, 7, 999, 12345]) {
      for (const n of [1, 2, 3, 7]) {
        expect(somar(dividirIgual(total, n))).toBe(total)
      }
    }
  })

  it('rejeita número de partes inválido', () => {
    expect(() => dividirIgual(100, 0)).toThrow()
  })
})

describe('dividirPorPercentual', () => {
  it('divide 60/40', () => {
    expect(dividirPorPercentual(30000, [60, 40])).toEqual([18000, 12000])
  })

  it('ajusta o centavo que sobra', () => {
    const partes = dividirPorPercentual(1001, [50, 50])
    expect(somar(partes)).toBe(1001)
  })

  it('aceita pesos que não somam 100', () => {
    expect(dividirPorPercentual(900, [2, 1])).toEqual([600, 300])
  })
})
