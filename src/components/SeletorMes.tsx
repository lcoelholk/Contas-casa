import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { nomeDaCompetencia } from '../lib/datas.ts'

/** ‹ Outubro de 2026 › — com "Hoje" para voltar quando estiver em outro mês */
export function SeletorMes() {
  const { competencia, ehMesAtual, anterior, proximo, irParaMesAtual } = useCompetencia()
  const classeSeta =
    'flex size-11 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-stone-600 hover:bg-stone-100 active:bg-stone-200'

  return (
    <div className="flex min-w-0 items-center">
      <button onClick={anterior} aria-label="Mês anterior" className={classeSeta}>
        ‹
      </button>
      <span className="truncate text-base font-semibold first-letter:uppercase" aria-live="polite">
        {nomeDaCompetencia(competencia)}
      </span>
      <button onClick={proximo} aria-label="Próximo mês" className={classeSeta}>
        ›
      </button>
      {!ehMesAtual && (
        <button
          onClick={irParaMesAtual}
          className="min-h-11 shrink-0 rounded-full px-2 text-sm font-semibold text-marca-700 hover:bg-marca-50"
        >
          Hoje
        </button>
      )}
    </div>
  )
}
