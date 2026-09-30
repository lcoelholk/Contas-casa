/**
 * Divisão de gastos compartilhados entre membros.
 * Tudo em centavos. `Partes` = quanto cada membro paga (membroId → centavos).
 */
import { dividirIgual, somar } from './dinheiro.ts'

export type Partes = Record<string, number>

export type ModoDivisao =
  | { tipo: 'igual' }
  | { tipo: 'tudo'; membroId: string }
  | { tipo: 'livre' }

/** Divide igualmente; o centavo que sobra vai para os primeiros */
export function partesIguais(total: number, membroIds: string[]): Partes {
  const valores = dividirIgual(total, membroIds.length)
  return Object.fromEntries(membroIds.map((id, i) => [id, valores[i]]))
}

/** Um membro paga tudo, os outros zero */
export function partesTudoPara(total: number, membroIds: string[], membroId: string): Partes {
  return Object.fromEntries(membroIds.map((id) => [id, id === membroId ? total : 0]))
}

export function partesPorModo(total: number, membroIds: string[], modo: ModoDivisao, livres: Partes): Partes {
  if (modo.tipo === 'igual') return partesIguais(total, membroIds)
  if (modo.tipo === 'tudo') return partesTudoPara(total, membroIds, modo.membroId)
  return Object.fromEntries(membroIds.map((id) => [id, livres[id] ?? 0]))
}

export function somaPartes(partes: Partes): number {
  return somar(Object.values(partes))
}

/** Quanto falta distribuir (positivo) ou quanto passou do total (negativo) */
export function faltaDistribuir(total: number, partes: Partes): number {
  return total - somaPartes(partes)
}

/**
 * Com dois membros, ao digitar a parte de um, o outro recebe o restante.
 * Com três ou mais, só atualiza quem foi editado.
 */
export function atualizarParteLivre(
  total: number,
  membroIds: string[],
  partes: Partes,
  membroId: string,
  valor: number,
): Partes {
  const novas = { ...partes, [membroId]: valor }
  if (membroIds.length === 2) {
    const outro = membroIds.find((id) => id !== membroId)!
    novas[outro] = Math.max(total - valor, 0)
  }
  return novas
}

/** Percentual inteiro de uma parte sobre o total (0 se total = 0) */
export function percentual(parte: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((parte / total) * 100)
}

/** Descobre o modo a partir de partes já salvas (para abrir a edição no modo certo) */
export function detectarModo(total: number, membroIds: string[], partes: Partes): ModoDivisao {
  const iguais = partesIguais(total, membroIds)
  if (membroIds.every((id) => (partes[id] ?? 0) === iguais[id])) return { tipo: 'igual' }
  const pagantes = membroIds.filter((id) => (partes[id] ?? 0) > 0)
  if (pagantes.length === 1 && partes[pagantes[0]] === total) return { tipo: 'tudo', membroId: pagantes[0] }
  return { tipo: 'livre' }
}

export type LinhaExistente = { id: string; membro_id: string }

export type PlanoEdicao = {
  atualizar: { id: string; membro_id: string; valor: number }[]
  inserir: { membro_id: string; valor: number }[]
  excluir: string[]
}

/**
 * Ao editar um gasto compartilhado, compara as linhas salvas com a nova divisão:
 * - membro com linha e valor > 0 → atualiza (mantém o status de pago)
 * - membro com linha e valor 0   → exclui a linha
 * - membro sem linha e valor > 0 → insere uma linha nova no mesmo grupo
 */
export function planejarEdicaoGrupo(linhas: LinhaExistente[], partes: Partes): PlanoEdicao {
  const plano: PlanoEdicao = { atualizar: [], inserir: [], excluir: [] }
  const comLinha = new Set<string>()

  for (const linha of linhas) {
    comLinha.add(linha.membro_id)
    const valor = partes[linha.membro_id] ?? 0
    if (valor > 0) plano.atualizar.push({ id: linha.id, membro_id: linha.membro_id, valor })
    else plano.excluir.push(linha.id)
  }
  for (const [membroId, valor] of Object.entries(partes)) {
    if (!comLinha.has(membroId) && valor > 0) plano.inserir.push({ membro_id: membroId, valor })
  }
  return plano
}

/**
 * A divisão de uma conta fixa que vale num mês: para cada membro,
 * a linha com o maior `vigente_desde` que não passa do mês.
 */
export function divisaoVigente(
  divisoes: { recorrente_id: string; membro_id: string; valor_centavos: number; vigente_desde: string }[],
  recorrenteId: string,
  competencia: string,
): Partes {
  const melhor = new Map<string, { vigente_desde: string; valor_centavos: number }>()
  for (const d of divisoes) {
    if (d.recorrente_id !== recorrenteId || d.vigente_desde > competencia) continue
    const atual = melhor.get(d.membro_id)
    if (!atual || d.vigente_desde > atual.vigente_desde) melhor.set(d.membro_id, d)
  }
  return Object.fromEntries([...melhor.entries()].map(([id, d]) => [id, d.valor_centavos]))
}
