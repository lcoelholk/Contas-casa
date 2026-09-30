import { useMemo, useState } from 'react'
import { CampoValor, Segmentado } from './campos.tsx'
import { Bolinha } from './ui.tsx'
import { centavosParaCampo, formatarCentavos, paraCentavos } from '../lib/dinheiro.ts'
import {
  atualizarParteLivre,
  detectarModo,
  faltaDistribuir,
  partesPorModo,
  percentual,
  type ModoDivisao,
  type Partes,
} from '../lib/divisao.ts'
import type { Membro } from '../types/banco.ts'

/**
 * Estado do valor total + divisão entre membros (50/50, só um, valores livres).
 * Com um membro só (conta pessoal), a parte dele é sempre o total.
 */
export function useEditorDivisao(membros: Membro[], inicial?: { total: number; partes: Partes }) {
  const ids = useMemo(() => membros.map((m) => m.id), [membros])

  const [valorTexto, setValorTexto] = useState(inicial?.total ? centavosParaCampo(inicial.total) : '')
  const [modo, setModo] = useState<ModoDivisao>(() =>
    inicial?.total ? detectarModo(inicial.total, ids, inicial.partes) : { tipo: 'igual' },
  )
  const [livres, setLivres] = useState<Partes>(inicial?.partes ?? {})
  const [livresTexto, setLivresTexto] = useState<Record<string, string>>(() =>
    Object.fromEntries(ids.map((id) => [id, inicial?.partes[id] ? centavosParaCampo(inicial.partes[id]) : ''])),
  )

  const total = paraCentavos(valorTexto) ?? 0
  const partes = partesPorModo(total, ids, modo, livres)
  const falta = faltaDistribuir(total, partes)

  function definirLivres(novas: Partes, editado?: string) {
    setLivres(novas)
    setLivresTexto((textos) =>
      Object.fromEntries(
        ids.map((id) => [id, id === editado ? textos[id] : novas[id] ? centavosParaCampo(novas[id]) : '']),
      ),
    )
  }

  function aoMudarTotal(texto: string) {
    setValorTexto(texto)
    if (modo.tipo === 'livre' && ids.length === 2) {
      const novoTotal = paraCentavos(texto) ?? 0
      definirLivres(atualizarParteLivre(novoTotal, ids, livres, ids[0], livres[ids[0]] ?? 0))
    }
  }

  function aoMudarModo(novo: ModoDivisao) {
    if (novo.tipo === 'livre') definirLivres(partes) // começa da divisão atual
    setModo(novo)
  }

  function aoMudarParte(membroId: string, texto: string) {
    setLivresTexto((t) => ({ ...t, [membroId]: texto }))
    const valor = paraCentavos(texto) ?? 0
    definirLivres(atualizarParteLivre(total, ids, livres, membroId, valor), membroId)
  }

  /** Mensagem de erro, ou null se está tudo certo */
  function validar(): string | null {
    if (total <= 0) return 'Informe o valor.'
    if (falta > 0) return `Ainda faltam ${formatarCentavos(falta)} para distribuir.`
    if (falta < 0) return `A divisão passou ${formatarCentavos(-falta)} do total.`
    return null
  }

  return {
    membros,
    ids,
    valorTexto,
    aoMudarTotal,
    modo,
    aoMudarModo,
    livresTexto,
    aoMudarParte,
    total,
    partes,
    falta,
    validar,
  }
}

export type EstadoDivisao = ReturnType<typeof useEditorDivisao>

const paraChave = (m: ModoDivisao) => (m.tipo === 'tudo' ? `tudo:${m.membroId}` : m.tipo)
const deChave = (c: string): ModoDivisao =>
  c.startsWith('tudo:') ? { tipo: 'tudo', membroId: c.slice(5) } : { tipo: c as 'igual' | 'livre' }

/** Seletor de divisão e a parte de cada membro */
export function EditorDivisao({ estado, rotulo = 'Quem paga quanto' }: { estado: EstadoDivisao; rotulo?: string }) {
  const { membros, ids, modo, partes, total, falta, livresTexto } = estado
  if (ids.length < 2) return null

  const opcoes = [
    { valor: 'igual', texto: ids.length === 2 ? '50/50' : 'Igual' },
    ...membros.map((m) => ({ valor: `tudo:${m.id}`, texto: `Só ${m.nome}` })),
    { valor: 'livre', texto: 'Valores livres' },
  ]

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-stone-700">{rotulo}</span>
      <Segmentado rotulo="Divisão" valor={paraChave(modo)} onChange={(c) => estado.aoMudarModo(deChave(c))} opcoes={opcoes} />

      <div className="flex flex-col gap-2 rounded-xl border border-stone-200 p-3">
        {membros.map((m) => (
          <div key={m.id} className="flex items-center gap-3">
            <span className="flex w-24 shrink-0 items-center gap-2 text-sm font-medium">
              <Bolinha cor={m.cor} />
              {m.nome}
            </span>
            {modo.tipo === 'livre' ? (
              <div className="flex-1">
                <CampoValor
                  valor={livresTexto[m.id] ?? ''}
                  onChange={(t) => estado.aoMudarParte(m.id, t)}
                  ariaLabel={`Parte de ${m.nome}`}
                />
              </div>
            ) : (
              <span className="flex-1 text-right text-sm tabular-nums">{formatarCentavos(partes[m.id] ?? 0)}</span>
            )}
            <span className="w-10 shrink-0 text-right text-xs text-stone-500 tabular-nums">
              {percentual(partes[m.id] ?? 0, total)}%
            </span>
          </div>
        ))}
        {modo.tipo === 'livre' && total > 0 && falta !== 0 && (
          <p className={`text-xs font-medium ${falta > 0 ? 'text-amber-700' : 'text-red-700'}`}>
            {falta > 0 ? `Falta distribuir ${formatarCentavos(falta)}` : `Passou ${formatarCentavos(-falta)} do total`}
          </p>
        )}
      </div>
    </div>
  )
}
