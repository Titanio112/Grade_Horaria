# 📅 Grade Horária

Organizador de grade horária com análise de grupo, pré-requisitos e trava de choque de horários. Planeje sua grade aqui antes de fazer a matrícula oficial no sistema da sua faculdade.

> ⚠️ **Aviso:** esta ferramenta é um planejador — a fonte oficial de horários e matrícula é o sistema da sua instituição (ex.: SIGAA).

## Stack

- **Frontend:** HTML + Vanilla JS (ES Modules), sem build step
- **Backend:** Supabase (Auth, Postgres, RLS, Realtime)
- **Deploy:** GitHub Pages (estático)

## Estrutura

```
├── index.html              # Interface principal
├── dados.js / logica.js / render.js   # Camadas (dados / regras / UI)
├── js/                     # Integração Supabase (auth, admin, student)
└── supabase/
    ├── schema.sql          # Schema v4 (catálogo normalizado, triggers, RLS)
    └── migrations/         # v5.sql (social/admin/notificações) + v5_down.sql (rollback) + hotfixes
```

## Rodar localmente

```powershell
npx serve .
```

## Créditos / Legado

Este repositório é a continuação do projeto original:
[Organizador-de-Grade-Hor-ria-com-An-lise-de-Grupo](https://github.com/Titanio112/Organizador-de-Grade-Hor-ria-com-An-lise-de-Grupo) (branch `main` = versão estática legada).

## Licença

Em definição.