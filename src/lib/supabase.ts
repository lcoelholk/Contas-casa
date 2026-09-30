import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** true quando as duas variáveis do .env.local estão preenchidas */
export const supabaseConfigurado = Boolean(url && anonKey)

/**
 * Cliente do Supabase. Fica `null` enquanto o .env.local não estiver preenchido,
 * para o app abrir mesmo sem banco (mostrando o aviso de configuração).
 */
export const supabase: SupabaseClient | null = supabaseConfigurado
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

/** Cliente do Supabase para uso nas telas (só depois de conferir `supabaseConfigurado`) */
export function db(): SupabaseClient {
  if (!supabase) throw new Error('Supabase não configurado: preencha o .env.local')
  return supabase
}

export type StatusConexao =
  | { ok: true }
  | { ok: false; motivo: 'nao-configurado' | 'chave-invalida' | 'sem-resposta'; detalhe?: string }

/**
 * Verifica se o projeto Supabase responde e se a chave anon é aceita.
 * Usa o endpoint de saúde do Auth, que não depende de nenhuma tabela.
 */
export async function verificarConexao(): Promise<StatusConexao> {
  if (!supabaseConfigurado) return { ok: false, motivo: 'nao-configurado' }

  try {
    const resposta = await fetch(`${url!.replace(/\/$/, '')}/auth/v1/health`, {
      headers: { apikey: anonKey! },
    })
    if (resposta.ok) return { ok: true }
    if (resposta.status === 401 || resposta.status === 403) {
      return { ok: false, motivo: 'chave-invalida', detalhe: `HTTP ${resposta.status}` }
    }
    return { ok: false, motivo: 'sem-resposta', detalhe: `HTTP ${resposta.status}` }
  } catch (erro) {
    return {
      ok: false,
      motivo: 'sem-resposta',
      detalhe: erro instanceof Error ? erro.message : String(erro),
    }
  }
}
