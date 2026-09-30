import { describe, expect, it } from 'vitest'
import { gastosPorCategoria, separarAlertas } from './resumo.ts'

describe('separarAlertas', () => {
  const hoje = '2026-09-30'
  const l = (id: string, vencimento: string | null, pago = false, tipo: 'saida' | 'entrada' = 'saida') => ({
    id,
    vencimento,
    pago,
    tipo,
  })

  it('separa atrasados e próximos 7 dias, em ordem de vencimento', () => {
    const r = separarAlertas(
      [
        l('luz-out', '2026-10-05'),
        l('aluguel-set', '2026-09-10'),
        l('hoje', '2026-09-30'),
        l('longe', '2026-10-08'), // 8 dias: fora
        l('limite', '2026-10-07'), // 7 dias: dentro
        l('pago', '2026-09-15', true),
        l('sem-venc', null),
        l('salario', '2026-10-05', false, 'entrada'),
        l('antigo', '2026-08-20'),
      ],
      hoje,
    )
    expect(r.atrasados.map((x) => x.id)).toEqual(['antigo', 'aluguel-set'])
    expect(r.proximos.map((x) => x.id)).toEqual(['hoje', 'luz-out', 'limite'])
  })
})

describe('gastosPorCategoria', () => {
  const categorias = [
    { id: 'mer', nome: 'Mercado', icone: '🛒' },
    { id: 'mor', nome: 'Moradia', icone: '🏠' },
  ]

  it('soma por categoria, ordena e calcula percentual', () => {
    const r = gastosPorCategoria(
      [
        { tipo: 'saida', categoria_id: 'mor', valor_centavos: 200000 },
        { tipo: 'saida', categoria_id: 'mer', valor_centavos: 30000 },
        { tipo: 'saida', categoria_id: 'mer', valor_centavos: 20000 },
        { tipo: 'saida', categoria_id: null, valor_centavos: 50000 },
        { tipo: 'entrada', categoria_id: null, valor_centavos: 999999 },
      ],
      categorias,
    )
    expect(r.map((c) => [c.nome, c.total, c.percentual])).toEqual([
      ['Moradia', 200000, 67],
      ['Mercado', 50000, 17],
      ['Sem categoria', 50000, 17],
    ])
  })

  it('sem gastos: lista vazia', () => {
    expect(gastosPorCategoria([], categorias)).toEqual([])
  })
})
