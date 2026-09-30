import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { nomeDaCompetencia } from '../lib/datas.ts'

export function SeletorMes() {
  const { competencia, ehMesAtual, anterior, proximo, irParaMesAtual } = useCompetencia()

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        onClick={anterior}
        aria-label="Mês anterior"
        className="flex size-10 items-center justify-center rounded-full text-xl text-stone-600 hover:bg-stone-100 active:bg-stone-200"
      >
        ‹
      </button>

      <div className="flex flex-col items-center">
        <span className="text-base font-semibold first-letter:uppercase" aria-live="polite">
          {nomeDaCompetencia(competencia)}
        </span>
        {!ehMesAtual && (
          <button onClick={irParaMesAtual} className="text-xs font-medium text-marca-700">
            Voltar para o mês atual
          </button>
        )}
      </div>

      <button
        onClick={proximo}
        aria-label="Próximo mês"
        className="flex size-10 items-center justify-center rounded-full text-xl text-stone-600 hover:bg-stone-100 active:bg-stone-200"
      >
        ›
      </button>
    </div>
  )
}
