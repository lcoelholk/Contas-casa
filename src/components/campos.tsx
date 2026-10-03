import type { ReactNode } from 'react'
import type { Categoria, TipoMovimento } from '../types/banco.ts'

export const classeInput =
  'h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base outline-none focus:border-marca-600 focus:ring-2 focus:ring-marca-100'

export function Campo({ rotulo, children, dica }: { rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-stone-700">{rotulo}</span>
      {children}
      {dica && <span className="text-xs text-stone-500">{dica}</span>}
    </label>
  )
}

/** Campo de valor em reais (texto livre: "12,50", "1.200"...) */
export function CampoValor({
  valor,
  onChange,
  ariaLabel,
  autoFocus,
}: {
  valor: string
  onChange: (texto: string) => void
  ariaLabel?: string
  autoFocus?: boolean
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone-500">R$</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        value={valor}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        className={`${classeInput} pl-10 tabular-nums`}
      />
    </div>
  )
}

export function SeletorCategoria({
  categorias,
  tipo,
  valor,
  onChange,
}: {
  categorias: Categoria[]
  tipo: TipoMovimento
  valor: string
  onChange: (id: string) => void
}) {
  return (
    <select value={valor} onChange={(e) => onChange(e.target.value)} className={classeInput}>
      <option value="">Sem categoria</option>
      {categorias
        // Arquivada só aparece se já estiver escolhida (lançamento antigo)
        .filter((c) => c.tipo === tipo && (!c.arquivada || c.id === valor))
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.icone ? `${c.icone} ` : ''}
            {c.nome}
          </option>
        ))}
    </select>
  )
}

/** Botões lado a lado para escolher uma opção */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
}: {
  opcoes: { valor: T; texto: string }[]
  valor: T
  onChange: (v: T) => void
  rotulo: string
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-1 rounded-xl bg-stone-100 p-1">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors ${
            valor === o.valor ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
          }`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}

export function Caixa({
  marcado,
  onChange,
  children,
}: {
  marcado: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 rounded accent-marca-600"
      />
      {children}
    </label>
  )
}

export function ErroFormulario({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
      {mensagem}
    </p>
  )
}

/** Botões de salvar/excluir no pé do formulário */
export function BotoesFormulario({
  salvando,
  textoSalvar = 'Salvar',
  onExcluir,
  excluindo,
  confirmandoExclusao,
}: {
  salvando: boolean
  textoSalvar?: string
  onExcluir?: () => void
  excluindo?: boolean
  confirmandoExclusao?: boolean
}) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      <button
        type="submit"
        disabled={salvando}
        className="h-12 rounded-xl bg-marca-600 font-semibold text-white shadow-sm active:scale-[0.99] disabled:opacity-50"
      >
        {salvando ? 'Salvando…' : textoSalvar}
      </button>
      {onExcluir && (
        <button
          type="button"
          onClick={onExcluir}
          disabled={excluindo}
          className={`h-11 rounded-xl font-medium ${
            confirmandoExclusao ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'
          } disabled:opacity-50`}
        >
          {excluindo ? 'Excluindo…' : confirmandoExclusao ? 'Toque de novo para excluir' : 'Excluir'}
        </button>
      )}
    </div>
  )
}

/** Bolinhas de cor para escolher (abas e pessoas) */
export function SeletorCor({
  cores,
  valor,
  onChange,
}: {
  cores: readonly string[]
  valor: string
  onChange: (cor: string) => void
}) {
  return (
    <div role="radiogroup" aria-label="Cor" className="flex flex-wrap gap-2">
      {cores.map((cor) => (
        <button
          key={cor}
          type="button"
          role="radio"
          aria-checked={valor === cor}
          aria-label={cor}
          onClick={() => onChange(cor)}
          className={`size-10 rounded-full border-4 transition-transform ${
            valor === cor ? 'scale-110 border-stone-900' : 'border-white shadow-sm'
          }`}
          style={{ backgroundColor: cor }}
        />
      ))}
    </div>
  )
}
