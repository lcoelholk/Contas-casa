import { useState, type FormEvent } from 'react'
import { Folha } from './Folha.tsx'
import { BotoesFormulario, Campo, ErroFormulario, Segmentado, SeletorCor, classeInput } from './campos.tsx'
import { mensagemDeErro, useCriarConta, useEditarConta } from '../hooks/useConfiguracoes.ts'
import { CORES, proximaOrdem } from '../lib/contas.ts'
import type { Conta, Membro, TipoConta } from '../types/banco.ts'

/** Criar uma aba nova ou editar nome, cor e arquivamento de uma existente */
export function FormConta({
  aberto,
  onFechar,
  membros,
  contas,
  conta,
  onCriada,
}: {
  aberto: boolean
  onFechar: () => void
  membros: Membro[]
  /** Todas as abas (para pôr a nova no fim) */
  contas: Conta[]
  conta?: Conta
  onCriada?: (id: string) => void
}) {
  return (
    <Folha aberta={aberto} onFechar={onFechar} titulo={conta ? `Editar ${conta.nome}` : 'Nova conta'}>
      {aberto && <Formulario onFechar={onFechar} membros={membros} contas={contas} conta={conta} onCriada={onCriada} />}
    </Folha>
  )
}

function Formulario({
  onFechar,
  membros,
  contas,
  conta,
  onCriada,
}: {
  onFechar: () => void
  membros: Membro[]
  contas: Conta[]
  conta?: Conta
  onCriada?: (id: string) => void
}) {
  const criar = useCriarConta()
  const editar = useEditarConta()
  const [nome, setNome] = useState(conta?.nome ?? '')
  const [tipo, setTipo] = useState<TipoConta>(conta?.tipo ?? 'compartilhada')
  const [donoId, setDonoId] = useState(conta?.dono_id ?? membros[0]?.id ?? '')
  const [cor, setCor] = useState(conta?.cor ?? CORES[6])
  const [erro, setErro] = useState<string | null>(null)
  const [confirmandoArquivar, setConfirmandoArquivar] = useState(false)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nome.trim()) return setErro('Dê um nome para a conta.')
    if (!conta && tipo === 'pessoal' && !donoId) return setErro('Escolha de quem é a conta.')
    try {
      if (conta) {
        await editar.mutateAsync({ id: conta.id, nome: nome.trim(), cor })
      } else {
        const id = await criar.mutateAsync({
          nome: nome.trim(),
          tipo,
          dono_id: tipo === 'pessoal' ? donoId : null,
          cor,
          ordem: proximaOrdem(contas),
        })
        onCriada?.(id)
      }
      onFechar()
    } catch (err) {
      setErro(`Não foi possível salvar: ${mensagemDeErro(err)}`)
    }
  }

  async function alternarArquivo() {
    if (!conta) return
    if (!conta.arquivada && !confirmandoArquivar) return setConfirmandoArquivar(true)
    try {
      await editar.mutateAsync({ id: conta.id, arquivada: !conta.arquivada })
      onFechar()
    } catch (err) {
      setErro(`Não foi possível ${conta.arquivada ? 'desarquivar' : 'arquivar'}: ${mensagemDeErro(err)}`)
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      <Campo rotulo="Nome">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Viagem, Pet, Carro"
          className={classeInput}
          autoFocus={!conta}
        />
      </Campo>

      {conta ? (
        <p className="text-sm text-stone-600">
          {conta.tipo === 'compartilhada'
            ? 'Conta compartilhada: cada gasto é dividido entre vocês.'
            : `Conta pessoal de ${membros.find((m) => m.id === conta.dono_id)?.nome ?? '?'}.`}{' '}
          O tipo não muda depois de criada.
        </p>
      ) : (
        <>
          <Campo
            rotulo="Tipo"
            dica={
              tipo === 'compartilhada'
                ? 'Funciona como a Casa: cada gasto é dividido entre vocês.'
                : 'Só de uma pessoa. Aparece também no total do mês dela.'
            }
          >
            <Segmentado
              rotulo="Tipo"
              valor={tipo}
              onChange={setTipo}
              opcoes={[
                { valor: 'compartilhada', texto: 'Compartilhada' },
                { valor: 'pessoal', texto: 'Pessoal' },
              ]}
            />
          </Campo>
          {tipo === 'pessoal' && (
            <Campo rotulo="De quem é">
              <Segmentado
                rotulo="De quem é"
                valor={donoId}
                onChange={setDonoId}
                opcoes={membros.map((m) => ({ valor: m.id, texto: m.nome }))}
              />
            </Campo>
          )}
        </>
      )}

      <Campo rotulo="Cor">
        <SeletorCor cores={CORES} valor={cor} onChange={setCor} />
      </Campo>

      <ErroFormulario mensagem={erro} />

      <BotoesFormulario salvando={criar.isPending || editar.isPending} textoSalvar={conta ? 'Salvar' : 'Criar conta'} />

      {conta && (
        <div className="flex flex-col gap-2 border-t border-stone-100 pt-3">
          {!conta.arquivada && (
            <p className="text-xs text-stone-500">
              Arquivar esconde a aba e para de gerar contas fixas e parcelas nela. Os lançamentos ficam guardados e dá
              para desarquivar depois em Ajustes.
            </p>
          )}
          <button
            type="button"
            onClick={alternarArquivo}
            disabled={editar.isPending}
            className={`h-11 rounded-xl font-medium disabled:opacity-50 ${
              confirmandoArquivar ? 'bg-amber-600 text-white' : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            {conta.arquivada ? 'Desarquivar' : confirmandoArquivar ? 'Toque de novo para arquivar' : 'Arquivar conta'}
          </button>
        </div>
      )}
    </form>
  )
}
