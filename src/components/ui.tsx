export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-stone-500" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-stone-300 border-t-marca-600" />
      {texto}
    </div>
  )
}

export function Bolinha({ cor, className = '' }: { cor: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-2.5 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: cor ?? 'var(--color-stone-400)' }}
    />
  )
}

export function Aviso({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-semibold">{titulo}</p>
      {children && <div className="mt-1 text-red-800">{children}</div>}
    </div>
  )
}
