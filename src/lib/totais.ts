/** Totais, agrupamentos e status de vencimento dos lançamentos */
import { somar } from './dinheiro.ts'
import { diasEntre, type DataISO } from './datas.ts'
import type { Lancamento } from '../types/banco.ts'

type Basico = Pick<Lancamento, 'tipo' | 'valor_centavos' | 'pago'>

export type Totais = {
  /** Soma das saídas (o que há para pagar no mês) */
  saidas: number
  /** Saídas já pagas */
  pago: number
  /** Saídas ainda não pagas */
  pendente: number
  entradas: number
  /** entradas − saídas */
  saldo: number
}

export function calcularTotais(lancamentos: Basico[]): Totais {
  const saidas = lancamentos.filter((l) => l.tipo === 'saida')
  const totalSaidas = somar(saidas.map((l) => l.valor_centavos))
  const pago = somar(saidas.filter((l) => l.pago).map((l) => l.valor_centavos))
  const entradas = somar(lancamentos.filter((l) => l.tipo === 'entrada').map((l) => l.valor_centavos))
  return {
    saidas: totalSaidas,
    pago,
    pendente: totalSaidas - pago,
    entradas,
    saldo: entradas - totalSaidas,
  }
}

export type StatusVencimento = 'pago' | 'atrasado' | 'hoje' | 'em-breve' | 'normal' | 'sem-vencimento'

/** Situação de uma saída em relação ao vencimento ("em-breve" = até 7 dias) */
export function statusVencimento(
  l: Pick<Lancamento, 'tipo' | 'pago' | 'vencimento'>,
  hoje: DataISO,
): StatusVencimento {
  if (l.tipo === 'saida' && l.pago) return 'pago'
  if (!l.vencimento) return 'sem-vencimento'
  if (l.tipo === 'entrada') return 'normal'
  const dias = diasEntre(hoje, l.vencimento)
  if (dias < 0) return 'atrasado'
  if (dias === 0) return 'hoje'
  if (dias <= 7) return 'em-breve'
  return 'normal'
}

/** Ordena: com vencimento primeiro (mais cedo antes), depois os mais antigos */
export function ordenarLancamentos<T extends Pick<Lancamento, 'vencimento' | 'criado_em'>>(ls: T[]): T[] {
  return [...ls].sort((a, b) => {
    if (a.vencimento && b.vencimento && a.vencimento !== b.vencimento) {
      return a.vencimento < b.vencimento ? -1 : 1
    }
    if (a.vencimento && !b.vencimento) return -1
    if (!a.vencimento && b.vencimento) return 1
    return a.criado_em < b.criado_em ? -1 : a.criado_em > b.criado_em ? 1 : 0
  })
}

export type Grupo<T> = { chave: string; linhas: T[]; total: number }

/** Junta as partes de um mesmo gasto compartilhado (mesmo grupo_id) */
export function agruparPorGrupo<T extends Pick<Lancamento, 'id' | 'grupo_id' | 'valor_centavos'>>(
  ls: T[],
): Grupo<T>[] {
  const mapa = new Map<string, T[]>()
  for (const l of ls) {
    const chave = l.grupo_id ?? l.id
    mapa.set(chave, [...(mapa.get(chave) ?? []), l])
  }
  return [...mapa.entries()].map(([chave, linhas]) => ({
    chave,
    linhas,
    total: somar(linhas.map((l) => l.valor_centavos)),
  }))
}
