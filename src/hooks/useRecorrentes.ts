import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/supabase.ts'
import { useAuth } from '../lib/auth.tsx'
import { planejarEdicaoGrupo, type Partes } from '../lib/divisao.ts'
import type { Competencia } from '../lib/datas.ts'
import type { Lancamento, Recorrente, RecorrenteDivisao, TipoMovimento } from '../types/banco.ts'

export type DadosRecorrentes = { recorrentes: Recorrente[]; divisoes: RecorrenteDivisao[] }

/** Contas fixas e o histórico de divisões de cada uma */
export function useRecorrentes() {
  const { sessao } = useAuth()
  return useQuery({
    queryKey: ['recorrentes'],
    enabled: Boolean(sessao),
    queryFn: async (): Promise<DadosRecorrentes> => {
      const cliente = db()
      const [r, d] = await Promise.all([
        cliente
          .from('recorrentes')
          .select('id, conta_id, tipo, descricao, categoria_id, dia_vencimento, inicio, fim')
          .order('criado_em'),
        cliente.from('recorrente_divisoes').select('id, recorrente_id, membro_id, valor_centavos, vigente_desde'),
      ])
      if (r.error) throw r.error
      if (d.error) throw d.error
      return { recorrentes: r.data as Recorrente[], divisoes: d.data as RecorrenteDivisao[] }
    },
  })
}

function useInvalidar() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['recorrentes'] }),
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] }),
    ])
}

/** Erro do banco com a mensagem que a função escreveu (ex.: "Use Encerrar...") */
function erroDoBanco(erro: { message: string }) {
  return new Error(erro.message)
}

export type DadosRecorrente = {
  descricao: string
  categoria_id: string | null
  dia_vencimento: number | null
  partes: Partes
}

export function useCriarRecorrente() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (
      a: DadosRecorrente & { conta_id: string; tipo: TipoMovimento; inicio: Competencia; fim: Competencia | null },
    ) => {
      const { data: id, error } = await db().rpc('criar_recorrente', {
        p_conta: a.conta_id,
        p_tipo: a.tipo,
        p_descricao: a.descricao,
        p_categoria: a.categoria_id,
        p_dia: a.dia_vencimento,
        p_inicio: a.inicio,
        p_partes: a.partes,
      })
      if (error) throw erroDoBanco(error)
      // Com data limite: o último mês em que aparece
      if (a.fim) {
        const fim = await db().rpc('encerrar_recorrente', { p_id: id as string, p_ultimo_mes: a.fim })
        if (fim.error) throw erroDoBanco(fim.error)
      }
    },
    onSuccess: invalidar,
  })
}

/** Muda a conta fixa deste mês em diante (meses anteriores e partes pagas não mudam) */
export function useAlterarRecorrente() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (a: DadosRecorrente & { id: string; desde: Competencia }) => {
      const { error } = await db().rpc('alterar_recorrente', {
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

/**
 * Muda só os valores deste mês (ex.: a luz veio mais cara).
 * As linhas ficam marcadas como editadas à mão e não são sobrescritas depois.
 */
export function useEditarMesRecorrente() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ linhas, partes }: { linhas: Lancamento[]; partes: Partes }) => {
      const cliente = db()
      const plano = planejarEdicaoGrupo(linhas, partes)
      const base = linhas[0]

      for (const a of plano.atualizar) {
        const { error } = await cliente
          .from('lancamentos')
          .update({ valor_centavos: a.valor, editado_manualmente: true })
          .eq('id', a.id)
        if (error) throw error
      }
      if (plano.inserir.length > 0) {
        const { error } = await cliente.from('lancamentos').insert(
          plano.inserir.map((i) => ({
            conta_id: base.conta_id,
            membro_id: i.membro_id,
            tipo: base.tipo,
            descricao: base.descricao,
            valor_centavos: i.valor,
            categoria_id: base.categoria_id,
            competencia: base.competencia,
            vencimento: base.vencimento,
            origem: 'recorrente',
            recorrente_id: base.recorrente_id,
            editado_manualmente: true,
          })),
        )
        if (error) throw error
      }
      if (plano.excluir.length > 0) {
        const { error } = await cliente.from('lancamentos').delete().in('id', plano.excluir)
        if (error) throw error
      }
    },
    onSuccess: invalidar,
  })
}

/** Encerra: `ultimoMes` é o último mês em que a conta aparece */
export function useEncerrarRecorrente() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ id, ultimoMes }: { id: string; ultimoMes: Competencia }) => {
      const { error } = await db().rpc('encerrar_recorrente', { p_id: id, p_ultimo_mes: ultimoMes })
      if (error) throw erroDoBanco(error)
    },
    onSuccess: invalidar,
  })
}

export function useExcluirRecorrente() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().rpc('excluir_recorrente', { p_id: id })
      if (error) throw erroDoBanco(error)
    },
    onSuccess: invalidar,
  })
}

/**
 * Muda a data limite de uma conta fixa: um mês (último em que aparece) ou null (sem limite).
 * Encurtar remove os meses seguintes ainda não pagos; tirar o limite volta a gerar os meses.
 */
export function useDefinirFimRecorrente() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ id, fim }: { id: string; fim: Competencia | null }) => {
      const { error } = fim
        ? await db().rpc('encerrar_recorrente', { p_id: id, p_ultimo_mes: fim })
        : await db().from('recorrentes').update({ fim: null }).eq('id', id)
      if (error) throw erroDoBanco(error)
    },
    onSuccess: invalidar,
  })
}
