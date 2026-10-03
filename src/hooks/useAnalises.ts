import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/supabase.ts'
import { useAuth } from '../lib/auth.tsx'
import type { Competencia } from '../lib/datas.ts'
import type { LinhaAnalise } from '../lib/analises.ts'
import type { Meta, MetaAporte, Orcamento } from '../types/banco.ts'

/**
 * Lançamentos de vários meses, para os gráficos.
 * Antes, gera as contas fixas e parcelas do período (não duplica).
 */
export function useLancamentosPeriodo(de: Competencia, ate: Competencia) {
  const { sessao } = useAuth()
  return useQuery({
    queryKey: ['lancamentos', 'periodo', de, ate],
    enabled: Boolean(sessao),
    placeholderData: (anterior) => anterior,
    queryFn: async (): Promise<LinhaAnalise[]> => {
      const cliente = db()
      const gerado = await cliente.rpc('gerar_periodo', { p_de: de, p_ate: ate })
      if (gerado.error) throw gerado.error
      const { data, error } = await cliente
        .from('lancamentos')
        .select('conta_id, membro_id, tipo, valor_centavos, categoria_id, competencia, origem, pago')
        .gte('competencia', de)
        .lte('competencia', ate)
      if (error) throw error
      return data as LinhaAnalise[]
    },
  })
}

export function useOrcamentos() {
  const { sessao } = useAuth()
  return useQuery({
    queryKey: ['orcamentos'],
    enabled: Boolean(sessao),
    queryFn: async (): Promise<Orcamento[]> => {
      const { data, error } = await db().from('orcamentos').select('id, categoria_id, membro_id, valor_centavos')
      if (error) throw error
      return data as Orcamento[]
    },
  })
}

export function useMetas() {
  const { sessao } = useAuth()
  return useQuery({
    queryKey: ['metas'],
    enabled: Boolean(sessao),
    queryFn: async (): Promise<{ metas: Meta[]; aportes: MetaAporte[] }> => {
      const cliente = db()
      const [metas, aportes] = await Promise.all([
        cliente.from('metas').select('*').order('criado_em'),
        cliente.from('meta_aportes').select('id, meta_id, membro_id, valor_centavos, data, observacao').order('data'),
      ])
      if (metas.error) throw metas.error
      if (aportes.error) throw aportes.error
      return { metas: metas.data as Meta[], aportes: aportes.data as MetaAporte[] }
    },
  })
}

function useMutacao<T>(chave: string, fn: (dados: T) => Promise<void>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: [chave] }),
  })
}

async function checar(consulta: PromiseLike<{ error: unknown }>) {
  const { error } = await consulta
  if (error) throw error
}

export function useSalvarOrcamento() {
  return useMutacao('orcamentos', ({ id, ...campos }: Partial<Orcamento> & Omit<Orcamento, 'id'>) =>
    checar(id ? db().from('orcamentos').update(campos).eq('id', id) : db().from('orcamentos').insert(campos)),
  )
}

export function useExcluirOrcamento() {
  return useMutacao('orcamentos', (id: string) => checar(db().from('orcamentos').delete().eq('id', id)))
}

export type DadosMeta = Pick<Meta, 'nome' | 'membro_id' | 'valor_alvo_centavos' | 'prazo' | 'cor'>

export function useSalvarMeta() {
  return useMutacao('metas', ({ id, ...campos }: DadosMeta & { id?: string }) =>
    checar(id ? db().from('metas').update(campos).eq('id', id) : db().from('metas').insert(campos)),
  )
}

export function useArquivarMeta() {
  return useMutacao('metas', ({ id, arquivada }: { id: string; arquivada: boolean }) =>
    checar(db().from('metas').update({ arquivada }).eq('id', id)),
  )
}

/** Exclui a meta e os aportes dela */
export function useExcluirMeta() {
  return useMutacao('metas', (id: string) => checar(db().from('metas').delete().eq('id', id)))
}

export function useNovoAporte() {
  return useMutacao('metas', (aporte: Omit<MetaAporte, 'id'>) => checar(db().from('meta_aportes').insert(aporte)))
}

export function useExcluirAporte() {
  return useMutacao('metas', (id: string) => checar(db().from('meta_aportes').delete().eq('id', id)))
}
