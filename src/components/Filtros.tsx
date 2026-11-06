import type { ReactNode } from 'react'

export type Opcao<T extends string> = { valor: T; texto: string }

/**
 * Filtros à vista: cada filtro é uma etiqueta com o nome e a escolha atual,
 * que abre a lista do próprio celular ao tocar. "Limpar" aparece quando algo mudou.
 */
export function LinhaFiltros({
  children,
  mudou,
  onLimpar,
}: {
  children: ReactNode
  /** Algum filtro fora do padrão */
  mudou: boolean
  onLimpar: () => void
}) {
  return (
    <div role="group" aria-label="Filtros" className="flex flex-wrap items-center gap-2">
      {children}
      {mudou && (
        <button
          type="button"
          onClick={onLimpar}
          className="min-h-11 rounded-full px-3 text-sm font-medium text-stone-600 hover:bg-stone-100"
        >
          Limpar
        </button>
      )}
    </div>
  )
}

/** Um filtro: "Conta  Todas ▾". Fica destacado quando não está no padrão. */
export function Filtro<T extends string>({
  rotulo,
  opcoes,
  valor,
  onChange,
  padrao,
}: {
  rotulo: string
  opcoes: Opcao<T>[]
  valor: T
  onChange: (v: T) => void
  /** Valor que não conta como filtro ligado (padrão: a primeira opção) */
  padrao?: T
}) {
  const ligado = valor !== (padrao ?? opcoes[0]?.valor)
  const escolhida = opcoes.find((o) => o.valor === valor)?.texto ?? ''
  // O <select> de verdade cobre a etiqueta inteira (invisível): qualquer toque abre a lista do celular
  return (
    <label
      className={`relative flex min-h-11 max-w-full items-center gap-1.5 rounded-full border pr-8 pl-3.5 text-sm shadow-sm has-[select:focus-visible]:ring-2 has-[select:focus-visible]:ring-marca-600 ${
        ligado ? 'border-marca-600 bg-marca-50 text-marca-900' : 'border-stone-200 bg-superficie text-stone-700'
      }`}
    >
      <span className={ligado ? 'text-marca-700' : 'text-stone-500'}>{rotulo}</span>
      <span aria-hidden className="truncate font-semibold">
        {escolhida}
      </span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value as T)}
        className="absolute inset-0 size-full cursor-pointer appearance-none rounded-full text-base opacity-0"
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-3 size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
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
            className={`min-h-11 rounded-full border px-3.5 text-sm font-medium ${
              o.valor === valor
                ? 'border-marca-600 bg-marca-600 text-white'
                : 'border-stone-200 bg-superficie text-stone-700 hover:bg-stone-50'
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
