import { describe, expect, it } from 'vitest'
import { marcasDoEixo, tomDoCalor } from './graficos.tsx'

describe('marcasDoEixo', () => {
  it('passos redondos acima do maior valor', () => {
    expect(marcasDoEixo(410000)).toEqual([0, 200000, 400000, 600000])
    expect(marcasDoEixo(1130000)).toEqual([0, 500000, 1000000, 1500000])
    expect(marcasDoEixo(201000)).toEqual([0, 100000, 200000, 300000])
  })

  it('sem dados ainda mostra um eixo', () => {
    expect(marcasDoEixo(0)).toEqual([0, 5000])
  })
})

describe('tomDoCalor', () => {
  it('zero fica sem cor; o resto em 4 faixas até o maior dia', () => {
    expect(tomDoCalor(0, 1000)).toBe(0)
    expect(tomDoCalor(1, 1000)).toBe(1)
    expect(tomDoCalor(500, 1000)).toBe(2)
    expect(tomDoCalor(1000, 1000)).toBe(4)
  })
})
