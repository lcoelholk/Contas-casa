import { describe, expect, it } from 'vitest'
import {
  acumuladoPorMes,
  compromissosPorMes,
  gastoNaCategoria,
  gastosPorMembro,
  indicadores,
  progressoMeta,
  serieMensal,
  situacaoOrcamento,
  situacoesDoMes,
  variacao,
  type LinhaAnalise,
} from './analises.ts'

const l = (extra: Partial<LinhaAnalise>): LinhaAnalise => ({
  conta_id: 'casa',
  membro_id: 'lucas',
  tipo: 'saida',
  valor_centavos: 1000,
  categoria_id: null,
  competencia: '2026-10-01',
  origem: 'avulso',
  pago: false,
  ...extra,
})

const meses = ['2026-09-01', '2026-10-01', '2026-11-01']

describe('serieMensal e indicadores', () => {
  const ls = [
    l({ tipo: 'entrada', valor_centavos: 500000 }),
    l({ valor_centavos: 120000 }),
    l({ valor_centavos: 30000, competencia: '2026-11-01' }),
    l({ tipo: 'entrada', valor_centavos: 500000, competencia: '2026-11-01' }),
  ]
  const serie = serieMensal(ls, meses)

  it('soma por mês, com zero nos meses vazios', () => {
    expect(serie).toEqual([
      { mes: '2026-09-01', entradas: 0, saidas: 0, saldo: 0 },
      { mes: '2026-10-01', entradas: 500000, saidas: 120000, saldo: 380000 },
      { mes: '2026-11-01', entradas: 500000, saidas: 30000, saldo: 470000 },
    ])
  })

  it('média só dos meses com dados e taxa de economia', () => {
    expect(indicadores(serie)).toEqual({
      mediaSaidas: 75000,
      mediaEntradas: 500000,
      taxaEconomia: 85,
      mesesComDados: 2,
    })
  })

  it('sem entradas, taxa de economia é null', () => {
    expect(indicadores(serieMensal([l({})], meses)).taxaEconomia).toBeNull()
  })

  it('variação', () => {
    expect(variacao(100000, 120000)).toBe(20)
    expect(variacao(100000, 75000)).toBe(-25)
    expect(variacao(0, 1000)).toBeNull()
  })
})

describe('compromissosPorMes', () => {
  it('separa fixas, parcelas e outros, só gastos', () => {
    const ls = [
      l({ origem: 'recorrente', valor_centavos: 200000 }),
      l({ origem: 'parcela', valor_centavos: 30000 }),
      l({ origem: 'parcela', valor_centavos: 30000, membro_id: 'emillia' }),
      l({ origem: 'recorrente', tipo: 'entrada', valor_centavos: 999999 }),
    ]
    expect(compromissosPorMes(ls, ['2026-10-01'])).toEqual([
      { mes: '2026-10-01', fixas: 200000, parcelas: 60000, outros: 0 },
    ])
  })
})

describe('gastosPorMembro', () => {
  it('soma por membro só nas contas pedidas', () => {
    const ls = [
      l({ valor_centavos: 18000 }),
      l({ valor_centavos: 12000, membro_id: 'emillia' }),
      l({ valor_centavos: 5000, conta_id: 'pessoal-lucas' }),
    ]
    expect(gastosPorMembro(ls, ['2026-10-01'], ['lucas', 'emillia'], ['casa'])).toEqual([
      { mes: '2026-10-01', valores: [18000, 12000] },
    ])
  })
})

describe('orçamento', () => {
  it('ok, atenção a partir de 80% e estourou acima do limite', () => {
    expect(situacaoOrcamento(50000, 100000)).toEqual({ percentual: 50, status: 'ok', restante: 50000 })
    expect(situacaoOrcamento(80000, 100000).status).toBe('atencao')
    expect(situacaoOrcamento(100000, 100000).status).toBe('atencao')
    expect(situacaoOrcamento(100001, 100000)).toEqual({ percentual: 100, status: 'estourou', restante: -1 })
  })

  it('gasto na categoria, de uma pessoa ou dos dois', () => {
    const ls = [
      l({ categoria_id: 'mercado', valor_centavos: 18000 }),
      l({ categoria_id: 'mercado', valor_centavos: 12000, membro_id: 'emillia' }),
      l({ categoria_id: 'mercado', valor_centavos: 9999, competencia: '2026-11-01' }),
      l({ categoria_id: 'lazer', valor_centavos: 5000 }),
    ]
    expect(gastoNaCategoria(ls, '2026-10-01', 'mercado', null)).toBe(30000)
    expect(gastoNaCategoria(ls, '2026-10-01', 'mercado', 'emillia')).toBe(12000)
  })
})

describe('progressoMeta', () => {
  it('quanto falta e quanto guardar por mês até o prazo', () => {
    // faltam 520.000 em 9 meses (out a jun, contando outubro)
    expect(progressoMeta(600000, [50000, 30000], '2027-06-01', '2026-10-01')).toEqual({
      guardado: 80000,
      falta: 520000,
      percentual: 13,
      concluida: false,
      mesesRestantes: 9,
      porMes: 57778,
      atrasada: false,
    })
  })

  it('sem prazo não calcula por mês', () => {
    const p = progressoMeta(100000, [10000], null, '2026-10-01')
    expect(p.porMes).toBeNull()
    expect(p.mesesRestantes).toBeNull()
  })

  it('concluída quando guardou tudo (ou mais)', () => {
    const p = progressoMeta(100000, [60000, 50000], '2026-12-01', '2026-10-01')
    expect(p).toMatchObject({ concluida: true, falta: 0, percentual: 110, porMes: null })
  })

  it('prazo vencido sem atingir fica atrasada', () => {
    const p = progressoMeta(100000, [10000], '2026-08-01', '2026-10-01')
    expect(p).toMatchObject({ atrasada: true, mesesRestantes: 0, porMes: 90000 })
  })

  it('retiradas descontam e o percentual não fica negativo', () => {
    expect(progressoMeta(100000, [10000, -20000], null, '2026-10-01')).toMatchObject({
      guardado: -10000,
      percentual: 0,
      falta: 110000,
    })
  })
})

describe('acumuladoPorMes', () => {
  it('soma os aportes até o fim de cada mês', () => {
    const aportes = [
      { valor_centavos: 50000, data: '2026-09-15' },
      { valor_centavos: 30000, data: '2026-10-02' },
      { valor_centavos: -10000, data: '2026-10-30' },
    ]
    expect(acumuladoPorMes(aportes, meses)).toEqual([
      { mes: '2026-09-01', total: 50000 },
      { mes: '2026-10-01', total: 70000 },
      { mes: '2026-11-01', total: 70000 },
    ])
  })
})

describe('situacoesDoMes', () => {
  it('ordena: estourou, atenção, ok', () => {
    const ls = [
      l({ categoria_id: 'mercado', valor_centavos: 160000 }),
      l({ categoria_id: 'lazer', valor_centavos: 45000 }),
      l({ categoria_id: 'saude', valor_centavos: 1000 }),
    ]
    const orc = (id: string, categoria_id: string, valor_centavos: number) => ({
      id,
      categoria_id,
      membro_id: null,
      valor_centavos,
    })
    const r = situacoesDoMes(
      [orc('a', 'saude', 50000), orc('b', 'mercado', 150000), orc('c', 'lazer', 50000)],
      ls,
      '2026-10-01',
    )
    expect(r.map((x) => [x.orcamento.id, x.situacao.status])).toEqual([
      ['b', 'estourou'],
      ['c', 'atencao'],
      ['a', 'ok'],
    ])
  })
})
