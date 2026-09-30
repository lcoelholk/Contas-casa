import { describe, expect, it } from 'vitest'
import { parcelaSugerida, resumoCompra } from './compras.ts'

const geladeira = {
  num_parcelas: 12,
  primeira_competencia: '2026-10-01',
  valor_total_centavos: 360000,
  quitada_em: null,
}

describe('resumoCompra', () => {
  it('geladeira em 12x, 150 + 150 por mês, 1ª parcela paga pelos dois', () => {
    const r = resumoCompra(
      geladeira,
      [15000, 15000],
      [
        { valor_centavos: 15000, pago: true, parcela_numero: 1 },
        { valor_centavos: 15000, pago: true, parcela_numero: 1 },
      ],
      '2026-10-01',
    )
    expect(r.parcelaDoMes).toBe(1)
    expect(r.previsto).toBe(360000)
    expect(r.pago).toBe(30000)
    expect(r.restante).toBe(330000)
    expect(r.diferencaDoTotal).toBe(0)
    expect(r.saldoDepoisDoMes).toBe(11 * 30000)
  })

  it('em janeiro/2027 é a parcela 4', () => {
    expect(resumoCompra(geladeira, [15000, 15000], [], '2027-01-01').parcelaDoMes).toBe(4)
  })

  it('com juros: diferença positiva', () => {
    expect(resumoCompra(geladeira, [16000, 16000], [], '2026-10-01').diferencaDoTotal).toBe(24000)
  })

  it('quitada: previsto é só o que foi gerado', () => {
    const r = resumoCompra(
      { ...geladeira, quitada_em: '2026-11-01' },
      [15000, 15000],
      [
        { valor_centavos: 30000, pago: true, parcela_numero: 1 },
        { valor_centavos: 300000, pago: false, parcela_numero: null },
      ],
      '2026-11-01',
    )
    expect(r.previsto).toBe(330000)
    expect(r.restante).toBe(300000)
    expect(r.saldoDepoisDoMes).toBe(0)
  })

  it('parcela futura já paga é descontada do saldo para quitar', () => {
    const r = resumoCompra(geladeira, [15000, 15000], [{ valor_centavos: 15000, pago: true, parcela_numero: 5 }], '2027-01-01')
    expect(r.saldoDepoisDoMes).toBe(8 * 30000 - 15000)
  })
})

describe('parcelaSugerida', () => {
  it('divide e arredonda', () => {
    expect(parcelaSugerida(360000, 12)).toBe(30000)
    expect(parcelaSugerida(100000, 3)).toBe(33333)
    expect(parcelaSugerida(100000, 0)).toBe(0)
  })
})
