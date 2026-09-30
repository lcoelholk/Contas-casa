import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/supabase.ts'
import { useAuth } from '../lib/auth.tsx'
import type { Partes } from '../lib/divisao.ts'
import type { Competencia } from '../lib/datas.ts'
import type { CompraDivisao, CompraParcelada, LinhaDeCompra } from '../types/banco.ts'

export type DadosCompras = { compras: CompraParcelada[]; divisoes: CompraDivisao[]; linhas: LinhaDeCompra[] }

/** Compras parceladas, valor mensal de cada um e todas as parcelas já geradas */
export function useCompras() {
  const { sessao } = useAuth()
  return useQuery({
    queryKey: ['compras'],
    enabled: Boolean(sessao),
    queryFn: async (): Promise<DadosCompras> => {
      const cliente = db()
      const [c, d, l] = await Promise.all([
        cliente
          .from('compras_parceladas')
          .select(
            'id, conta_id, descricao, categoria_id, valor_total_centavos, num_parcelas, primeira_competencia, dia_vencimento, quitada_em',
          )
          .order('criado_em'),
        cliente.from('compra_divisoes').select('id, compra_id, membro_id, valor_mensal_centavos'),
        cliente
          .from('lancamentos')
          .select('id, compra_id, membro_id, valor_centavos, pago, parcela_numero, competencia')
          .not('compra_id', 'is', null),
      ])
      if (c.error) throw c.error
      if (d.error) throw d.error
      if (l.error) throw l.error
      return {
        compras: c.data as CompraParcelada[],
        divisoes: d.data as CompraDivisao[],
        linhas: l.data as LinhaDeCompra[],
      }
    },
  })
}

function useInvalidar() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['compras'] }),
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] }),
    ])
}

const erroDoBanco = (erro: { message: string }) => new Error(erro.message)

export type DadosCompra = {
  descricao: string
  categoria_id: string | null
  dia_vencimento: number | null
  /** Valor por mês de cada membro */
  partes: Partes
}

export function useCriarCompra() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (
      a: DadosCompra & { conta_id: string; valor_total: number; parcelas: number; primeira: Competencia },
    ) => {
      const { error } = await db().rpc('criar_compra', {
        p_conta: a.conta_id,
        p_descricao: a.descricao,
        p_categoria: a.categoria_id,
        p_total: a.valor_total,
        p_parcelas: a.parcelas,
        p_primeira: a.primeira,
        p_dia: a.dia_vencimento,
        p_partes: a.partes,
      })
      if (error) throw erroDoBanco(error)
    },
    onSuccess: invalidar,
  })
}

/** Muda deste mês em diante (parcelas pagas e meses anteriores não mudam) */
export function useAlterarCompra() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (a: DadosCompra & { id: string; desde: Competencia }) => {
      const { error } = await db().rpc('alterar_compra', {
        p_id: a.id,
        p_desde: a.desde,
        p_descricao: a.descricao,
        p_categoria: a.categoria_id,
        p_dia: a.dia_vencimento,
        p_partes: a.partes,
      })
      if (error) throw erroDoBanco(error)
    },
    onSuccess: invalidar,
  })
}

export function useQuitarCompra() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (a: { id: string; mes: Competencia; lancarSaldo: boolean }) => {
      const { error } = await db().rpc('quitar_compra', { p_id: a.id, p_mes: a.mes, p_lancar_saldo: a.lancarSaldo })
      if (error) throw erroDoBanco(error)
    },
    onSuccess: invalidar,
  })
}

export function useExcluirCompra() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().rpc('excluir_compra', { p_id: id })
      if (error) throw erroDoBanco(error)
    },
    onSuccess: invalidar,
  })
}
