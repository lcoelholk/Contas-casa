import { useState, type FormEvent } from 'react'
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
import {
  useCategorias,
  useCriarLancamentoPessoal,
  useEditarLancamentoPessoal,
  useExcluirLancamentos,
} from '../hooks/useLancamentos.ts'
import { centavosParaCampo, paraCentavos } from '../lib/dinheiro.ts'
import type { Competencia } from '../lib/datas.ts'
import type { Conta, Lancamento, Membro, TipoMovimento } from '../types/banco.ts'

/** Adicionar ou editar um gasto/entrada numa conta pessoal */
export function FormLancamentoPessoal({
  aberto,
  onFechar,
  conta,
  dono,
  competencia,
  criadoPor,
  lancamento,
}: {
  aberto: boolean
  onFechar: () => void
  conta: Conta
  dono: Membro
  competencia: Competencia
  criadoPor: string | undefined
  lancamento?: Lancamento
}) {
  return (
    <Folha aberta={aberto} onFechar={onFechar} titulo={lancamento ? 'Editar lançamento' : `Novo lançamento · ${dono.nome}`}>
      {aberto && (
        <Formulario
          onFechar={onFechar}
          conta={conta}
          dono={dono}
          competencia={competencia}
          criadoPor={criadoPor}
          lancamento={lancamento}
        />
      )}
    </Folha>
  )
}

function Formulario({
  onFechar,
  conta,
  dono,
  competencia,
  criadoPor,
  lancamento,
}: {
  onFechar: () => void
  conta: Conta
  dono: Membro
  competencia: Competencia
  criadoPor: string | undefined
  lancamento?: Lancamento
}) {
  const categorias = useCategorias()
  const criar = useCriarLancamentoPessoal(criadoPor)
  const editar = useEditarLancamentoPessoal()
  const excluir = useExcluirLancamentos()

  const [tipo, setTipo] = useState<TipoMovimento>(lancamento?.tipo ?? 'saida')
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? '')
  const [valor, setValor] = useState(lancamento ? centavosParaCampo(lancamento.valor_centavos) : '')
  const [categoriaId, setCategoriaId] = useState(lancamento?.categoria_id ?? '')
  const [vencimento, setVencimento] = useState(lancamento?.vencimento ?? '')
  const [pago, setPago] = useState(lancamento?.pago ?? false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  const ehEntrada = tipo === 'entrada'

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const centavos = paraCentavos(valor)
    if (!descricao.trim()) return setErro('Escreva uma descrição.')
    if (centavos === null || centavos <= 0) return setErro('Informe um valor maior que zero.')

    const dados = {
      tipo,
      descricao: descricao.trim(),
      valor_centavos: centavos,
      categoria_id: categoriaId || null,
      vencimento: vencimento || null,
      pago,
    }
    try {
      if (lancamento) {
        await editar.mutateAsync({ id: lancamento.id, ...dados })
      } else {
        await criar.mutateAsync({
          ...dados,
          conta_id: conta.id,
          membro_id: dono.id,
          competencia,
          observacao: null,
        })
      }
      onFechar()
    } catch (err) {
      setErro(`Não foi possível salvar: ${(err as Error).message}`)
    }
  }

  async function aoExcluir() {
    if (!lancamento) return
    if (!confirmandoExclusao) return setConfirmandoExclusao(true)
    try {
      await excluir.mutateAsync([lancamento.id])
      onFechar()
    } catch (err) {
      setErro(`Não foi possível excluir: ${(err as Error).message}`)
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      <Segmentado
        rotulo="Tipo"
        valor={tipo}
        onChange={(t) => {
          setTipo(t)
          setCategoriaId('')
        }}
        opcoes={[
          { valor: 'saida', texto: 'Gasto' },
          { valor: 'entrada', texto: 'Entrada' },
        ]}
      />

      <Campo rotulo="Descrição">
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder={ehEntrada ? 'Ex.: Salário' : 'Ex.: Academia'}
          className={classeInput}
          autoFocus={!lancamento}
        />
      </Campo>

      <Campo rotulo="Valor">
        <CampoValor valor={valor} onChange={setValor} ariaLabel="Valor" />
      </Campo>

      <Campo rotulo="Categoria">
        <SeletorCategoria
          categorias={categorias.data ?? []}
          tipo={tipo}
          valor={categoriaId}
          onChange={setCategoriaId}
        />
      </Campo>

      <Campo rotulo={ehEntrada ? 'Data prevista (opcional)' : 'Vencimento (opcional)'}>
        <input
          type="date"
          value={vencimento}
          onChange={(e) => setVencimento(e.target.value)}
          className={classeInput}
        />
      </Campo>

      <Caixa marcado={pago} onChange={setPago}>
        {ehEntrada ? 'Já recebi' : 'Já está pago'}
      </Caixa>

      <ErroFormulario mensagem={erro} />

      <BotoesFormulario
        salvando={criar.isPending || editar.isPending}
        textoSalvar={lancamento ? 'Salvar alterações' : 'Adicionar'}
        onExcluir={lancamento ? aoExcluir : undefined}
        excluindo={excluir.isPending}
        confirmandoExclusao={confirmandoExclusao}
      />
    </form>
  )
}
