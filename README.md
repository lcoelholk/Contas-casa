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

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Roda o app localmente, atualizando a cada mudança |
| `npm test` | Roda os testes |
| `npm run build` | Confere os tipos e gera a versão final em `dist/` |
| `npm run preview` | Abre a versão final localmente |

## Andamento

- [x] Etapa 1: estrutura (Vite, React, TypeScript, Tailwind, Router, cliente Supabase)
- [ ] Etapa 2: banco de dados
- [ ] Etapa 3: login e navegação
- [ ] Etapa 4: lançamentos avulsos
- [ ] Etapa 5: contas recorrentes
- [ ] Etapa 6: compras parceladas
- [ ] Etapa 7: resumo do mês
- [ ] Etapa 8: contas dinâmicas e configurações
- [ ] Etapa 9: tempo real e instalação no celular
- [ ] Etapa 10: publicação no GitHub Pages
