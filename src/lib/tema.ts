/**
 * Tema claro/escuro. Padrão: segue o celular (automático).
 * A escolha fica guardada no aparelho (cada celular pode ter a sua).
 * O index.html aplica o tema antes de a tela aparecer, para não piscar.
 */

export type PreferenciaTema = 'automatico' | 'claro' | 'escuro'

const CHAVE = 'contas-casa:tema'
const consulta = () => window.matchMedia('(prefers-color-scheme: dark)')

export function lerPreferencia(): PreferenciaTema {
  try {
    const v = localStorage.getItem(CHAVE)
    return v === 'claro' || v === 'escuro' ? v : 'automatico'
  } catch {
    return 'automatico'
  }
}

/** Se deve ficar escuro, dada a preferência e o tema do celular */
export function ehEscuro(preferencia: PreferenciaTema, celularEscuro: boolean): boolean {
  return preferencia === 'escuro' || (preferencia === 'automatico' && celularEscuro)
}

export function aplicarTema(preferencia: PreferenciaTema = lerPreferencia()) {
  const escuro = ehEscuro(preferencia, consulta().matches)
  document.documentElement.classList.toggle('dark', escuro)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#1c1917' : '#0f766e')
}

export function salvarPreferencia(preferencia: PreferenciaTema) {
  try {
    if (preferencia === 'automatico') localStorage.removeItem(CHAVE)
    else localStorage.setItem(CHAVE, preferencia)
  } catch {
    // sem armazenamento (aba anônima): vale só até fechar
  }
  aplicarTema(preferencia)
}

/** No modo automático, acompanha quando o celular troca de tema (ex.: à noite) */
export function acompanharCelular() {
  const q = consulta()
  const aoMudar = () => aplicarTema()
  q.addEventListener('change', aoMudar)
  return () => q.removeEventListener('change', aoMudar)
}
