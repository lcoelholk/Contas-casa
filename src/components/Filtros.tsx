import { useState, type ReactNode } from 'react'
import { Folha } from './Folha.tsx'

/** Um filtro ligado, mostrado como etiqueta com ✕ */
export type FiltroAtivo = { chave: string; texto: string; onRemover: () => void }

export type Opcao<T extends string> = { valor: T; texto: string }

/**
 * Botões "Filtrar" e "Ordenar" (os filtros só aparecem quando a pessoa pede)
 * e, abaixo, as etiquetas dos filtros ligados, cada uma com ✕ para tirar.
 */
export function BarraFiltros({
  ativos,
  painel,
  ordenar,
  onLimpar,
}: {
  ativos: FiltroAtivo[]
  /** Conteúdo do painel de filtros (opções de cada filtro) */
  painel: ReactNode
  /** Ordenação: opções e a escolhida (omita se a tela não ordena) */
  ordenar?: { opcoes: Opcao<string>[]; valor: string; onChange: (v: string) => void }
  onLimpar: () => void
}) {
  const [aberto, setAberto] = useState<'filtros' | 'ordem' | null>(null)
  const ordemAtual = ordenar?.opcoes.find((o) => o.valor === ordenar.valor)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <BotaoBarra onClick={() => setAberto('filtros')} ativo={ativos.length > 0}>
          <IconeFiltro />
          Filtrar
          {ativos.length > 0 && (
            <span className="rounded-full bg-marca-600 px-1.5 text-xs leading-5 text-white">{ativos.length}</span>
          )}
        </BotaoBarra>
        {ordenar && (
          <BotaoBarra onClick={() => setAberto('ordem')}>
            <IconeOrdem />
            <span className="truncate">{ordemAtual?.texto ?? 'Ordenar'}</span>
          </BotaoBarra>
        )}
      </div>

      {ativos.length > 0 && (
        <ul aria-label="Filtros ligados" className="flex flex-wrap gap-1.5">
          {ativos.map((f) => (
            <li key={f.chave}>
              <button
                type="button"
                onClick={f.onRemover}
                aria-label={`Tirar filtro ${f.texto}`}
                className="flex items-center gap-1 rounded-full bg-marca-50 py-1 pr-2 pl-3 text-sm font-medium text-marca-900 hover:bg-marca-100"
              >
                {f.texto}
                <span aria-hidden className="text-marca-700">
                  ✕
                </span>
              </button>
            </li>
          ))}
          {ativos.length > 1 && (
            <li>
              <button
                type="button"
                onClick={onLimpar}
                className="rounded-full px-3 py-1 text-sm font-medium text-stone-500 hover:bg-stone-100"
              >
                Limpar tudo
              </button>
            </li>
          )}
        </ul>
      )}

      <Folha aberta={aberto === 'filtros'} onFechar={() => setAberto(null)} titulo="Filtrar">
        <div className="flex flex-col gap-5">{painel}</div>
        <div className="sticky bottom-0 mt-5 flex gap-2 bg-white pt-2">
          <button
            type="button"
            onClick={onLimpar}
            disabled={ativos.length === 0}
            className="h-12 flex-1 rounded-xl font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-40"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={() => setAberto(null)}
            className="h-12 flex-[2] rounded-xl bg-marca-600 font-semibold text-white"
          >
            Ver resultado
          </button>
        </div>
      </Folha>

      {ordenar && (
        <Folha aberta={aberto === 'ordem'} onFechar={() => setAberto(null)} titulo="Ordenar por">
          <ul role="radiogroup" aria-label="Ordenar por" className="flex flex-col gap-1">
            {ordenar.opcoes.map((o) => (
              <li key={o.valor}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={o.valor === ordenar.valor}
                  onClick={() => {
                    ordenar.onChange(o.valor)
                    setAberto(null)
                  }}
                  className="flex h-12 w-full items-center justify-between rounded-xl px-3 text-left hover:bg-stone-50"
                >
                  <span className={o.valor === ordenar.valor ? 'font-semibold' : ''}>{o.texto}</span>
                  {o.valor === ordenar.valor && (
                    <span aria-hidden className="font-bold text-marca-700">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Folha>
      )}
    </div>
  )
}

function BotaoBarra({ onClick, ativo, children }: { onClick: () => void; ativo?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 min-w-0 items-center gap-2 rounded-full border px-4 text-sm font-medium shadow-sm ${
        ativo ? 'border-marca-600 bg-white text-marca-700' : 'border-stone-200 bg-white text-stone-700'
      }`}
    >
      {children}
    </button>
  )
}

/** Uma escolha dentro do painel de filtros: etiquetas tocáveis (uma só marcada) */
export function EscolhaFiltro<T extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
}: {
  rotulo: string
  opcoes: Opcao<T>[]
  valor: T
  onChange: (v: T) => void
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-stone-700">{rotulo}</legend>
      <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={o.valor === valor}
            onClick={() => onChange(o.valor)}
            className={`min-h-10 rounded-full border px-3.5 text-sm font-medium ${
              o.valor === valor
                ? 'border-marca-600 bg-marca-600 text-white'
                : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

const svg = (d: ReactNode) => (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    className="size-4 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d}
  </svg>
)
const IconeFiltro = () => svg(<path d="M3 5h18l-7 8v6l-4-2v-4z" />)
const IconeOrdem = () => svg(<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />)
