/** Regras das abas (contas): aba principal de cada pessoa, ordem e cores */
import type { Conta } from '../types/banco.ts'

/** Cores oferecidas ao criar uma aba ou escolher a cor de uma pessoa */
export const CORES = [
  '#0284c7', // azul
  '#e11d48', // rosa
  '#0d9488', // verde-água
  '#16a34a', // verde
  '#ca8a04', // amarelo
  '#ea580c', // laranja
  '#7c3aed', // roxo
  '#db2777', // pink
  '#475569', // cinza
] as const

type ContaMinima = Pick<Conta, 'id' | 'tipo' | 'dono_id' | 'arquivada' | 'criado_em'>

/**
 * A aba principal de uma pessoa: a conta pessoal ativa mais antiga dela.
 * É nela que aparecem a parte da pessoa nas contas compartilhadas e o total do mês.
 * As outras contas pessoais dela (ex.: "Carro") mostram só os próprios lançamentos.
 */
export function contaPrincipalDe<T extends ContaMinima>(contas: T[], membroId: string): T | undefined {
  return contas
    .filter((c) => c.tipo === 'pessoal' && c.dono_id === membroId && !c.arquivada)
    .sort((a, b) => (a.criado_em < b.criado_em ? -1 : a.criado_em > b.criado_em ? 1 : 0))[0]
}

/**
 * Move uma aba uma posição para cima (-1) ou para baixo (+1).
 * Devolve a nova ordem (1, 2, 3...) só das abas que mudaram de posição.
 */
export function moverConta(
  contas: Pick<Conta, 'id' | 'ordem'>[],
  id: string,
  direcao: -1 | 1,
): { id: string; ordem: number }[] {
  const lista = [...contas]
  const i = lista.findIndex((c) => c.id === id)
  const j = i + direcao
  if (i < 0 || j < 0 || j >= lista.length) return []
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
  return lista
    .map((c, k) => ({ id: c.id, ordem: k + 1 }))
    .filter((n, k) => contas[k].id !== n.id || contas[k].ordem !== n.ordem)
}

/** Próximo número de ordem para uma aba nova (vai para o fim) */
export function proximaOrdem(contas: Pick<Conta, 'ordem'>[]): number {
  return contas.reduce((maior, c) => Math.max(maior, c.ordem), 0) + 1
}
