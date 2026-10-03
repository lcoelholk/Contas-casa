import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/supabase.ts'
import { TABELAS_TEMPO_REAL, chavesAfetadas } from '../lib/tempoReal.ts'

/** Espera as mudanças pararem de chegar (a geração do mês cria várias linhas de uma vez) */
const ESPERA_MS = 400

/**
 * Escuta as mudanças no banco (Supabase Realtime) e recarrega as telas afetadas:
 * o que um lança, o outro vê sem recarregar a página.
 */
export function useTempoReal(ativo: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!ativo) return
    const pendentes = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | undefined
    let jaConectou = false

    const aplicar = () => {
      for (const chave of chavesAfetadas(pendentes)) queryClient.invalidateQueries({ queryKey: [chave] })
      pendentes.clear()
    }

    let canal = db().channel('mudancas')
    for (const table of TABELAS_TEMPO_REAL) {
      canal = canal.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        pendentes.add(table)
        clearTimeout(timer)
        timer = setTimeout(aplicar, ESPERA_MS)
      })
    }
    canal.subscribe((status) => {
      // Ao reconectar (celular voltou do bloqueio, rede caiu), busca tudo de novo
      if (status === 'SUBSCRIBED') {
        if (jaConectou) queryClient.invalidateQueries()
        jaConectou = true
      }
    })

    return () => {
      clearTimeout(timer)
      db().removeChannel(canal)
    }
  }, [ativo, queryClient])
}
