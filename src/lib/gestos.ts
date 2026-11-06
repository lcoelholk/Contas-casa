/** Arrastar o dedo para o lado troca o mês */

/** Distância mínima (px) para contar como arrasto */
export const ARRASTO_MINIMO = 60

/**
 * Decide o que um arrasto faz: -1 = mês anterior (dedo para a direita),
 * 1 = próximo mês (dedo para a esquerda), 0 = nada.
 * Só vale se for bem mais de lado do que para cima/baixo (para não brigar com a rolagem).
 */
export function direcaoDoArrasto(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < ARRASTO_MINIMO) return 0
  if (Math.abs(dx) < Math.abs(dy) * 2) return 0
  return dx > 0 ? -1 : 1
}

/**
 * Onde o arrasto não deve trocar o mês: campos de texto, folhas abertas,
 * listas que rolam de lado e o que for marcado com data-sem-arrastar.
 */
export function ignorarArrastoEm(alvo: EventTarget | null): boolean {
  let el = alvo instanceof Element ? alvo : null
  while (el) {
    if (el.matches('input, textarea, select, [role="dialog"], [data-sem-arrastar]')) return true
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 1) {
      const overflow = getComputedStyle(el).overflowX
      if (overflow === 'auto' || overflow === 'scroll') return true
    }
    el = el.parentElement
  }
  return false
}
