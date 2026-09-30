/** Progresso de uma compra parcelada */
import { somar } from './dinheiro.ts'
import { numeroDaParcela, type Competencia } from './datas.ts'
import type { CompraParcelada } from '../types/banco.ts'

type Linha = { valor_centavos: number; pago: boolean; parcela_numero: number | null }

export type ResumoCompra = {
  /** Número da parcela no mês (pode ser < 1 antes de começar ou > total depois de acabar) */
  parcelaDoMes: number
  numParcelas: number
  /** Soma do que cada um paga por mês */
  mensal: number
  /** Quanto vai ser pago ao todo (parcelas já geradas + as que faltam gerar) */
  previsto: number
  pago: number
  restante: number
  /** mensal × parcelas − valor da compra (juros ou arredondamento) */
  diferencaDoTotal: number
  quitada: boolean
  /** O que falta pagar depois deste mês (usado para quitar) */
  saldoDepoisDoMes: number
}

export function resumoCompra(
  compra: Pick<CompraParcelada, 'num_parcelas' | 'primeira_competencia' | 'valor_total_centavos' | 'quitada_em'>,
  valoresMensais: number[],
  linhas: Linha[],
  competencia: Competencia,
): ResumoCompra {
  const parcelaDoMes = numeroDaParcela(compra.primeira_competencia, competencia)
  const mensal = somar(valoresMensais)
  const maiorGerada = Math.max(0, ...linhas.map((l) => l.parcela_numero ?? 0))
  const quitada = compra.quitada_em !== null
  const gerado = somar(linhas.map((l) => l.valor_centavos))
  const previsto = quitada ? gerado : gerado + Math.max(0, compra.num_parcelas - maiorGerada) * mensal
  const pago = somar(linhas.filter((l) => l.pago).map((l) => l.valor_centavos))
  const futurasPagas = somar(
    linhas.filter((l) => l.pago && (l.parcela_numero ?? 0) > parcelaDoMes).map((l) => l.valor_centavos),
  )
  const parcelasDepois = Math.max(0, compra.num_parcelas - Math.max(parcelaDoMes, 0))

  return {
    parcelaDoMes,
    numParcelas: compra.num_parcelas,
    mensal,
    previsto,
    pago,
    restante: previsto - pago,
    diferencaDoTotal: mensal * compra.num_parcelas - compra.valor_total_centavos,
    quitada,
    saldoDepoisDoMes: quitada ? 0 : Math.max(0, parcelasDepois * mensal - futurasPagas),
  }
}

/** Valor sugerido da parcela: total ÷ número de parcelas, arredondado ao centavo */
export function parcelaSugerida(totalCentavos: number, parcelas: number): number {
  if (parcelas < 1 || totalCentavos <= 0) return 0
  return Math.round(totalCentavos / parcelas)
}
