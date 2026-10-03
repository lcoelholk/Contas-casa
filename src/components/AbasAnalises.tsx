import { NavLink } from 'react-router-dom'

/** Alterna entre Gráficos e Metas (as duas telas de Análises) */
export function AbasAnalises() {
  const classe = ({ isActive }: { isActive: boolean }) =>
    `flex-1 rounded-lg py-2 text-center text-sm font-medium ${isActive ? 'bg-superficie text-stone-900 shadow-sm dark:bg-stone-300' : 'text-stone-600'}`
  return (
    <nav aria-label="Análises" className="flex gap-1 rounded-xl bg-stone-100 p-1">
      <NavLink to="/graficos" className={classe}>
        Gráficos
      </NavLink>
      <NavLink to="/metas" className={classe}>
        Metas e limites
      </NavLink>
    </nav>
  )
}
