import { describe, expect, it } from 'vitest'
import { chavesAfetadas } from './tempoReal.ts'

describe('chavesAfetadas', () => {
  it('lançamento novo atualiza o mês e o progresso das compras', () => {
    expect(chavesAfetadas(['lancamentos'])).toEqual(['compras', 'lancamentos'])
  })

  it('junta várias tabelas sem repetir', () => {
    expect(chavesAfetadas(['recorrente_divisoes', 'lancamentos', 'contas'])).toEqual([
      'compras',
      'contas',
      'lancamentos',
      'recorrentes',
    ])
  })

  it('ignora tabela desconhecida', () => {
    expect(chavesAfetadas(['outra'])).toEqual([])
  })
})
