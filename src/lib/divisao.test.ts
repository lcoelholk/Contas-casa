import { describe, expect, it } from 'vitest'
import {
  atualizarParteLivre,
  detectarModo,
  divisaoVigente,
  faltaDistribuir,
  partesIguais,
  partesPorModo,
  partesTudoPara,
  percentual,
  planejarEdicaoGrupo,
  somaPartes,
} from './divisao.ts'

const L = 'lucas'
const E = 'emillia'
const ids = [L, E]

describe('partes', () => {
  it('50/50 sem perder centavo', () => {
    expect(partesIguais(30000, ids)).toEqual({ lucas: 15000, emillia: 15000 })
    expect(partesIguais(1001, ids)).toEqual({ lucas: 501, emillia: 500 })
  })

  it('tudo para um', () => {
    expect(partesTudoPara(30000, ids, E)).toEqual({ lucas: 0, emillia: 30000 })
  })

  it('por modo', () => {
    expect(partesPorModo(1000, ids, { tipo: 'igual' }, {})).toEqual({ lucas: 500, emillia: 500 })
    expect(partesPorModo(1000, ids, { tipo: 'tudo', membroId: L }, {})).toEqual({ lucas: 1000, emillia: 0 })
    expect(partesPorModo(1000, ids, { tipo: 'livre' }, { lucas: 600 })).toEqual({ lucas: 600, emillia: 0 })
  })
})

describe('divisão livre', () => {
  it('mercado R$ 300 em 60/40: digitar 180 do Lucas completa 120 da Emillia', () => {
    const partes = atualizarParteLivre(30000, ids, { lucas: 15000, emillia: 15000 }, L, 18000)
    expect(partes).toEqual({ lucas: 18000, emillia: 12000 })
    expect(faltaDistribuir(30000, partes)).toBe(0)
    expect(percentual(partes.lucas, 30000)).toBe(60)
  })

  it('o complemento nunca fica negativo', () => {
    expect(atualizarParteLivre(30000, ids, {}, L, 40000)).toEqual({ lucas: 40000, emillia: 0 })
    expect(faltaDistribuir(30000, { lucas: 40000, emillia: 0 })).toBe(-10000)
  })

  it('com três membros não completa automaticamente', () => {
    const tres = [L, E, 'pet']
    const p = atualizarParteLivre(900, tres, { lucas: 300, emillia: 300, pet: 300 }, L, 500)
    expect(p).toEqual({ lucas: 500, emillia: 300, pet: 300 })
    expect(faltaDistribuir(900, p)).toBe(-200)
  })

  it('soma e percentual', () => {
    expect(somaPartes({ a: 1, b: 2 })).toBe(3)
    expect(percentual(1, 0)).toBe(0)
  })
})

describe('detectarModo', () => {
  it('reconhece cada modo', () => {
    expect(detectarModo(30000, ids, { lucas: 15000, emillia: 15000 })).toEqual({ tipo: 'igual' })
    expect(detectarModo(30000, ids, { lucas: 30000 })).toEqual({ tipo: 'tudo', membroId: L })
    expect(detectarModo(30000, ids, { lucas: 18000, emillia: 12000 })).toEqual({ tipo: 'livre' })
  })
})

describe('planejarEdicaoGrupo', () => {
  const linhas = [
    { id: 'l1', membro_id: L },
    { id: 'l2', membro_id: E },
  ]

  it('muda valores: atualiza as duas linhas', () => {
    expect(planejarEdicaoGrupo(linhas, { lucas: 20000, emillia: 10000 })).toEqual({
      atualizar: [
        { id: 'l1', membro_id: L, valor: 20000 },
        { id: 'l2', membro_id: E, valor: 10000 },
      ],
      inserir: [],
      excluir: [],
    })
  })

  it('passa a ser tudo do Lucas: exclui a linha da Emillia', () => {
    const plano = planejarEdicaoGrupo(linhas, { lucas: 30000, emillia: 0 })
    expect(plano.excluir).toEqual(['l2'])
    expect(plano.atualizar).toEqual([{ id: 'l1', membro_id: L, valor: 30000 }])
  })

  it('era tudo do Lucas e agora divide: insere a linha da Emillia', () => {
    const plano = planejarEdicaoGrupo([{ id: 'l1', membro_id: L }], { lucas: 15000, emillia: 15000 })
    expect(plano.inserir).toEqual([{ membro_id: E, valor: 15000 }])
  })
})

describe('divisaoVigente', () => {
  const divisoes = [
    { recorrente_id: 'r', membro_id: L, valor_centavos: 120000, vigente_desde: '2026-10-01' },
    { recorrente_id: 'r', membro_id: E, valor_centavos: 80000, vigente_desde: '2026-10-01' },
    { recorrente_id: 'r', membro_id: L, valor_centavos: 100000, vigente_desde: '2026-11-01' },
    { recorrente_id: 'r', membro_id: E, valor_centavos: 100000, vigente_desde: '2026-11-01' },
    { recorrente_id: 'outra', membro_id: L, valor_centavos: 1, vigente_desde: '2026-01-01' },
  ]

  it('outubro usa a divisão de outubro', () => {
    expect(divisaoVigente(divisoes, 'r', '2026-10-01')).toEqual({ lucas: 120000, emillia: 80000 })
  })
  it('novembro em diante usa a nova', () => {
    expect(divisaoVigente(divisoes, 'r', '2026-11-01')).toEqual({ lucas: 100000, emillia: 100000 })
    expect(divisaoVigente(divisoes, 'r', '2027-05-01')).toEqual({ lucas: 100000, emillia: 100000 })
  })
  it('antes do início: vazio', () => {
    expect(divisaoVigente(divisoes, 'r', '2026-09-01')).toEqual({})
  })
})
