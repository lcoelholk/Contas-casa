/**
 * Tipos das tabelas do banco (espelham supabase/migrations).
 * Datas vêm como texto "AAAA-MM-DD"; valores em centavos (inteiro).
 */

export type Membro = {
  id: string
  user_id: string | null
  nome: string
  cor: string | null
}

export type TipoConta = 'pessoal' | 'compartilhada'

export type Conta = {
  id: string
  nome: string
  tipo: TipoConta
  dono_id: string | null
  cor: string | null
  ordem: number
  arquivada: boolean
}

export type TipoMovimento = 'saida' | 'entrada'

export type Categoria = {
  id: string
  nome: string
  tipo: TipoMovimento
  icone: string | null
  arquivada: boolean
}

export type OrigemLancamento = 'avulso' | 'recorrente' | 'parcela'

export type Lancamento = {
  id: string
  conta_id: string
  membro_id: string
  tipo: TipoMovimento
  descricao: string
  valor_centavos: number
  categoria_id: string | null
  competencia: string
  vencimento: string | null
  pago: boolean
  pago_em: string | null
  origem: OrigemLancamento
  recorrente_id: string | null
  compra_id: string | null
  parcela_numero: number | null
  grupo_id: string | null
  editado_manualmente: boolean
  observacao: string | null
  criado_por: string | null
  criado_em: string
}

export type Recorrente = {
  id: string
  conta_id: string
  tipo: TipoMovimento
  descricao: string
  categoria_id: string | null
  dia_vencimento: number | null
  /** 1º dia do mês de início */
  inicio: string
  /** Último mês em que aparece (null = sem fim) */
  fim: string | null
}

export type RecorrenteDivisao = {
  id: string
  recorrente_id: string
  membro_id: string
  valor_centavos: number
  vigente_desde: string
}

export type CompraParcelada = {
  id: string
  conta_id: string
  descricao: string
  categoria_id: string | null
  valor_total_centavos: number
  num_parcelas: number
  primeira_competencia: string
  dia_vencimento: number | null
  /** Mês em que foi quitada (null = segue normal) */
  quitada_em: string | null
}

export type CompraDivisao = {
  id: string
  compra_id: string
  membro_id: string
  valor_mensal_centavos: number
}

/** Parcela já gerada (qualquer mês), para calcular o progresso */
export type LinhaDeCompra = Pick<
  Lancamento,
  'id' | 'compra_id' | 'membro_id' | 'valor_centavos' | 'pago' | 'parcela_numero' | 'competencia'
>
