import { useState } from 'react'
import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { useMembros, useTodasContas } from '../hooks/useDados.ts'
import { useCategorias } from '../hooks/useLancamentos.ts'
import { useRecorrentes } from '../hooks/useRecorrentes.ts'
import { ativaNoMes, fixasDoMes, textoDoLimite, totaisFixos, type FixaDoMes } from '../lib/fixas.ts'
import { formatarCentavos } from '../lib/dinheiro.ts'
import { nomeCurtoDoMes, nomeDaCompetencia } from '../lib/datas.ts'
import { Aviso, Bolinha, Carregando } from '../components/ui.tsx'
import { FormRecorrente } from '../components/FormRecorrente.tsx'
import { NovoLancamento } from '../components/NovoLancamento.tsx'
import type { Conta, Membro, Recorrente } from '../types/banco.ts'

/** Todas as contas fixas (aluguel, academia, salário...) num lugar só */
export default function Fixas() {
  const { competencia } = useCompetencia()
  const contas = useTodasContas()
  const membros = useMembros()
  const categorias = useCategorias()
  const recorrentes = useRecorrentes()
  const [nova, setNova] = useState(false)
  const [editando, setEditando] = useState<Recorrente | null>(null)

  if (contas.isPending || membros.isPending || recorrentes.isPending) return <Carregando />
  if (recorrentes.isError) {
    return <Aviso titulo="Não foi possível carregar as contas fixas">{recorrentes.error.message}</Aviso>
  }

  const listaContas = contas.data ?? []
  const listaMembros = membros.data ?? []
  const { recorrentes: todas, divisoes } = recorrentes.data
  const doMes = fixasDoMes(todas, divisoes, competencia)
  const totais = totaisFixos(
    doMes,
    listaMembros.map((m) => m.id),
  )
  const futuras = todas.filter((r) => r.inicio > competencia)
  const encerradas = todas.filter((r) => r.fim !== null && r.fim < competencia)
  const contaDe = (r: Recorrente) => listaContas.find((c) => c.id === r.conta_id)
  // Agrupa por aba, na ordem das abas
  const grupos = listaContas
    .map((c) => ({ conta: c, fixas: doMes.filter((f) => f.recorrente.conta_id === c.id) }))
    .filter((g) => g.fixas.length > 0)

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div>
        <h1 className="text-lg font-semibold">Contas fixas</h1>
        <p className="text-sm text-stone-500">
          O que se repete todo mês · <span className="lowercase">{nomeDaCompetencia(competencia)}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {listaMembros.map((m) => {
          const t = totais.find((x) => x.membroId === m.id)!
          return (
            <div key={m.id} className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
              <p className="flex items-center gap-1.5 text-xs text-stone-500">
                <Bolinha cor={m.cor} />
                Fixo de {m.nome}
              </p>
              <p className="mt-0.5 text-lg font-semibold">{formatarCentavos(t.saidas)}</p>
              <p className="text-xs text-stone-500">
                {t.entradas > 0 ? `entra fixo ${formatarCentavos(t.entradas)}` : 'por mês'}
              </p>
            </div>
          )
        })}
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5 text-center text-sm text-stone-600">
          <p className="font-medium text-stone-900">Nenhuma conta fixa ainda</p>
          <p className="mt-1">
            Cadastre uma vez e ela aparece sozinha todo mês: aluguel, luz e internet na Casa; academia ou salário na aba
            de cada um.
          </p>
        </div>
      ) : (
        grupos.map(({ conta, fixas }) => (
          <GrupoDaConta
            key={conta.id}
            conta={conta}
            fixas={fixas}
            membros={listaMembros}
            categorias={categorias.data ?? []}
            onAbrir={setEditando}
            competencia={competencia}
          />
        ))
      )}

      {futuras.length > 0 && (
        <ListaSimples titulo="Começam depois" itens={futuras} contaDe={contaDe} onAbrir={setEditando}>
          {(r) => `a partir de ${nomeCurtoDoMes(r.inicio, true)}`}
        </ListaSimples>
      )}
      {encerradas.length > 0 && (
        <ListaSimples titulo="Encerradas" itens={encerradas} contaDe={contaDe} onAbrir={setEditando}>
          {(r) => `até ${nomeCurtoDoMes(r.fim!, true)}`}
        </ListaSimples>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20">
        <div className="mx-auto flex max-w-3xl justify-end px-4">
          <button
            onClick={() => setNova(true)}
            className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-marca-600 px-5 font-semibold text-white shadow-lg active:scale-[0.98]"
          >
            <span aria-hidden className="text-xl leading-none">
              +
            </span>
            Nova conta fixa
          </button>
        </div>
      </div>

      <NovoLancamento
        aberto={nova}
        onFechar={() => setNova(false)}
        contas={listaContas.filter((c) => !c.arquivada)}
        tipo="fixa"
      />
      {editando && contaDe(editando) && (
        <FormRecorrente
          aberto
          onFechar={() => setEditando(null)}
          conta={contaDe(editando)!}
          membros={listaMembros}
          // Encerrada ou futura: abre no mês em que ainda vale
          competencia={
            ativaNoMes(editando, competencia)
              ? competencia
              : editando.fim && editando.fim < competencia
                ? editando.fim
                : editando.inicio
          }
          recorrenteId={editando.id}
        />
      )}
    </div>
  )
}

function GrupoDaConta({
  conta,
  fixas,
  membros,
  categorias,
  onAbrir,
  competencia,
}: {
  conta: Conta
  competencia: string
  fixas: FixaDoMes[]
  membros: Membro[]
  categorias: { id: string; nome: string; icone: string | null }[]
  onAbrir: (r: Recorrente) => void
}) {
  const totalSaidas = fixas.filter((f) => f.recorrente.tipo === 'saida').reduce((s, f) => s + f.total, 0)
  return (
    <section aria-label={conta.nome} className="rounded-2xl border border-stone-200 bg-white px-4 pt-4 pb-1 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-stone-500 uppercase">
          <Bolinha cor={conta.cor} />
          {conta.nome}
        </h2>
        {totalSaidas > 0 && (
          <span className="text-sm font-medium text-stone-500 tabular-nums">{formatarCentavos(totalSaidas)}/mês</span>
        )}
      </div>
      <ul className="divide-y divide-stone-100">
        {fixas.map(({ recorrente: r, partes, total }) => {
          const cat = categorias.find((c) => c.id === r.categoria_id)
          const entrada = r.tipo === 'entrada'
          const comValor = membros.filter((m) => (partes[m.id] ?? 0) > 0)
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onAbrir(r)}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-stone-100">
                  {cat?.icone ?? (entrada ? '💰' : '🔁')}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{r.descricao}</span>
                  <span className="text-xs text-stone-500">
                    {r.dia_vencimento ? `${entrada ? 'cai' : 'vence'} dia ${r.dia_vencimento}` : 'sem dia fixo'}
                    {textoDoLimite(r, competencia) && (
                      <span className="font-medium text-amber-700"> · {textoDoLimite(r, competencia)}</span>
                    )}
                  </span>
                  {conta.tipo === 'compartilhada' && comValor.length > 0 && (
                    <span className="flex flex-wrap gap-x-2 text-xs text-stone-600">
                      {comValor.map((m) => (
                        <span key={m.id} className="flex items-center gap-1">
                          <Bolinha cor={m.cor} className="size-2" />
                          {m.nome} {formatarCentavos(partes[m.id])}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className={`shrink-0 font-semibold tabular-nums ${entrada ? 'text-emerald-700' : ''}`}>
                  {entrada ? '+' : ''}
                  {formatarCentavos(total)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ListaSimples({
  titulo,
  itens,
  contaDe,
  onAbrir,
  children,
}: {
  titulo: string
  itens: Recorrente[]
  contaDe: (r: Recorrente) => Conta | undefined
  onAbrir: (r: Recorrente) => void
  children: (r: Recorrente) => string
}) {
  return (
    <details className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm shadow-sm">
      <summary className="cursor-pointer font-medium text-stone-600">
        {titulo} ({itens.length})
      </summary>
      <ul className="mt-1 divide-y divide-stone-100">
        {itens.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onAbrir(r)}
              className="flex w-full items-center gap-2 py-2.5 text-left"
            >
              <Bolinha cor={contaDe(r)?.cor ?? null} />
              <span className="flex-1 truncate">{r.descricao}</span>
              <span className="text-xs text-stone-500">{children(r)}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
