import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/supabase.ts'

/** Quando o código do atalho de quem está logado foi criado e usado pela última vez */
export function useAtalho(membroId: string | undefined) {
  return useQuery({
    queryKey: ['atalho', membroId],
    enabled: Boolean(membroId),
    queryFn: async () => {
      const { data, error } = await db()
        .from('atalhos')
        .select('criado_em, usado_em')
        .eq('membro_id', membroId!)
        .maybeSingle()
      if (error) throw error
      return data as { criado_em: string; usado_em: string | null } | null
    },
  })
}

/** Cria (ou troca) o código. Devolve o código em texto: ele só aparece desta vez */
export function useGerarCodigoAtalho() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await db().rpc('gerar_token_atalho')
      if (error) throw error
      return data as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['atalho'] }),
  })
}
