import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Painel que sobe de baixo no celular (e aparece centralizado no computador) */
export function Folha({
  aberta,
  titulo,
  onFechar,
  children,
}: {
  aberta: boolean
  titulo: string
  onFechar: () => void
  children: ReactNode
}) {
  const idTitulo = useId()

  useEffect(() => {
    if (!aberta) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar()
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', aoTeclar)
    return () => {
      document.body.style.overflow = overflowAnterior
      window.removeEventListener('keydown', aoTeclar)
    }
  }, [aberta, onFechar])

  if (!aberta) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-superficie shadow-xl sm:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h2 id={idTitulo} className="text-base font-semibold">
            {titulo}
          </h2>
          <button
            onClick={onFechar}
            className="-mr-2 rounded-lg px-2 py-1 text-sm font-medium text-stone-500 hover:bg-stone-100"
          >
            Fechar
          </button>
        </div>
        <div className="overflow-y-auto px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
