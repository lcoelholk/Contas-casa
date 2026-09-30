import { useMemo, useState, type FormEvent } from 'react'
import { Folha } from './Folha.tsx'
import {
  BotoesFormulario,
  Caixa,
  Campo,
  CampoValor,
  ErroFormulario,
  Segmentado,
  SeletorCategoria,
  classeInput,
} from './campos.tsx'
import { Bolinha } from './ui.tsx'
import {
  useCategorias,
  useCriarGastoCompartilhado,
  useEditarGastoCompartilhado,
  useExcluirLancamentos,
} from '../hooks/useLancamentos.ts'
import { centavosParaCampo, formatarCentavos, paraCentavos, somar } from '../lib/dinheiro.ts'
import {
  atualizarParteLivre,
  detectarModo,
  faltaDistribuir,
  partesPorModo,
  percentual,
  type ModoDivisao,
  type Partes,
} from '../lib/divisao.ts'
import type { Competencia } from '../lib/datas.ts'
import type { Conta, Lancamento, Membro } from '../types/banco.ts'

/** Adicionar ou editar um gasto de uma conta compartilhada (ex.: Casa), com a divisão */
export function FormGastoCompartilhado({
  aberto,
  onFechar,
  conta,
  membros,
  competencia,
  criadoPor,
  grupo,
}: {
  aberto: boolean
  onFechar: () => void
  conta: Conta
  membros: Membro[]
  competencia: Competencia
  criadoPor: string | undefined
  /** Linhas do gasto já salvo (edição) */
  grupo?: Lancamento[]
}) {
  return (
    <Folha aberta={aberto} onFechar={onFechar} titulo={grupo ? `Editar gasto · ${conta.nome}` : `Novo gasto · ${conta.nome}`}>
      {aberto && (
        <Formulario
          onFechar={onFechar}
          conta={conta}
          membros={membros}
          competencia={competencia}
          criadoPor={criadoPor}
          grupo={grupo}
        />
      )}
    </Folha>
  )
}

/** Valor da opção do seletor de divisão: "igual", "livre" ou "tudo:<membroId>" */
type ChaveModo = string
const paraChave = (m: ModoDivisao): ChaveModo => (m.tipo === 'tudo' ? `tudo:${m.membroId}` : m.tipo)
const deChave = (c: ChaveModo): ModoDivisao =>
  c.startsWith('tudo:') ? { tipo: 'tudo', membroId: c.slice(5) } : { tipo: c as 'igual' | 'livre' }

function Formulario({
  onFechar,
  conta,
  membros,
  competencia,
  criadoPor,
  grupo,
}: {
  onFechar: () => void
  conta: Conta
  membros: Membro[]
  competencia: Competencia
  criadoPor: string | undefined
  grupo?: Lancamento[]
}) {
  const categorias = useCategorias()
  const criar = useCriarGastoCompartilhado(criadoPor)
  const editar = useEditarGastoCompartilhado(criadoPor)
  const excluir = useExcluirLancamentos()
  const ids = useMemo(() => membros.map((m) => m.id), [membros])
  const base = grupo?.[0]

  // Estado inicial (na edição, a partir das linhas salvas)
  const inicial = useMemo(() => {
    if (!grupo) return { total: 0, partes: {} as Partes, modo: { tipo: 'igual' } as ModoDivisao }
    const partes: Partes = Object.fromEntries(ids.map((id) => [id, 0]))
    for (const l of grupo) partes[l.membro_id] = l.valor_centavos
    const total = somar(grupo.map((l) => l.valor_centavos))
    return { total, partes, modo: detectarModo(total, ids, partes) }
  }, [grupo, ids])

  const [descricao, setDescricao] = useState(base?.descricao ?? '')
  const [valorTexto, setValorTexto] = useState(grupo ? centavosParaCampo(inicial.total) : '')
  const [categoriaId, setCategoriaId] = useState(base?.categoria_id ?? '')
  const [vencimento, setVencimento] = useState(base?.vencimento ?? '')
  const [modo, setModo] = useState<ModoDivisao>(inicial.modo)
  const [livres, setLivres] = useState<Partes>(inicial.partes)
  const [livresTexto, setLivresTexto] = useState<Record<string, string>>(() =>
    Object.fromEntries(ids.map((id) => [id, inicial.partes[id] ? centavosParaCampo(inicial.partes[id]) : ''])),
  )
  const [pagos, setPagos] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

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

  function aoMudarModo(chave: ChaveModo) {
    const novo = deChave(chave)
    if (novo.tipo === 'livre') definirLivres(partes) // começa da divisão atual
    setModo(novo)
  }

  function aoMudarParte(membroId: string, texto: string) {
    setLivresTexto((t) => ({ ...t, [membroId]: texto }))
    const valor = paraCentavos(texto) ?? 0
    definirLivres(atualizarParteLivre(total, ids, livres, membroId, valor), membroId)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!descricao.trim()) return setErro('Escreva uma descrição.')
    if (total <= 0) return setErro('Informe o valor total.')
    if (falta !== 0) {
      return setErro(
        falta > 0
          ? `Ainda faltam ${formatarCentavos(falta)} para distribuir.`
          : `A divisão passou ${formatarCentavos(-falta)} do total.`,
      )
    }
    const comuns = {
      descricao: descricao.trim(),
      categoria_id: categoriaId || null,
      vencimento: vencimento || null,
      observacao: base?.observacao ?? null,
    }
    try {
      if (grupo) {
        await editar.mutateAsync({
          linhas: grupo,
          dados: { ...comuns, conta_id: conta.id, competencia, partes },
        })
      } else {
        await criar.mutateAsync({ ...comuns, conta_id: conta.id, competencia, partes, pagos })
      }
      onFechar()
    } catch (err) {
      setErro(`Não foi possível salvar: ${(err as Error).message}`)
    }
  }

  async function aoExcluir() {
    if (!grupo) return
    if (!confirmandoExclusao) return setConfirmandoExclusao(true)
    try {
      await excluir.mutateAsync(grupo.map((l) => l.id))
      onFechar()
    } catch (err) {
      setErro(`Não foi possível excluir: ${(err as Error).message}`)
    }
  }

  const opcoesModo = [
    { valor: 'igual', texto: ids.length === 2 ? '50/50' : 'Igual' },
    ...membros.map((m) => ({ valor: `tudo:${m.id}`, texto: `Só ${m.nome}` })),
    { valor: 'livre', texto: 'Valores livres' },
  ]

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      <Campo rotulo="Descrição">
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Mercado"
          className={classeInput}
          autoFocus={!grupo}
        />
      </Campo>

      <Campo rotulo="Valor total">
        <CampoValor valor={valorTexto} onChange={aoMudarTotal} ariaLabel="Valor total" />
      </Campo>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-stone-700">Quem paga quanto</span>
        <Segmentado rotulo="Divisão" valor={paraChave(modo)} onChange={aoMudarModo} opcoes={opcoesModo} />

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
                    onChange={(t) => aoMudarParte(m.id, t)}
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
              {falta > 0
                ? `Falta distribuir ${formatarCentavos(falta)}`
                : `Passou ${formatarCentavos(-falta)} do total`}
            </p>
          )}
        </div>
      </div>

      <Campo rotulo="Categoria">
        <SeletorCategoria
          categorias={categorias.data ?? []}
          tipo="saida"
          valor={categoriaId}
          onChange={setCategoriaId}
        />
      </Campo>

      <Campo rotulo="Vencimento (opcional)">
        <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={classeInput} />
      </Campo>

      {!grupo && (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-stone-700">Quem já pagou a sua parte?</span>
          {membros
            .filter((m) => (partes[m.id] ?? 0) > 0 || total === 0)
            .map((m) => (
              <Caixa
                key={m.id}
                marcado={pagos.includes(m.id)}
                onChange={(v) => setPagos((p) => (v ? [...p, m.id] : p.filter((id) => id !== m.id)))}
              >
                {m.nome}
              </Caixa>
            ))}
        </div>
      )}

      <ErroFormulario mensagem={erro} />

      <BotoesFormulario
        salvando={criar.isPending || editar.isPending}
        textoSalvar={grupo ? 'Salvar alterações' : 'Adicionar'}
        onExcluir={grupo ? aoExcluir : undefined}
        excluindo={excluir.isPending}
        confirmandoExclusao={confirmandoExclusao}
      />
    </form>
  )
}
