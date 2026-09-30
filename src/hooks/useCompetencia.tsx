import { createContext, useContext, useState, type ReactNode } from 'react'
import { competenciaAtual, somarMeses, type Competencia } from '../lib/datas.ts'

type EstadoCompetencia = {
  /** Mês selecionado, sempre "AAAA-MM-01" */
  competencia: Competencia
  ehMesAtual: boolean
  anterior: () => void
  proximo: () => void
  irParaMesAtual: () => void
}

const CompetenciaContext = createContext<EstadoCompetencia | null>(null)

/** Guarda o mês selecionado; ele se mantém ao trocar de aba */
export function CompetenciaProvider({ children }: { children: ReactNode }) {
  const [competencia, setCompetencia] = useState<Competencia>(() => competenciaAtual())
  const atual = competenciaAtual()

  const valor: EstadoCompetencia = {
    competencia,
    ehMesAtual: competencia === atual,
    anterior: () => setCompetencia((c) => somarMeses(c, -1)),
    proximo: () => setCompetencia((c) => somarMeses(c, 1)),
    irParaMesAtual: () => setCompetencia(competenciaAtual()),
  }

  return <CompetenciaContext.Provider value={valor}>{children}</CompetenciaContext.Provider>
}

export function useCompetencia(): EstadoCompetencia {
  const ctx = useContext(CompetenciaContext)
  if (!ctx) throw new Error('useCompetencia precisa estar dentro de <CompetenciaProvider>')
  return ctx
}
