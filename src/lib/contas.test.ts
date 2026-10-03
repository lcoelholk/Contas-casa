import { describe, expect, it } from 'vitest'
import { abasDoMembro, contaPrincipalDe, moverConta, proximaOrdem } from './contas.ts'
import type { Conta } from '../types/banco.ts'

const conta = (id: string, extra: Partial<Conta> = {}): Conta => ({
  id,
  nome: id,
  tipo: 'pessoal',
  dono_id: 'lucas',
  cor: null,
  ordem: 0,
  arquivada: false,
  criado_em: '2026-10-01T10:00:00Z',
  ...extra,
})

describe('contaPrincipalDe', () => {
  it('é a conta pessoal ativa mais antiga do membro', () => {
    const contas = [
      conta('carro', { criado_em: '2026-11-01T00:00:00Z' }),
      conta('lucas', { criado_em: '2026-10-01T00:00:00Z' }),
      conta('emillia', { dono_id: 'emillia' }),
      conta('casa', { tipo: 'compartilhada', dono_id: null, criado_em: '2026-09-01T00:00:00Z' }),
    ]
    expect(contaPrincipalDe(contas, 'lucas')?.id).toBe('lucas')
    expect(contaPrincipalDe(contas, 'emillia')?.id).toBe('emillia')
  })

  it('ignora contas arquivadas', () => {
    const contas = [
      conta('antiga', { arquivada: true, criado_em: '2026-01-01T00:00:00Z' }),
      conta('nova', { criado_em: '2026-10-01T00:00:00Z' }),
    ]
    expect(contaPrincipalDe(contas, 'lucas')?.id).toBe('nova')
  })

  it('membro sem conta pessoal', () => {
    expect(contaPrincipalDe([conta('casa', { tipo: 'compartilhada', dono_id: null })], 'lucas')).toBeUndefined()
  })
})

describe('moverConta', () => {
  const abas = [
    { id: 'a', ordem: 1 },
    { id: 'b', ordem: 2 },
    { id: 'c', ordem: 3 },
  ]

  it('troca com a vizinha e devolve só o que mudou', () => {
    expect(moverConta(abas, 'b', -1)).toEqual([
      { id: 'b', ordem: 1 },
      { id: 'a', ordem: 2 },
    ])
    expect(moverConta(abas, 'b', 1)).toEqual([
      { id: 'c', ordem: 2 },
      { id: 'b', ordem: 3 },
    ])
  })

  it('não sai dos limites', () => {
    expect(moverConta(abas, 'a', -1)).toEqual([])
    expect(moverConta(abas, 'c', 1)).toEqual([])
    expect(moverConta(abas, 'x', 1)).toEqual([])
  })

  it('renumera quando a ordem está repetida (abas antigas com ordem 0)', () => {
    const repetidas = [
      { id: 'a', ordem: 0 },
      { id: 'b', ordem: 0 },
      { id: 'c', ordem: 0 },
    ]
    expect(moverConta(repetidas, 'c', -1)).toEqual([
      { id: 'a', ordem: 1 },
      { id: 'c', ordem: 2 },
      { id: 'b', ordem: 3 },
    ])
  })
})

describe('proximaOrdem', () => {
  it('vai para o fim', () => {
    expect(proximaOrdem([{ ordem: 3 }, { ordem: 1 }])).toBe(4)
    expect(proximaOrdem([])).toBe(1)
  })
})

describe('abasDoMembro', () => {
  const contas = [
    conta('lucas', { ordem: 1, criado_em: '2026-01-01T00:00:00Z' }),
    conta('emillia', { dono_id: 'emillia', ordem: 2 }),
    conta('casa', { tipo: 'compartilhada', dono_id: null, ordem: 3 }),
    conta('carro', { ordem: 0, criado_em: '2026-05-01T00:00:00Z' }),
    conta('velha', { tipo: 'compartilhada', dono_id: null, arquivada: true }),
  ]

  it('as minhas primeiro (principal na frente), depois compartilhadas e as do outro', () => {
    const r = abasDoMembro(contas, 'lucas')
    expect(r.principal?.id).toBe('lucas')
    expect(r.minhas.map((c) => c.id)).toEqual(['lucas', 'carro'])
    expect(r.compartilhadas.map((c) => c.id)).toEqual(['casa'])
    expect(r.dosOutros.map((c) => c.id)).toEqual(['emillia'])
  })

  it('do ponto de vista da Emillia', () => {
    const r = abasDoMembro(contas, 'emillia')
    expect(r.minhas.map((c) => c.id)).toEqual(['emillia'])
    expect(r.dosOutros.map((c) => c.id)).toEqual(['lucas', 'carro'])
  })
})
