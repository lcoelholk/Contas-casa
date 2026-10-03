/** Quais dados da tela recarregar quando uma tabela muda no banco (Supabase Realtime) */

export const TABELAS_TEMPO_REAL = [
  'membros',
  'contas',
  'categorias',
  'recorrentes',
  'recorrente_divisoes',
  'compras_parceladas',
  'compra_divisoes',
  'lancamentos',
  'orcamentos',
  'metas',
  'meta_aportes',
] as const

export type TabelaTempoReal = (typeof TABELAS_TEMPO_REAL)[number]

const CHAVES: Record<TabelaTempoReal, string[]> = {
  membros: ['membros'],
  contas: ['contas'],
  categorias: ['categorias'],
  recorrentes: ['recorrentes', 'lancamentos'],
  recorrente_divisoes: ['recorrentes', 'lancamentos'],
  compras_parceladas: ['compras', 'lancamentos'],
  compra_divisoes: ['compras', 'lancamentos'],
  // as parcelas pagas entram no progresso das compras
  lancamentos: ['lancamentos', 'compras'],
  orcamentos: ['orcamentos'],
  metas: ['metas'],
  meta_aportes: ['metas'],
}

/** Chaves do TanStack Query a invalidar para as tabelas que mudaram (sem repetir) */
export function chavesAfetadas(tabelas: Iterable<string>): string[] {
  const chaves = new Set<string>()
  for (const t of tabelas) for (const c of CHAVES[t as TabelaTempoReal] ?? []) chaves.add(c)
  return [...chaves].sort()
}
