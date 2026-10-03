/** Cálculos das telas Visão geral e Transações (tudo em centavos) */
import { somar } from './dinheiro.ts'
import { competenciaDe, diaDe, diasNoMes, hoje, type Competencia, type DataISO } from './datas.ts'
import type { Categoria, Lancamento } from '../types/banco.ts'

type ComDatas = Pick<Lancamento, 'competencia' | 'vencimento' | 'pago_em' | 'criado_em'>

/**
 * A data "do gasto" para listas e para o ritmo do mês:
 * vencimento, senão a data em que foi pago, senão quando foi lançado.
 * Se a data cair fora do mês da competência, usa o dia 1 dele.
 */
export function dataDoLancamento(l: ComDatas): DataISO {
  const candidatas = [l.vencimento, l.pago_em, hoje(new Date(l.criado_em))]
  for (const d of candidatas) if (d && competenciaDe(d) === l.competencia) return d
  return l.competencia
}

type LinhaDia = ComDatas & Pick<Lancamento, 'tipo' | 'valor_centavos'>

/** Gasto de cada dia do mês (índice 0 = dia 1) */
export function gastoPorDia(ls: LinhaDia[], competencia: Competencia): number[] {
  const dias = Array(diasNoMes(competencia)).fill(0) as number[]
  for (const l of ls) {
    if (l.tipo !== 'saida' || l.competencia !== competencia) continue
    dias[diaDe(dataDoLancamento(l)) - 1] += l.valor_centavos
  }
  return dias
}

/** Gasto acumulado até cada dia (índice 0 = dia 1) */
export function acumulado(porDia: number[]): number[] {
  let soma = 0
  return porDia.map((v) => (soma += v))
}

/**
 * Ritmo do mês: quanto foi gasto até `dia` comparado com o mesmo ponto do mês anterior.
 * (Se o mês anterior for mais curto, compara com o último dia dele.)
 */
export function ritmo(atualPorDia: number[], anteriorPorDia: number[], dia: number) {
  const ate = Math.max(1, Math.min(dia, atualPorDia.length))
  const atual = somar(atualPorDia.slice(0, ate))
  const anterior = somar(anteriorPorDia.slice(0, Math.min(ate, anteriorPorDia.length)))
  return {
    atual,
    anterior,
    diferenca: atual - anterior,
    percentual: anterior > 0 ? Math.round(((atual - anterior) / anterior) * 100) : null,
  }
}

export type LinhaCategoria = {
  chave: string
  nome: string
  icone: string | null
  atual: number
  anterior: number
  /** % inteiro vs mês anterior (null quando não havia gasto antes) */
  variacao: number | null
}

/** Gastos por categoria neste mês e no anterior, do maior para o menor (atual) */
export function comparativoCategorias(
  atual: Pick<Lancamento, 'tipo' | 'categoria_id' | 'valor_centavos'>[],
  anterior: Pick<Lancamento, 'tipo' | 'categoria_id' | 'valor_centavos'>[],
  categorias: Pick<Categoria, 'id' | 'nome' | 'icone'>[],
): LinhaCategoria[] {
  const somaPor = (ls: typeof atual) => {
    const m = new Map<string, number>()
    for (const l of ls) {
      if (l.tipo !== 'saida') continue
      const k = l.categoria_id ?? 'sem'
      m.set(k, (m.get(k) ?? 0) + l.valor_centavos)
    }
    return m
  }
  const a = somaPor(atual)
  const b = somaPor(anterior)
  return [...new Set([...a.keys(), ...b.keys()])]
    .map((chave) => {
      const cat = categorias.find((c) => c.id === chave)
      const va = a.get(chave) ?? 0
      const vb = b.get(chave) ?? 0
      return {
        chave,
        nome: cat?.nome ?? 'Sem categoria',
        icone: cat?.icone ?? null,
        atual: va,
        anterior: vb,
        variacao: vb > 0 ? Math.round(((va - vb) / vb) * 100) : null,
      }
    })
    .sort((x, y) => y.atual - x.atual || y.anterior - x.anterior || x.nome.localeCompare(y.nome, 'pt-BR'))
}

// --- Transações ---

export type FiltroTransacoes = {
  busca: string
  contaId: string | null
  membroId: string | null
  tipo: 'todos' | 'saida' | 'entrada'
  categoriaId: string | null
  status: 'todos' | 'pago' | 'pendente'
  ordem: 'recentes' | 'antigas' | 'maior' | 'menor'
}

/** Tira acentos e caixa para a busca: "Pão" acha "pao" */
const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export function filtrarTransacoes<
  T extends ComDatas &
    Pick<Lancamento, 'descricao' | 'conta_id' | 'membro_id' | 'tipo' | 'categoria_id' | 'pago' | 'valor_centavos'>,
>(ls: T[], f: FiltroTransacoes): T[] {
  const termo = normalizar(f.busca.trim())
  const filtrados = ls.filter(
    (l) =>
      (!termo || normalizar(l.descricao).includes(termo)) &&
      (!f.contaId || l.conta_id === f.contaId) &&
      (!f.membroId || l.membro_id === f.membroId) &&
      (f.tipo === 'todos' || l.tipo === f.tipo) &&
      (!f.categoriaId || (f.categoriaId === 'sem' ? l.categoria_id === null : l.categoria_id === f.categoriaId)) &&
      (f.status === 'todos' || (f.status === 'pago') === l.pago),
  )
  const data = new Map(filtrados.map((l) => [l, dataDoLancamento(l)]))
  const porData = (a: T, b: T) => (data.get(a)! < data.get(b)! ? -1 : data.get(a)! > data.get(b)! ? 1 : 0)
  const desempate = (a: T, b: T) => (a.criado_em < b.criado_em ? -1 : a.criado_em > b.criado_em ? 1 : 0)
  return filtrados.sort((a, b) => {
    switch (f.ordem) {
      case 'antigas':
        return porData(a, b) || desempate(a, b)
      case 'maior':
        return b.valor_centavos - a.valor_centavos || porData(b, a)
      case 'menor':
        return a.valor_centavos - b.valor_centavos || porData(b, a)
      default:
        return porData(b, a) || desempate(b, a)
    }
  })
}
