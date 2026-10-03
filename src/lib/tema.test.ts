import { describe, expect, it } from 'vitest'
import { ehEscuro } from './tema.ts'

describe('ehEscuro', () => {
  it('automático segue o celular', () => {
    expect(ehEscuro('automatico', true)).toBe(true)
    expect(ehEscuro('automatico', false)).toBe(false)
  })

  it('escolha fixa ignora o celular', () => {
    expect(ehEscuro('escuro', false)).toBe(true)
    expect(ehEscuro('claro', true)).toBe(false)
  })
})
