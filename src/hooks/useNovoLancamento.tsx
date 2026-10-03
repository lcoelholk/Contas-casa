import { createContext, useContext } from 'react'
import type { TipoNovo } from '../components/NovoLancamento.tsx'

/** Abre o "novo lançamento" global (o + da barra de baixo) de qualquer tela */
export const NovoLancamentoContexto = createContext<(tipo?: TipoNovo) => void>(() => {})

export function useNovoLancamento() {
  return useContext(NovoLancamentoContexto)
}
