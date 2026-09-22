# 📅 Grade Horária

Organizador de grade horária com análise de grupo, pré-requisitos e trava de choque de horários. Planeje sua grade aqui antes de fazer a matrícula oficial no sistema da sua faculdade.

> ⚠️ **Aviso:** esta ferramenta é um planejador — a fonte oficial de horários e matrícula é o sistema da sua instituição (ex.: SIGAA).

## Stack

- **Frontend:** HTML + Vanilla JS (ES Modules), sem build step
- **Backend:** Supabase (Auth, Postgres, RLS, Realtime)
- **Deploy:** GitHub Pages (estático)

## Estrutura

```
├── index.html … redefinir.html, grade.html   # Páginas (auth + app)
├── css/                 # tokens.css (cores) · base.css · auth.css · app.css
├── js/
│   ├── core/            # config, supabase-client, utils
│   ├── services/        # Única camada que fala com o Supabase
│   ├── components/      # UI pura (dropdown, cascata, grade semanal, catálogo)
│   ├── pages/           # Orquestração de cada página (.page.js)
│   └── legado/          # Referência histórica (não usar)
├── grade-legado.html + dados/logica/render.js   # App vanilla original (referência)
└── supabase/
    ├── schema.sql       # Schema base
    └── migrations/      # v5 (social/admin/notificações) + v6 (institution_requests) + hotfixes
```

**Status:** autenticação completa (login/cadastro/confirmação/recuperação) e
montagem de grade com catálogo real, pré-requisitos e choque de horário.
Próximo: perfil social (amigos/grupos) e comparação de grades.

## Rodar localmente

```powershell
npx serve .
```

## Créditos / Legado

Este repositório é a continuação do projeto original:
[Organizador-de-Grade-Hor-ria-com-An-lise-de-Grupo](https://github.com/Titanio112/Organizador-de-Grade-Hor-ria-com-An-lise-de-Grupo) (branch `main` = versão estática legada).

## Licença

Em definição.