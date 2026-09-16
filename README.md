# Organizador de Grade Horária

Organizador de grade horária interativo com análise de grupo — HTML + Vanilla JS (ES Modules), sem build step.

## Stack

- **Frontend:** HTML + CSS + Vanilla JS (ES Modules nativos)
- **Dados locais:** `localStorage` (perfis./matérias/histórico)
- **Backend (em integração):** Supabase (Auth + Postgres + Realtime) — ver `js/` e `supabase/`
- **Deploy:** GitHub Pages (branch `main`, sem pipeline de build)

## Estrutura

```
grade-horaria/
├── index.html        # Interface principal (carrega 3 módulos ES + init inline)
├── dados.js          # Dados das matérias + estado mutável + helpers puros
├── logica.js         # Regras de negócio (conflitos, pré/co-requisitos, perfis)
├── render.js         # Renderização / manipulação do DOM
├── js/               # Integração Supabase (auth, admin, student) — em andamento
│   ├── supabase-client.js  # ⚠️ precisa de credenciais reais
│   ├── auth.js
│   ├── admin.js
│   └── student.js
├── supabase/
│   └── schema.sql    # Schema completo (RLS + realtime + seed)
└── check.ps1 / fix.ps1  # Scripts de verificação locais
```

## Como rodar

```powershell
npx serve .        # ou qualquer servidor estático na porta 3000
```

Abra `http://localhost:3000`. (ES Modules exigem servidor HTTP — não funciona via `file://`.)

## Regras do projeto

1. **Não alterar dados** de matéria/sala/professor/horário durante refatorações.
2. **Sem build step** nesta fase (sem Vite/npm/TypeScript no frontend).
3. Etapas pequenas, testadas antes de cada commit.
4. `PROJECT_MEMORY.md` é a fonte de verdade do progresso — ler antes de trabalhar e atualizar ao final.

## Roadmap

- [x] Modularização (dados/logica/render)
- [x] Bateria de testes funcionais (Playwright)
- [x] Schema Supabase (auth, admin/aluno, realtime)
- [ ] Integração Supabase ↔ UI atual
- [ ] Deploy GitHub Pages
- [ ] Importação de dados do SIGAA
- [ ] Otimizador automático de grade
