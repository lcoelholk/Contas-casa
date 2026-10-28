import type { ReactNode } from 'react'

/** Ícones de ação em traço (mesmo estilo da barra de baixo). Emoji ficam só para categorias. */
function Icone({ children, className = 'size-6' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

/** Gasto ou entrada (só desta vez) */
export const IconeRecibo = ({ className }: { className?: string }) => (
  <Icone className={className}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" />
  </Icone>
)

/** Todo mês (conta fixa) */
export const IconeRepetir = ({ className }: { className?: string }) => (
  <Icone className={className}>
    <path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4" />
  </Icone>
)

/** Parcelado */
export const IconeCartao = ({ className }: { className?: string }) => (
  <Icone className={className}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20M6 15h4" />
  </Icone>
)

export const IconeGrafico = ({ className }: { className?: string }) => (
  <Icone className={className}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icone>
)
