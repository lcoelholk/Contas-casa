/** Cálculos das telas de Gráficos e Metas (tudo em centavos) */
import { somar } from './dinheiro.ts'
import type { Competencia, DataISO } from './datas.ts'
import { mesesEntre } from './datas.ts'
import type { Lancamento, Orcamento } from '../types/banco.ts'

/** O mínimo de um lançamento que as análises usam */
export type LinhaAnalise = Pick<
  Lancamento,
  'conta_id' | 'membro_id' | 'tipo' | 'valor_centavos' | 'categoria_id' | 'competencia' | 'origem' | 'pago'
>

export type PontoMensal = { mes: Competencia; entradas: number; saidas: number; saldo: number }

/** Entradas, gastos e saldo de cada mês (meses sem nada entram com zero) */
export function serieMensal(ls: LinhaAnalise[], meses: Competencia[]): PontoMensal[] {
  return meses.map((mes) => {
    const doMes = ls.filter((l) => l.competencia === mes)
    const entradas = somar(doMes.filter((l) => l.tipo === 'entrada').map((l) => l.valor_centavos))
    const saidas = somar(doMes.filter((l) => l.tipo === 'saida').map((l) => l.valor_centavos))
    return { mes, entradas, saidas, saldo: entradas - saidas }
  })
}

export type Indicadores = {
  /** Média mensal de gastos e de entradas nos meses com algum lançamento */
  mediaSaidas: number
  mediaEntradas: number
  /** Quanto das entradas sobrou, em % inteiro (null sem entradas) */
  taxaEconomia: number | null
  /** Meses que entraram na média */
  mesesComDados: number
}

export function indicadores(serie: PontoMensal[]): Indicadores {
  const comDados = serie.filter((p) => p.entradas > 0 || p.saidas > 0)
  const n = comDados.length
  const entradas = somar(comDados.map((p) => p.entradas))
  const saidas = somar(comDados.map((p) => p.saidas))
  return {
    mediaSaidas: n ? Math.round(saidas / n) : 0,
    mediaEntradas: n ? Math.round(entradas / n) : 0,
    taxaEconomia: entradas > 0 ? Math.round(((entradas - saidas) / entradas) * 100) : null,
    mesesComDados: n,
  }
}

/** Variação percentual inteira de `antes` para `depois` (null se antes = 0) */
export function variacao(antes: number, depois: number): number | null {
  if (antes === 0) return null
  return Math.round(((depois - antes) / antes) * 100)
}

export type Compromisso = { mes: Competencia; fixas: number; parcelas: number; outros: number }

/** Gastos já lançados em cada mês, separados por origem (para os próximos meses) */
export function compromissosPorMes(ls: LinhaAnalise[], meses: Competencia[]): Compromisso[] {
  return meses.map((mes) => {
    const doMes = ls.filter((l) => l.competencia === mes && l.tipo === 'saida')
    const soma = (o: Lancamento['origem']) => somar(doMes.filter((l) => l.origem === o).map((l) => l.valor_centavos))
    return { mes, fixas: soma('recorrente'), parcelas: soma('parcela'), outros: soma('avulso') }
  })
}

/** Quanto cada membro gastou nas contas indicadas, mês a mês */
export function gastosPorMembro(
  ls: LinhaAnalise[],
  meses: Competencia[],
  membros: string[],
  contas: string[],
): { mes: Competencia; valores: number[] }[] {
  return meses.map((mes) => ({
    mes,
    valores: membros.map((m) =>
      somar(
        ls
          .filter(
            (l) => l.competencia === mes && l.tipo === 'saida' && l.membro_id === m && contas.includes(l.conta_id),
          )
          .map((l) => l.valor_centavos),
      ),
    ),
  }))
}

// --- Orçamento por categoria ---

export type StatusOrcamento = 'ok' | 'atencao' | 'estourou'

/** A partir de 80% do limite, o orçamento fica em atenção */
export const LIMITE_ATENCAO = 80

export function situacaoOrcamento(gasto: number, limite: number) {
  const percentual = limite > 0 ? Math.round((gasto / limite) * 100) : 0
  const status: StatusOrcamento = gasto > limite ? 'estourou' : percentual >= LIMITE_ATENCAO ? 'atencao' : 'ok'
  return { percentual, status, restante: limite - gasto }
}

/** Gasto do mês numa categoria, de uma pessoa (ou dos dois, com membroId nulo) */
export function gastoNaCategoria(
  ls: LinhaAnalise[],
  mes: Competencia,
  categoriaId: string,
  membroId: string | null,
): number {
  return somar(
    ls
      .filter(
        (l) =>
          l.competencia === mes &&
          l.tipo === 'saida' &&
          l.categoria_id === categoriaId &&
          (membroId === null || l.membro_id === membroId),
      )
      .map((l) => l.valor_centavos),
  )
}

/** Situação de cada limite no mês, os que mais preocupam primeiro */
export function situacoesDoMes(orcamentos: Orcamento[], lancamentos: LinhaAnalise[], competencia: Competencia) {
  const ordem: Record<StatusOrcamento, number> = { estourou: 0, atencao: 1, ok: 2 }
  return orcamentos
    .map((o) => {
      const gasto = gastoNaCategoria(lancamentos, competencia, o.categoria_id, o.membro_id)
      return { orcamento: o, gasto, situacao: situacaoOrcamento(gasto, o.valor_centavos) }
    })
    .sort(
      (a, b) => ordem[a.situacao.status] - ordem[b.situacao.status] || b.situacao.percentual - a.situacao.percentual,
    )
}

// --- Metas de economia ---

export type ProgressoMeta = {
  guardado: number
  falta: number
  /** 0 a 100 (pode passar de 100 se guardou além da meta) */
  percentual: number
  concluida: boolean
  /** Meses até o prazo, contando o atual (null sem prazo) */
  mesesRestantes: number | null
  /** Quanto guardar por mês para chegar no prazo (null sem prazo ou já concluída) */
  porMes: number | null
  /** Prazo já passou e a meta não foi atingida */
  atrasada: boolean
}

export function progressoMeta(
  alvo: number,
  aportes: number[],
  prazo: Competencia | null,
  mesAtual: Competencia,
): ProgressoMeta {
  const guardado = somar(aportes)
  const falta = Math.max(0, alvo - guardado)
  const concluida = falta === 0
  const mesesRestantes = prazo ? Math.max(0, mesesEntre(mesAtual, prazo) + 1) : null
  const atrasada = !concluida && mesesRestantes === 0
  const porMes = concluida || mesesRestantes === null ? null : Math.ceil(falta / Math.max(1, mesesRestantes))
  return {
    guardado,
    falta,
    percentual: alvo > 0 ? Math.max(0, Math.floor((guardado / alvo) * 100)) : 0,
    concluida,
    mesesRestantes,
    porMes,
    atrasada,
  }
}

/** Saldo acumulado da meta mês a mês (para o gráfico de evolução) */
export function acumuladoPorMes(aportes: { valor_centavos: number; data: DataISO }[], meses: Competencia[]) {
  return meses.map((mes) => ({
    mes,
    total: somar(aportes.filter((a) => a.data.slice(0, 7) <= mes.slice(0, 7)).map((a) => a.valor_centavos)),
  }))
}
