-- =============================================================================
-- 0003 · Categorias padrão
-- Podem ser renomeadas, arquivadas ou ampliadas depois, pelo app.
-- =============================================================================

insert into public.categorias (nome, tipo, icone) values
  ('Moradia',            'saida',   '🏠'),
  ('Contas de consumo',  'saida',   '💡'),
  ('Mercado',            'saida',   '🛒'),
  ('Alimentação fora',   'saida',   '🍽️'),
  ('Transporte',         'saida',   '🚗'),
  ('Saúde',              'saida',   '🩺'),
  ('Lazer',              'saida',   '🎉'),
  ('Compras',            'saida',   '🛍️'),
  ('Assinaturas',        'saida',   '📺'),
  ('Educação',           'saida',   '📚'),
  ('Pets',               'saida',   '🐾'),
  ('Outros',             'saida',   '📦'),
  ('Salário',            'entrada', '💼'),
  ('Freela',             'entrada', '💻'),
  ('Reembolso',          'entrada', '↩️'),
  ('Outros',             'entrada', '➕')
on conflict (nome, tipo) do nothing;
