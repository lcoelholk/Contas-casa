import { createContext, useContext, useState, type ReactNode } from 'react'
import { useMembroAtual } from './useDados.ts'

/** 'todos' ou o id de um membro */
type Contexto = { pessoa: string; setPessoa: (p: string) => void }

const PessoaContexto = createContext<Contexto | null>(null)

/**
 * De quem são os números nas telas de análise (Início, Transações, Gráficos).
 * Começa em quem entrou; a troca vale para todas as telas até sair do app.
 */
export function PessoaProvider({ children }: { children: ReactNode }) {
  const { membro } = useMembroAtual()
  const [pessoa, setPessoa] = useState(membro?.id ?? 'todos')
  return <PessoaContexto.Provider value={{ pessoa, setPessoa }}>{children}</PessoaContexto.Provider>
}

export function usePessoa() {
  const ctx = useContext(PessoaContexto)
  if (!ctx) throw new Error('usePessoa fora do PessoaProvider')
  return ctx
}
