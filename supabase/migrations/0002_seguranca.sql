-- =============================================================================
-- 0002 · Segurança (Row Level Security)
-- Regra da v1: só quem está na tabela `membros` lê e escreve. Os dois veem tudo.
-- Quem não está logado, ou está logado mas não é membro, não vê nada.
-- =============================================================================

-- security definer: consulta `membros` sem passar pelo RLS (evita recursão)
create function public.eh_membro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.membros where user_id = auth.uid());
$$;

revoke all on function public.eh_membro() from public, anon;
grant execute on function public.eh_membro() to authenticated;

-- Liga o RLS e cria a mesma regra em todas as tabelas
do $$
declare
  t text;
begin
  foreach t in array array[
    'membros', 'contas', 'categorias', 'recorrentes', 'recorrente_divisoes',
    'compras_parceladas', 'compra_divisoes', 'lancamentos'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "membros acessam tudo" on public.%I
         for all to authenticated
         using (public.eh_membro())
         with check (public.eh_membro())',
      t
    );
    -- Visitantes sem login não têm acesso nenhum; usuários logados passam pelo RLS
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;
