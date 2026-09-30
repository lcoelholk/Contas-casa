-- =============================================================================
-- Cadastro do casal e das abas iniciais — rodar UMA vez, depois das migrations
--
-- Antes de rodar:
--   1. Supabase → Authentication → Users → Add user → Create new user
--      Crie o usuário do Lucas e o da Emillia (e-mail + senha, marque "Auto Confirm User").
--   2. Troque os dois e-mails abaixo pelos que vocês usaram.
-- =============================================================================

do $$
declare
  email_lucas   text := 'lucascoelho855@gmail.com';   -- ← confira
  email_emillia text := 'EMAIL-DA-EMILLIA@exemplo.com'; -- ← troque

  v_user_lucas   uuid;
  v_user_emillia uuid;
  v_lucas        uuid;
  v_emillia      uuid;
begin
  select id into v_user_lucas   from auth.users where lower(email) = lower(email_lucas);
  select id into v_user_emillia from auth.users where lower(email) = lower(email_emillia);

  if v_user_lucas is null then
    raise exception 'Usuário do Lucas (%) não encontrado em Authentication → Users', email_lucas;
  end if;
  if v_user_emillia is null then
    raise exception 'Usuário da Emillia (%) não encontrado em Authentication → Users', email_emillia;
  end if;

  insert into public.membros (user_id, nome, cor) values (v_user_lucas, 'Lucas', '#0284c7')
    returning id into v_lucas;
  insert into public.membros (user_id, nome, cor) values (v_user_emillia, 'Emillia', '#e11d48')
    returning id into v_emillia;

  insert into public.contas (nome, tipo, dono_id, cor, ordem) values
    ('Lucas',   'pessoal',       v_lucas,   '#0284c7', 1),
    ('Emillia', 'pessoal',       v_emillia, '#e11d48', 2),
    ('Casa',    'compartilhada', null,      '#0d9488', 3);

  raise notice 'Pronto: membros Lucas e Emillia e as abas Lucas, Emillia e Casa foram criados.';
end;
$$;
