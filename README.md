# Contas da Casa

App de finanças do Lucas e da Emillia: contas pessoais de cada um, contas da casa com divisão livre, e compras parceladas que entram automaticamente na conta de cada pessoa.

O planejamento completo (regras, banco de dados e etapas) está em [`CLAUDE.md`](./CLAUDE.md).

## Rodar no computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install
cp .env.example .env.local   # depois preencha com os dados do Supabase
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente `http://localhost:5173/Contas-casa/`).

## Configurar o banco (Supabase)

Projeto: `kiygwquaypxjjphxlkvv`. Tudo é feito no painel do Supabase, uma vez só.

1. **SQL Editor → New query**: cole e rode, **nesta ordem**, cada arquivo de `supabase/migrations/`:
   `0001_estrutura.sql` → `0002_seguranca.sql` → `0003_categorias.sql`
2. **Authentication → Users → Add user → Create new user**: crie o usuário do Lucas e o da Emillia (e-mail e senha, marque *Auto Confirm User*).
3. **Authentication → Sign In / Providers**: desligue *Allow new users to sign up*.
4. Abra `supabase/setup_casal.sql`, troque o e-mail da Emillia (e confira o do Lucas) e rode no **SQL Editor**.

Para conferir: em **Table Editor**, a tabela `contas` deve ter Lucas, Emillia e Casa, e `categorias` deve ter 16 linhas.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Roda o app localmente, atualizando a cada mudança |
| `npm test` | Roda os testes do app |
| `npm run test:banco` | Testa as migrations e a segurança num Postgres local |
| `npm run build` | Confere os tipos e gera a versão final em `dist/` |
| `npm run preview` | Abre a versão final localmente |

## Andamento

- [x] Etapa 1: estrutura (Vite, React, TypeScript, Tailwind, Router, cliente Supabase)
- [x] Etapa 2: banco de dados (estrutura, segurança, categorias, cadastro do casal)
- [ ] Etapa 3: login e navegação
- [ ] Etapa 4: lançamentos avulsos
- [ ] Etapa 5: contas recorrentes
- [ ] Etapa 6: compras parceladas
- [ ] Etapa 7: resumo do mês
- [ ] Etapa 8: contas dinâmicas e configurações
- [ ] Etapa 9: tempo real e instalação no celular
- [ ] Etapa 10: publicação no GitHub Pages
