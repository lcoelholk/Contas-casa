import { describe, expect, it } from 'vitest'
import {
  acumulado,
  comparativoCategorias,
  dataDoLancamento,
  filtrarTransacoes,
  gastoPorDia,
  ritmo,
  type FiltroTransacoes,
} from './visaoGeral.ts'
import type { Lancamento } from '../types/banco.ts'

const l = (extra: Partial<Lancamento>): Lancamento => ({
  id: Math.random().toString(),
  conta_id: 'casa',
  membro_id: 'lucas',
  tipo: 'saida',
  descricao: 'Mercado',
  valor_centavos: 1000,
  categoria_id: null,
  competencia: '2026-10-01',
  vencimento: null,
  pago: false,
  pago_em: null,
  origem: 'avulso',
  recorrente_id: null,
  compra_id: null,
  parcela_numero: null,
  grupo_id: null,
  editado_manualmente: false,
  observacao: null,
  criado_por: null,
  // 15h UTC = meio-dia em São Paulo
  criado_em: '2026-10-05T15:00:00Z',
  ...extra,
})

describe('dataDoLancamento', () => {
  it('vencimento, senão pago_em, senão quando foi lançado', () => {
    expect(dataDoLancamento(l({ vencimento: '2026-10-10', pago_em: '2026-10-08' }))).toBe('2026-10-10')
    expect(dataDoLancamento(l({ pago_em: '2026-10-08' }))).toBe('2026-10-08')
    expect(dataDoLancamento(l({}))).toBe('2026-10-05')
  })

  it('usa o fuso de São Paulo (01h UTC ainda é o dia anterior)', () => {
    expect(dataDoLancamento(l({ criado_em: '2026-10-06T01:00:00Z' }))).toBe('2026-10-05')
  })

  it('data fora do mês da competência vira o dia 1', () => {
    expect(dataDoLancamento(l({ competencia: '2026-11-01' }))).toBe('2026-11-01')
    expect(dataDoLancamento(l({ competencia: '2026-11-01', vencimento: '2026-12-10' }))).toBe('2026-11-01')
  })
})

describe('gasto por dia e ritmo', () => {
  const out = [
    l({ vencimento: '2026-10-01', valor_centavos: 5000 }),
    l({ vencimento: '2026-10-03', valor_centavos: 2000 }),
    l({ vencimento: '2026-10-03', valor_centavos: 999, tipo: 'entrada' }),
    l({ vencimento: '2026-10-31', valor_centavos: 100 }),
    l({ competencia: '2026-09-01', valor_centavos: 777 }),
  ]

  it('soma só gastos do mês, no dia certo', () => {
    const dias = gastoPorDia(out, '2026-10-01')
    expect(dias).toHaveLength(31)
    expect(dias.slice(0, 3)).toEqual([5000, 0, 2000])
    expect(dias[30]).toBe(100)
    expect(acumulado(dias).slice(0, 3)).toEqual([5000, 5000, 7000])
  })

  it('compara até o mesmo dia do mês anterior', () => {
    const atual = [1000, 0, 500, 0]
    const anterior = [3000, 0, 0, 9000]
    expect(ritmo(atual, anterior, 3)).toEqual({ atual: 1500, anterior: 3000, diferenca: -1500, percentual: -50 })
    expect(ritmo(atual, [0, 0, 0], 3).percentual).toBeNull()
  })

  it('mês anterior mais curto: compara com o total dele', () => {
    expect(ritmo([0, 0, 0, 100], [50, 50], 4)).toMatchObject({ anterior: 100, percentual: 0 })
  })
})

describe('comparativoCategorias', () => {
  it('atual vs anterior, com variação', () => {
    const cats = [
      { id: 'm', nome: 'Mercado', icone: '🛒' },
      { id: 'z', nome: 'Lazer', icone: null },
    ]
    const r = comparativoCategorias(
      [l({ categoria_id: 'm', valor_centavos: 1500 }), l({ categoria_id: 'z', valor_centavos: 300 })],
      [l({ categoria_id: 'm', valor_centavos: 7100 }), l({ valor_centavos: 200 })],
      cats,
    )
    expect(r.map((c) => [c.nome, c.atual, c.anterior, c.variacao])).toEqual([
      ['Mercado', 1500, 7100, -79],
      ['Lazer', 300, 0, null],
      ['Sem categoria', 0, 200, -100],
    ])
  })
})

describe('filtrarTransacoes', () => {
  const base: FiltroTransacoes = {
    busca: '',
    contaId: null,
    membroId: null,
    tipo: 'todos',
    categoriaId: null,
    status: 'todos',
    ordem: 'recentes',
  }
  const ls = [
    l({ id: 'a', descricao: 'Pão de açúcar', vencimento: '2026-10-02', valor_centavos: 3000 }),
    l({ id: 'b', descricao: 'Salário', tipo: 'entrada', vencimento: '2026-10-05', valor_centavos: 500000, pago: true }),
    l({
      id: 'c',
      descricao: 'Uber',
      vencimento: '2026-10-09',
      valor_centavos: 2500,
      membro_id: 'emillia',
      categoria_id: 't',
    }),
  ]

  it('mais recentes primeiro, por padrão', () => {
    expect(filtrarTransacoes(ls, base).map((x) => x.id)).toEqual(['c', 'b', 'a'])
    expect(filtrarTransacoes(ls, { ...base, ordem: 'antigas' }).map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(filtrarTransacoes(ls, { ...base, ordem: 'maior' }).map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })

  it('busca sem acento e sem diferenciar maiúsculas', () => {
    expect(filtrarTransacoes(ls, { ...base, busca: 'PAO' }).map((x) => x.id)).toEqual(['a'])
  })

  it('combina filtros', () => {
    expect(filtrarTransacoes(ls, { ...base, tipo: 'saida', membroId: 'emillia' }).map((x) => x.id)).toEqual(['c'])
    expect(filtrarTransacoes(ls, { ...base, status: 'pago' }).map((x) => x.id)).toEqual(['b'])
    expect(filtrarTransacoes(ls, { ...base, categoriaId: 'sem' }).map((x) => x.id)).toEqual(['b', 'a'])
  })
})
