import { describe, expect, it } from 'vitest'
import { direcaoDoArrasto } from './gestos.ts'

describe('direcaoDoArrasto', () => {
  it('dedo para a esquerda vai para o próximo mês', () => {
    expect(direcaoDoArrasto(-120, 10)).toBe(1)
  })
  it('dedo para a direita volta um mês', () => {
    expect(direcaoDoArrasto(90, -5)).toBe(-1)
  })
  it('arrasto curto não faz nada', () => {
    expect(direcaoDoArrasto(40, 0)).toBe(0)
  })
  it('rolagem na diagonal não troca o mês', () => {
    expect(direcaoDoArrasto(80, 60)).toBe(0)
    expect(direcaoDoArrasto(-200, 90)).toBe(1)
  })
})
