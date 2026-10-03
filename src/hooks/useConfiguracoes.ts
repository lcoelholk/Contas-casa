import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/supabase.ts'
import type { TipoConta, TipoMovimento } from '../types/banco.ts'

/** Converte erros conhecidos do banco em mensagens para a tela */
export function mensagemDeErro(erro: unknown): string {
  const e = erro as { code?: string; message?: string }
  if (e.code === '23505') return 'Já existe uma com esse nome.'
  return e.message ?? String(erro)
}

function useMutacao<T>(chaves: string[][], fn: (dados: T) => Promise<void>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all(chaves.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}

async function checar(consulta: PromiseLike<{ error: unknown }>) {
  const { error } = await consulta
  if (error) throw error
}

// --- Abas (contas) ---

export type NovaConta = {
  nome: string
  tipo: TipoConta
  dono_id: string | null
  cor: string
  ordem: number
}

/** Cria a aba e devolve o id dela (para abrir em seguida) */
export function useCriarConta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (conta: NovaConta): Promise<string> => {
      const { data, error } = await db().from('contas').insert(conta).select('id').single()
      if (error) throw error
      return (data as { id: string }).id
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['contas'] }),
  })
}

/** Nome, cor e arquivamento (tipo e dono não mudam depois de criada) */
export function useEditarConta() {
  return useMutacao(
    [['contas'], ['lancamentos']],
    ({ id, ...campos }: { id: string; nome?: string; cor?: string; arquivada?: boolean }) =>
      checar(db().from('contas').update(campos).eq('id', id)),
  )
}

export function useReordenarContas() {
  return useMutacao([['contas']], async (novas: { id: string; ordem: number }[]) => {
    for (const { id, ordem } of novas) await checar(db().from('contas').update({ ordem }).eq('id', id))
  })
}

// --- Categorias ---

export function useSalvarCategoria() {
  return useMutacao(
    [['categorias']],
    ({ id, ...campos }: { id?: string; nome: string; icone: string | null; tipo: TipoMovimento }) =>
      checar(
        id
          ? db().from('categorias').update({ nome: campos.nome, icone: campos.icone }).eq('id', id)
          : db().from('categorias').insert(campos),
      ),
  )
}

export function useArquivarCategoria() {
  return useMutacao([['categorias']], ({ id, arquivada }: { id: string; arquivada: boolean }) =>
    checar(db().from('categorias').update({ arquivada }).eq('id', id)),
  )
}

// --- Pessoas ---

export function useEditarMembro() {
  return useMutacao([['membros']], ({ id, nome, cor }: { id: string; nome: string; cor: string }) =>
    checar(db().from('membros').update({ nome, cor }).eq('id', id)),
  )
}
