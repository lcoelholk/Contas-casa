import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/supabase.ts'
import { useAuth } from '../lib/auth.tsx'
import { hoje, type Competencia } from '../lib/datas.ts'
import { planejarEdicaoGrupo, type Partes } from '../lib/divisao.ts'
import type { Categoria, Lancamento, TipoMovimento } from '../types/banco.ts'

const CHAVE = 'lancamentos'

/** Todos os lançamentos do mês (dos dois membros; cada tela filtra o que precisa) */
export function useLancamentos(competencia: Competencia) {
  const { sessao } = useAuth()
  return useQuery({
    queryKey: [CHAVE, competencia],
    enabled: Boolean(sessao),
    queryFn: async (): Promise<Lancamento[]> => {
      const cliente = db()
      // Cria no mês as contas fixas e parcelas que ainda não existem (não duplica)
      const gerado = await cliente.rpc('gerar_competencia', { p_mes: competencia })
      if (gerado.error && !funcaoAusente(gerado.error)) throw gerado.error

      const { data, error } = await cliente
        .from('lancamentos')
        .select('*')
        .eq('competencia', competencia)
        .order('criado_em')
      if (error) throw error
      return data as Lancamento[]
    },
  })
}

/** A migration 0004 ainda não foi rodada: o app segue funcionando sem a geração automática */
function funcaoAusente(erro: { code?: string; message?: string }) {
  return erro.code === 'PGRST202' || /could not find the function/i.test(erro.message ?? '')
}

export function useCategorias() {
  const { sessao } = useAuth()
  return useQuery({
    queryKey: ['categorias'],
    enabled: Boolean(sessao),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await db()
        .from('categorias')
        .select('id, nome, tipo, icone, arquivada')
        .eq('arquivada', false)
        .order('nome')
      if (error) throw error
      return data as Categoria[]
    },
  })
}

/** Campos comuns preenchidos no formulário */
export type DadosComuns = {
  descricao: string
  categoria_id: string | null
  vencimento: string | null
  observacao: string | null
}

export type NovoLancamentoPessoal = DadosComuns & {
  conta_id: string
  membro_id: string
  tipo: TipoMovimento
  valor_centavos: number
  competencia: Competencia
  pago: boolean
}

export type NovoGastoCompartilhado = DadosComuns & {
  conta_id: string
  competencia: Competencia
  partes: Partes
  /** Membros que já pagaram a própria parte */
  pagos: string[]
}

function useInvalidar() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [CHAVE] })
}

/** Gasto ou entrada numa conta pessoal */
export function useCriarLancamentoPessoal(criadoPor: string | undefined) {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (novo: NovoLancamentoPessoal) => {
      const { error } = await db()
        .from('lancamentos')
        .insert({
          ...novo,
          pago_em: novo.pago ? hoje() : null,
          origem: 'avulso',
          criado_por: criadoPor ?? null,
        })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

export function useEditarLancamentoPessoal() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({ id, ...campos }: Partial<NovoLancamentoPessoal> & { id: string }) => {
      const extra = campos.pago === undefined ? {} : { pago_em: campos.pago ? hoje() : null }
      const { error } = await db()
        .from('lancamentos')
        .update({ ...campos, ...extra })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

/** Gasto dividido: cria uma linha por membro com valor > 0, ligadas pelo grupo_id */
export function useCriarGastoCompartilhado(criadoPor: string | undefined) {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (novo: NovoGastoCompartilhado) => {
      const grupoId = crypto.randomUUID()
      const linhas = Object.entries(novo.partes)
        .filter(([, valor]) => valor > 0)
        .map(([membroId, valor]) => {
          const pago = novo.pagos.includes(membroId)
          return {
            conta_id: novo.conta_id,
            membro_id: membroId,
            tipo: 'saida' as const,
            descricao: novo.descricao,
            valor_centavos: valor,
            categoria_id: novo.categoria_id,
            competencia: novo.competencia,
            vencimento: novo.vencimento,
            observacao: novo.observacao,
            pago,
            pago_em: pago ? hoje() : null,
            origem: 'avulso' as const,
            grupo_id: grupoId,
            criado_por: criadoPor ?? null,
          }
        })
      if (linhas.length === 0) throw new Error('Informe o valor de pelo menos uma pessoa.')
      const { error } = await db().from('lancamentos').insert(linhas)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

/** Edita um gasto dividido já salvo, mantendo quem já pagou */
export function useEditarGastoCompartilhado(criadoPor: string | undefined) {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async ({
      linhas,
      dados,
    }: {
      linhas: Lancamento[]
      dados: Omit<NovoGastoCompartilhado, 'pagos'>
    }) => {
      const cliente = db()
      const plano = planejarEdicaoGrupo(linhas, dados.partes)
      const comuns = {
        descricao: dados.descricao,
        categoria_id: dados.categoria_id,
        vencimento: dados.vencimento,
        observacao: dados.observacao,
      }
      const base = linhas[0]

      for (const a of plano.atualizar) {
        const { error } = await cliente
          .from('lancamentos')
          .update({ ...comuns, valor_centavos: a.valor })
          .eq('id', a.id)
        if (error) throw error
      }
      if (plano.inserir.length > 0) {
        const { error } = await cliente.from('lancamentos').insert(
          plano.inserir.map((i) => ({
            ...comuns,
            conta_id: base.conta_id,
            membro_id: i.membro_id,
            tipo: 'saida',
            valor_centavos: i.valor,
            competencia: base.competencia,
            origem: 'avulso',
            grupo_id: base.grupo_id ?? base.id,
            criado_por: criadoPor ?? null,
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

export function useExcluirLancamentos() {
  const invalidar = useInvalidar()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await db().from('lancamentos').delete().in('id', ids)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

/** Marca/desmarca como pago, atualizando a tela na hora (antes da resposta do servidor) */
export function useAlternarPago(competencia: Competencia) {
  const queryClient = useQueryClient()
  const chave = [CHAVE, competencia]

  return useMutation({
    mutationFn: async ({ id, pago }: { id: string; pago: boolean }) => {
      const { error } = await db()
        .from('lancamentos')
        .update({ pago, pago_em: pago ? hoje() : null })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, pago }) => {
      await queryClient.cancelQueries({ queryKey: chave })
      const anterior = queryClient.getQueryData<Lancamento[]>(chave)
      queryClient.setQueryData<Lancamento[]>(chave, (ls) =>
        ls?.map((l) => (l.id === id ? { ...l, pago, pago_em: pago ? hoje() : null } : l)),
      )
      return { anterior }
    },
    onError: (_erro, _vars, contexto) => {
      if (contexto?.anterior) queryClient.setQueryData(chave, contexto.anterior)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: chave })
      queryClient.invalidateQueries({ queryKey: ['compras'] }) // progresso das parcelas
    },
  })
}
