/** Cálculos da tela de Resumo */
import { somar } from './dinheiro.ts'
import { diasEntre, type DataISO } from './datas.ts'
import type { Categoria, Lancamento } from '../types/banco.ts'

type ComVencimento = Pick<Lancamento, 'tipo' | 'pago' | 'vencimento'>

/**
 * Separa os gastos não pagos em atrasados (vencimento antes de hoje) e
 * próximos (de hoje até `dias` dias). Os dois vêm do mais antigo para o mais novo.
 */
export function separarAlertas<T extends ComVencimento>(ls: T[], hoje: DataISO, dias = 7) {
  const pendentes = ls
    .filter((l) => l.tipo === 'saida' && !l.pago && l.vencimento)
    .sort((a, b) => (a.vencimento! < b.vencimento! ? -1 : a.vencimento! > b.vencimento! ? 1 : 0))
  return {
    atrasados: pendentes.filter((l) => diasEntre(hoje, l.vencimento!) < 0),
    proximos: pendentes.filter((l) => {
      const d = diasEntre(hoje, l.vencimento!)
      return d >= 0 && d <= dias
    }),
  }
}

export type GastoCategoria = {
  chave: string
  nome: string
  icone: string | null
  total: number
  /** Percentual inteiro do total de gastos */
  percentual: number
}

/** Soma dos gastos por categoria, do maior para o menor ("Sem categoria" entra também) */
export function gastosPorCategoria(
  ls: Pick<Lancamento, 'tipo' | 'categoria_id' | 'valor_centavos'>[],
  categorias: Pick<Categoria, 'id' | 'nome' | 'icone'>[],
): GastoCategoria[] {
  const saidas = ls.filter((l) => l.tipo === 'saida')
  const totalGeral = somar(saidas.map((l) => l.valor_centavos))
  const mapa = new Map<string, number>()
  for (const l of saidas) {
    const chave = l.categoria_id ?? 'sem'
    mapa.set(chave, (mapa.get(chave) ?? 0) + l.valor_centavos)
  }
  return [...mapa.entries()]
    .map(([chave, total]) => {
      const cat = categorias.find((c) => c.id === chave)
      return {
        chave,
        nome: cat?.nome ?? 'Sem categoria',
        icone: cat?.icone ?? null,
        total,
        percentual: totalGeral > 0 ? Math.round((total / totalGeral) * 100) : 0,
      }
    })
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'))
}
