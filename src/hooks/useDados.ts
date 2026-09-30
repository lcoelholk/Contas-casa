import { useQuery } from '@tanstack/react-query'
import { db } from '../lib/supabase.ts'
import { useAuth } from '../lib/auth.tsx'
import type { Conta, Membro } from '../types/banco.ts'

/** Os membros do casal (Lucas e Emillia) */
export function useMembros() {
  const { sessao } = useAuth()
  return useQuery({
    queryKey: ['membros'],
    enabled: Boolean(sessao),
    queryFn: async (): Promise<Membro[]> => {
      const { data, error } = await db()
        .from('membros')
        .select('id, user_id, nome, cor')
        .order('criado_em')
      if (error) throw error
      return data as Membro[]
    },
  })
}

/**
 * O membro ligado ao login atual.
 * `membro` fica null quando a pessoa está logada mas não está na tabela `membros`.
 */
export function useMembroAtual() {
  const { sessao } = useAuth()
  const consulta = useMembros()
  const membro = consulta.data?.find((m) => m.user_id === sessao?.user.id) ?? null
  return { ...consulta, membro }
}

/** As abas (contas) ativas, na ordem definida */
export function useContas() {
  const { sessao } = useAuth()
  return useQuery({
    queryKey: ['contas'],
    enabled: Boolean(sessao),
    queryFn: async (): Promise<Conta[]> => {
      const { data, error } = await db()
        .from('contas')
        .select('id, nome, tipo, dono_id, cor, ordem, arquivada')
        .eq('arquivada', false)
        .order('ordem')
        .order('criado_em')
      if (error) throw error
      return data as Conta[]
    },
  })
}
