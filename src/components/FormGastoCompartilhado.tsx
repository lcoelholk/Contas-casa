import { useMemo, useState, type FormEvent } from 'react'
import { Folha } from './Folha.tsx'
import {
  BotoesFormulario,
  Caixa,
  Campo,
  CampoValor,
  ErroFormulario,
  SeletorCategoria,
  classeInput,
} from './campos.tsx'
import { EditorDivisao, useEditorDivisao } from './EditorDivisao.tsx'
import {
  useCategorias,
  useCriarGastoCompartilhado,
  useEditarGastoCompartilhado,
  useExcluirLancamentos,
} from '../hooks/useLancamentos.ts'
import { somar } from '../lib/dinheiro.ts'
import type { Partes } from '../lib/divisao.ts'
import type { Competencia } from '../lib/datas.ts'
import type { Conta, Lancamento, Membro } from '../types/banco.ts'

/** Adicionar ou editar um gasto avulso de uma conta compartilhada (ex.: Casa), com a divisão */
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
  const base = grupo?.[0]

  const inicial = useMemo(() => {
    if (!grupo) return undefined
    const partes: Partes = Object.fromEntries(membros.map((m) => [m.id, 0]))
    for (const l of grupo) partes[l.membro_id] = l.valor_centavos
    return { total: somar(grupo.map((l) => l.valor_centavos)), partes }
  }, [grupo, membros])

  const divisao = useEditorDivisao(membros, inicial)
  const [descricao, setDescricao] = useState(base?.descricao ?? '')
  const [categoriaId, setCategoriaId] = useState(base?.categoria_id ?? '')
  const [vencimento, setVencimento] = useState(base?.vencimento ?? '')
  const [pagos, setPagos] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!descricao.trim()) return setErro('Escreva uma descrição.')
    const problema = divisao.validar()
    if (problema) return setErro(problema === 'Informe o valor.' ? 'Informe o valor total.' : problema)

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
          dados: { ...comuns, conta_id: conta.id, competencia, partes: divisao.partes },
        })
      } else {
        await criar.mutateAsync({ ...comuns, conta_id: conta.id, competencia, partes: divisao.partes, pagos })
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
        <CampoValor valor={divisao.valorTexto} onChange={divisao.aoMudarTotal} ariaLabel="Valor total" />
      </Campo>

      <EditorDivisao estado={divisao} />

      <Campo rotulo="Categoria">
        <SeletorCategoria categorias={categorias.data ?? []} tipo="saida" valor={categoriaId} onChange={setCategoriaId} />
      </Campo>

      <Campo rotulo="Vencimento (opcional)">
        <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={classeInput} />
      </Campo>

      {!grupo && (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-stone-700">Quem já pagou a sua parte?</span>
          {membros
            .filter((m) => (divisao.partes[m.id] ?? 0) > 0 || divisao.total === 0)
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
