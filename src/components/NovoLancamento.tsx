import { useState } from 'react'
import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { useMembroAtual, useMembros } from '../hooks/useDados.ts'
import { Folha } from './Folha.tsx'
import { Bolinha } from './ui.tsx'
import { FormLancamentoPessoal } from './FormLancamentoPessoal.tsx'
import { FormGastoCompartilhado } from './FormGastoCompartilhado.tsx'
import { FormRecorrente } from './FormRecorrente.tsx'
import { FormCompra } from './FormCompra.tsx'
import type { Conta } from '../types/banco.ts'

export type TipoNovo = 'avulso' | 'fixa' | 'parcelada'

const TIPOS: { valor: TipoNovo; titulo: string; texto: string; icone: string }[] = [
  { valor: 'avulso', titulo: 'Só desta vez', texto: 'Gasto ou entrada deste mês (mercado, uber, freela)', icone: '🧾' },
  { valor: 'fixa', titulo: 'Todo mês', texto: 'Conta fixa ou salário (aluguel, academia, internet)', icone: '🔁' },
  { valor: 'parcelada', titulo: 'Parcelado', texto: 'Compra em várias parcelas (geladeira, celular)', icone: '💳' },
]

/**
 * Novo lançamento em qualquer conta: escolhe a conta, depois o tipo
 * (uma vez, todo mês ou parcelado), e abre o formulário certo.
 * Passe `tipo` para pular a segunda escolha.
 */
export function NovoLancamento({
  aberto,
  onFechar,
  contas,
  tipo: tipoFixo,
}: {
  aberto: boolean
  onFechar: () => void
  /** Abas ativas para escolher */
  contas: Conta[]
  tipo?: TipoNovo
}) {
  const { competencia } = useCompetencia()
  const { membro: eu } = useMembroAtual()
  const membros = useMembros()
  const [conta, setConta] = useState<Conta | null>(null)
  const [tipoEscolhido, setTipo] = useState<TipoNovo | null>(null)
  const tipo = tipoFixo ?? tipoEscolhido
  const lista = membros.data ?? []
  const dono = lista.find((m) => m.id === conta?.dono_id)

  const fechar = () => {
    setConta(null)
    setTipo(null)
    onFechar()
  }

  const tituloConta =
    tipoFixo === 'fixa' ? 'Nova conta fixa em…' : tipoFixo === 'parcelada' ? 'Nova compra parcelada em…' : 'Lançar em…'

  return (
    <>
      <Folha aberta={aberto && !conta} onFechar={fechar} titulo={tituloConta}>
        <ul className="flex flex-col gap-2">
          {contas.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setConta(c)}
                className="flex w-full items-center gap-3 rounded-xl border border-stone-200 px-3 py-3 text-left hover:bg-stone-50"
              >
                <Bolinha cor={c.cor} className="size-3" />
                <span className="flex-1 font-medium">{c.nome}</span>
                <span className="text-xs text-stone-500">
                  {c.tipo === 'compartilhada'
                    ? 'dividida entre vocês'
                    : `só de ${lista.find((m) => m.id === c.dono_id)?.nome ?? '?'}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Folha>

      <Folha aberta={aberto && Boolean(conta) && !tipo} onFechar={fechar} titulo={`${conta?.nome ?? ''}: que tipo?`}>
        <ul className="flex flex-col gap-2">
          {TIPOS.map((t) => (
            <li key={t.valor}>
              <button
                type="button"
                onClick={() => setTipo(t.valor)}
                className="flex w-full items-center gap-3 rounded-xl border border-stone-200 px-3 py-3 text-left hover:bg-stone-50"
              >
                <span aria-hidden className="text-2xl">
                  {t.icone}
                </span>
                <span className="flex flex-col">
                  <span className="font-semibold">{t.titulo}</span>
                  <span className="text-xs text-stone-500">{t.texto}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setConta(null)}
          className="mt-3 h-10 w-full rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100"
        >
          ← Trocar a conta
        </button>
      </Folha>

      {aberto && conta && tipo === 'avulso' && conta.tipo === 'pessoal' && dono && (
        <FormLancamentoPessoal
          aberto
          onFechar={fechar}
          conta={conta}
          dono={dono}
          competencia={competencia}
          criadoPor={eu?.id}
        />
      )}
      {aberto && conta && tipo === 'avulso' && conta.tipo === 'compartilhada' && (
        <FormGastoCompartilhado
          aberto
          onFechar={fechar}
          conta={conta}
          membros={lista}
          competencia={competencia}
          criadoPor={eu?.id}
        />
      )}
      {aberto && conta && tipo === 'fixa' && (
        <FormRecorrente aberto onFechar={fechar} conta={conta} membros={lista} competencia={competencia} />
      )}
      {aberto && conta && tipo === 'parcelada' && (
        <FormCompra aberto onFechar={fechar} conta={conta} membros={lista} competencia={competencia} />
      )}
    </>
  )
}
