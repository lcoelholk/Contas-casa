import { useRef, type TouchEvent } from 'react'
import { useCompetencia } from './useCompetencia.tsx'
import { direcaoDoArrasto, ignorarArrastoEm } from '../lib/gestos.ts'

/** Arrastar para o lado na tela troca o mês (esquerda = próximo, direita = anterior) */
export function useArrastarMes() {
  const { anterior, proximo } = useCompetencia()
  const inicio = useRef<{ x: number; y: number } | null>(null)

  return {
    onTouchStart(e: TouchEvent) {
      const t = e.touches[0]
      inicio.current = e.touches.length === 1 && !ignorarArrastoEm(e.target) ? { x: t.clientX, y: t.clientY } : null
    },
    onTouchEnd(e: TouchEvent) {
      const de = inicio.current
      inicio.current = null
      if (!de) return
      const t = e.changedTouches[0]
      const direcao = direcaoDoArrasto(t.clientX - de.x, t.clientY - de.y)
      if (direcao === -1) anterior()
      if (direcao === 1) proximo()
    },
  }
}
