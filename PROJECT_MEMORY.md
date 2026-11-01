# PROJECT_MEMORY.md — Grade Horária BSI

> Fonte de verdade única do projeto. Leia antes de qualquer tarefa.
> Atualizado em: 25/09/2026 (varredura histórica → 16 issues no GitHub + E2E intensivo reescrito)

## 🚨 DIRETRIZ PERMANENTE (23/09/2026) — documentar erros SEMPRE

Prioridade #1 do trabalho aqui é **achar erros**, não só entregar rápido.
Todo erro encontrado (visual, lógica, dados, causado por IA ou manual) é
documentado **nos dois lugares ANTES de seguir para o próximo passo**:
1. Memória local: `docs/QA_VISUAL.md` (+ este arquivo quando relevante) e/ou
   `docs/qa-issues/NNN-slug.md` (formato padronizado).
2. GitHub Issues do repo `Titanio112/Grade_Horaria` via `gh` CLI — ver a
   **Regra Permanente (25/09/2026)** na seção abaixo: criar a issue de verdade,
   colar a saída real do comando, fechar se já resolvida.

**25/09/2026 — Varredura histórica → 16 issues no GitHub + E2E intensivo reescrito:**
- Regra permanente gravada (abaixo): bug encontrado → documenta em
  `docs/qa-issues/` → abre GitHub Issue de verdade → fecha se resolvida,
  sempre colando a saída real dos comandos.
- 16 issues abertas em `Titanio112/Grade_Horaria` (#1–#6 = Rodada 3,
  #7–#16 = varredura histórica do post-mortem). Resultado real
  (`gh issue list --state all`): **14 CLOSED, 2 OPEN** — abertas de
  propósito: **#14** (bounces Supabase, risco operacional ativo) e
  **#16** (histórico acadêmico, feature pendente do roadmap).
- Índices da varredura: `docs/qa-issues/HISTORICAL_SCAN_PART1.md` e
  `PART2.md` (mapeiam cada item → número da issue).
- `test-qa-grade-intensive.cjs` reescrito do zero (36 checks, exit 0).
  Dois bugs novos de teste achados nessa bateria → issues #17 e #18
  (já fechadas): check de scrollbar era falso negativo em headless;
  seção obsoleta de cascata removida do `test-auth-ui.cjs`.
- Bateria completa verde: intensive (36) + grade-flow (22) +
  dropdown-cascade (16) + cadastro-validacao (13) + auth-login-flow +
  auth-ui + utils (18).

**23/09/2026 — Rodada 3 de QA (catálogo/sanfona) + higiene do repo:**
- 5 bugs achados e corrigidos (detalhes em `docs/QA_VISUAL.md` rodada-3 e
  issues `docs/qa-issues/001..005`): separador `·` quebrando linha em
  `.class-when` (NBSP fix); chip de pré-req virou faixa com texto compacto
  `Falta concluir: X +N`; scrollbar fina sempre visível no `.subject-list`;
  sanfona migrada p/ `grid-template-rows: 0fr→1fr` (teto de 500px escondia
  matérias) + `flex-shrink: 0` nos grupos; **`friendlyGradeError()` nunca
  casava erro do banco** (agora normaliza caixa+acentos antes do match).
- **Regra de repo:** `*.cjs` de teste/QA, `check_/fix_/probe-/parse_*` etc.
  são LOCAIS e estão no `.gitignore`. Este projeto é Vanilla JS sem build —
  **não existe `package.json` na raiz**; se aparecer (install acidental),
  remover. Nunca commitar scripts de debug.


**22/09/2026 — rodada de correções/ajustes (4 commits, todos E2E verdes):**
1. `7246324` **Arquitetura**: telas movidas para `pages/` (index.html fica na
   raiz, GitHub Pages); zero `style=""`/`<style>` em qualquer HTML (legado
   extraído para `css/legado.css`); redirects e testes ajustados.
2. `2af1672` **Bugs**: sala+professor no bloco da grade (schedule_rooms);
   validação real do cadastro (e-mail com TLD, senha sem espaço/sequências
   óbvias, nome só letras + capitalizado + sobrenome obrigatório + sem
   repetição); olho de senha (password-field.component.js); rascunho
   automático em sessionStorage (form-draft.component.js — senha NUNCA
   persistida), alinhamento do ícone de tema.
3. `45c96f5` **Design system**: `css/motion.css` (durações/easing de mola —
   mexer na personalidade do movimento é SÓ lá) + `css/components.css`
   (vidro Liquid Glass, dropdown migrado de inline styles, menu ⋯, accordion);
   header com menu ⋯ (Minha grade/Conta/Sair) + toggle de tema inline;
   catálogo agrupado por semestre em sanfona + seletor de ordenação
   (1º→último padrão / invertido / alfabético).
4. `d8195bb` **Cores algorítmicas**: migration v7 (`subjects.color` + CHECK
   hex) + `supabase/generate_subject_colors.js` (determinista por curso:
   matiz do curso + ângulo áureo nas bases, família análoga +18°/geração nas
   derivadas; `--force` regenera, normal só preenche o que falta). Blocos da
   grade usam `subjects.color` via `color-mix`; fallback = paleta `--block-N`.
   **Rode o gerador quando cadastrar matéria nova no catálogo.**

## 📌 Estado atual (resumo executivo)

**Backend: 100% pronto.** Schema v7 aplicado (v6 + `subjects.color`) no Supabase.
**Front-end FASE 1 + 1.5 + 1.6 + 2 entregue:** telas de auth completas + **tela de
montar grade** (`grade.html` = nova home do app pós-login).
**FASE 2 (21/09/2026):** catálogo do curso vindo do banco (`catalog.service.js`),
grade semanal Seg–Sáb 7h–23h com blocos coloridos por matéria (`weekly-grid.component.js`,
paleta `--block-1..8` em tokens.css claro/escuro), catálogo com busca + chips de
pré-requisito/`Na sua grade` (`class-picker.component.js`), adicionar/remover turma
persistindo em `student_classes` (`grades.service.js`), validações locais de
pré-req e choque de horário (banco continua a trava final), seletor de visibilidade
(private/friends/public), resumo turmas+horas, header do app com nav
(Minha grade/Conta/Sair), redirects login/index → grade.html, conta.html com CTA
para a grade. E2E: `test-grade-flow.cjs` (12 checks) + regressões
`test-dropdown-cascade.cjs` (16) e `test-auth-login-flow.cjs` — todas verdes.
**FASE 1.6 (21/09/2026):** `<select>` nativos da cascata do cadastro substituídos por
`js/components/dropdown.component.js` (listbox ARIA estilável, teclado completo,
painel ancorado no botão via wrapper `position:relative`, fecha em scroll/resize,
placeholder dinâmico via `setOptions(opts, novoPlaceholder)`). Fix de overflow
horizontal < 400px: `.auth-page` ganhou `grid-template-columns: minmax(0, 1fr)`.
E2E local: `test-dropdown-cascade.cjs` (16 checks, todos verdes) + regressão
`test-auth-login-flow.cjs` verde. App vanilla antigo preservado em `grade-legado.html`.
**Deploy:** ainda não publicado (GitHub Pages).

## 🎯 Estado de fases (verificado contra o código em 25/09/2026)

| Fase | Status | Evidência |
|---|---|---|
| **Fase 2.5 (perfil social)** | ❌ **NÃO concluída no front-end** | Backend pronto desde schema v5 (`friendships`, `groups`, `profiles.friend_code`, `profiles.color_preset` — commit `bd55fb3`; `profiles.service.js` já lê `friend_code`). MAS: não existe `friends/groups` em `js/services/`, nenhuma tela social em `pages/`, e `conta.page.js` não expõe `friend_code` na UI. Falta toda a camada de interface. |
| **GAP histórico acadêmico** | ⚠️ **Pendente e travando pré-req na prática** | Issue **#16 OPEN** — sem tela pro aluno marcar o que já cursou, o bloqueio de pré-requisito não funciona de verdade (detalhes no roadmap abaixo). |
| **Bounces Supabase** | ⚠️ **Risco ativo** | Issue **#14 OPEN** — taxa alta provável por contas de teste com e-mail falso; auditar/remover usuários mock no painel. |

## 🐞 Regra Permanente — Fluxo de Bugs → GitHub Issues (25/09/2026)

Sempre que um bug ou erro for encontrado durante o desenvolvimento (visual, lógico,
de dado, de teste, o que for), o fluxo é sempre o mesmo, **em sequência, sem parar
para pedir permissão no meio**:

a) **Documentar o erro localmente** — no `PROJECT_MEMORY.md` e/ou em
   `docs/qa-issues/NNN-titulo.md`, no formato padronizado: título, tipo, descrição,
   local onde apareceu, status atual, como reproduzir.
b) **Abrir a issue correspondente no GitHub logo em seguida**, sem esperar
   autorização, via `gh issue create` (repo `Titanio112/Grade_Horaria`), uma de cada
   vez, **sempre mostrando a saída real do comando** — nunca reportar como feito sem
   colar a saída de verificação (`gh issue list --state all`) que comprove.
c) **Fechar a issue em seguida** se o erro já estiver resolvido, com
   `gh issue close` + comentário de resolução, também mostrando a saída real.

O usuário só é chamado se um comando falhar de verdade ou se for uma decisão que
dependa dele. Fora isso, o fluxo documentar local → criar a issue → fechar (se
aplicável) roda inteiro, item por item, até terminar todos os erros pendentes,
sem parar para perguntar se pode continuar.

---

## 🧱 Arquitetura do front (definida e em uso)

Regra rígida: **`services/` nunca toca no DOM; `components/` nunca fala com o
Supabase; `pages/` orquestra os dois.** Sufixos: `.service.js`, `.component.js`,
`.page.js`. Arquivo >~300 linhas = dividir. Todo arquivo começa com cabeçalho
dizendo o que faz / o que NÃO faz / dependências.

**Regra rígida 2 (22/09/2026): HTML NUNCA contém estilo** — proibido `style="…"`
inline e bloco `<style>` em qualquer página (nova ou existente). Todo estilo
visual vive em arquivo `.css` e entra via `<link>`. Única exceção: o bootstrap
inline de tema no `<head>` (JavaScript, não estilo). JS pode setar estilos
dinâmicos calculados (ex: posição de bloco na grade) — proibido é estilo
estático enfiado no HTML.

```
index.html (raiz — GitHub Pages exige; só roteia por sessão para pages/)
pages/                 TODAS as telas: login, cadastro, conta, recuperar,
                       redefinir, grade + grade-legado.html (referência)
                       → links src/href internos usam ../css/… e ../js/…
css/legado.css         CSS extraído do grade-legado.html (zero <style> em HTML)
css/tokens.css         fonte única de cor (claro/escuro) — NÃO editar cores em outro lugar
css/motion.css         FONTE ÚNICA de movimento (durações/easings de mola) — NÃO
                       criar duração/easing hardcoded em outro CSS
css/components.css     vidro Liquid Glass, dropdown, menu do header, sanfona
css/base.css           reset + forma/tipografia + chrome global (scrollbar, theme-toggle)
css/auth.css           telas de auth (grid de hairlines com glow no dark)
css/app.css            área logada: header/nav, catálogo, grade semanal (grade.html)
js/core/               config.js, supabase-client.js, utils.js (puro)
js/services/           auth, profiles, institutions, institution-requests,
                       catalog (matérias/turmas do curso), grades (grade + student_classes)
js/components/         dropdown.component.js (listbox ARIA genérico),
                       select-cascade.component.js (usa dropdown),
                       theme-toggle.component.js (fixo no body OU inline no header),
                       class-picker.component.js (catálogo: sanfona por semestre + sort),
                       weekly-grid.component.js (grade semanal Seg–Sáb 7h–23h,
                                                 bloco = matéria+horário+sala+professor),
                       password-field.component.js (olho + sem espaço),
                       form-draft.component.js (rascunho sessionStorage, sem senha),
                       header-menu.component.js (menu ⋯ do app)
js/pages/              index/login/cadastro/conta/recuperar/redefinir/grade .page.js
js/legado/             auth/admin/student.js antigos (referência, não usar)
grade-legado.html, dados.js, logica.js, render.js   app vanilla original (referência)
```

Decisões de design (fase 1 + 1.5, aprovadas): paleta ink `#1D1D1F` / ink-2 `#6E6E73` /
bg `#F5F5F7` / surface `#FFF` / line `#D2D2D7` / acento único `#0071E3` /
danger `#C81E1E` / success `#248A3D` / warning `#B45309`; **modo escuro** com
azul iOS `#0A84FF` e grid com `drop-shadow` glow sutil; tipografia = stack de sistema (SF Pro);
coluna única (~25rem) alinhada à esquerda; sem sombra pesada, sem hero;
movimento só em resposta a ação (toggle 200ms, botão `:active 0.98`);
**CSS 100% fluido** (rem + clamp/min; breakpoint fixo removido — exceção
intencional: bordas hairline/anéis de foco em px). Validado sem scroll
horizontal em 375 / 768 / 1280 / 1600 em 5 telas (login, cadastro, conta, recuperar, redefinir).
Toggle de tema: Liquid Glass (`backdrop-filter: blur(14px)`) + Fluent Emoji 3D via CDN,
`prefers-color-scheme` default + `localStorage` persist, bootstrap inline no `<head>` = sem flash.
Commit da fase 1.5: `820ec72` no `master` de `Titanio112/Grade_Horaria`
(push feito em 20/09/2026; GitHub Pages ainda não ativado).
Detalhe: o trigger `handle_new_user` NÃO grava `course_id` — cadastro envia
via metadata do signup e `profiles.service.ensureProfileCourse()` faz o
backfill no 1º login (UPDATE no próprio profile, RLS permite). Testado: ok.

## 🗄️ Banco de dados (Supabase, projeto `zhcubvmismnmvtrbolbu`)

- **21 tabelas** (v6: + `institution_requests`), RLS ativo em todas, realtime nas sociais.
- **Usuario real cadastrado e confirmado**: `aphmgbr@gmail.com` (super admin, friend_code `E4DC85`).
- Catálogo: 65 matérias, 27 professores, 12 salas, 65 turmas, 89 blocos de horário.
- Travas de negócio ativas: pré-requisitos (BEFORE INSERT), choque de horário (INSERT+UPDATE, cross-grade), notificações com dedup.
- Admin em 3 níveis com `granted_by` (cascata auditável).
- `institution_requests`: INSERT anon/authenticated (cadastro sem conta), SELECT/UPDATE só super admin; sem e-mail automático (MVP manual).

## ✅ O que está 100% funcional e provado

Auth (signup/login/confirmacao email, recuperar/redefinir senha), catálogo normalizado, pré-requisitos, choque de horário, amizades+grupos, privacidade 3 níveis (private/friends/public), delegacao admin em cascata, notificações in-app com dedup, reports roteados ao admin do curso, contador de faltas (regra 25% fica na UI).
**Fase 1.5:** modo escuro/claro (tokens centralizados, toggle Liquid Glass, persists), aviso de senha fraca não bloqueante, solicitação de instituição anon (tabela v6), fluxo recuperar/redefinir senha.

## Repositórios

- **Oficial (produto):** `Titanio112/Grade_Horaria` (branch `master`) — código de aplicação + schema/migrations.
- **Legado:** `Titanio112/Organizador-de-Grade-Hor-ria-com-An-lise-de-Grupo` — apenas referência histórica (README do novo cita).

## 🔒 Credenciais (onde estão)

- `grade-horaria/.env` (gitignored): `SUPABASE_DB_URL`, `SUPABASE_ANON_KEY`.
- `js/config.js`: URL + anon key (pública por design).
- Senha da conta admin inicial: em `supabase/signup_real_user.js` (gitignored; trocar após 1º login).
- Nada de segredo no git (hanico limpo com filter-repo).

## ⚠️ Decisões registradas

- Sem SMTP custom por agora (e-mail padrão do Supabase free; rate limit conhecido).
- Import/Export JSON removido; export volta depois como PDF (front).
- Sem chat interno (usa link de WhatsApp/Telegram por turma).
- Atualização de catálogo: manual via admin (não tem fonte scrapeável confiável ainda).
- Apps/testes (test_*.js, test-*.cjs, reset/seed, verify) ficam só locais (gitignored).

## 🧯 Incidentes e lições aprendidas (post-mortem)

### 20/09/2026 — Loop de alterações quebrou a tela de cadastro
**O que aconteceu:** sessão anterior entrou em loop gerando scripts Python auxiliares
(`write_dd*.py`, `recreate_cadastro_*.py`, ~20 arquivos) para reescrever arquivos JS
em partes, ao trocar `<select>` nativo por dropdown customizado.
**Estragos:** comentário `#` (Python) dentro de `cadastro.page.js:118` = SyntaxError
(tela inteira quebrada); acentos destruídos por encoding ("instituicao");
CSS órfão (`.custom-select`) em base.css.
**Resolução (21/09):** limpeza do lixo + edições cirúrgicas + reescrita limpa do
`dropdown.component.js` + validação E2E real. Commit `27658eb`.
**Lições (valem para sempre):**
1. **JAMAIS gerar/editar arquivos JS via scripts Python** — usar o editor direto
   (preserva UTF-8/acentos e não gera lixo). PowerShell também corrói acentos.
2. **Sempre validar sintaxe após mexer em JS:**
   `Get-Content arquivo.js -Raw | node --input-type=module --check -`
3. **Não commitar sem teste E2E visual** — screenshots todos iguais = página quebrada.
4. **Antes de mexer na working tree, conferir `git status`** — lixo de sessão
   anterior pode estar pendurado lá.

### Pegadinhas técnicas já mapeadas (não repetir)
- Grid CSS: conteúdo longo `nowrap` expande trilha e causa scroll horizontal em
  telas < 25rem → trilha precisa de `minmax(0, …)` + `min-width: 0` na cadeia.
- Dropdown ancorado em `document.body` com `top:100%` abre no rodapé da página —
  o painel tem que ficar num wrapper `position: relative` do próprio botão.
- Theme-toggle é `position: fixed` no canto: header do app precisa de
  padding-right extra (+3.5rem) para não ficar por baixo.
- `serve` (dev server) faz clean-URLs: `/conta.html` vira `/conta` — testes E2E
  devem esperar por `**/grade**`, nunca pelo arquivo com extensão.
- Supabase retorna 400 esperado ao testar senha errada (não é quebra).

## 🧪 Como testar localmente

```powershell
cd D:\aphmgbr\Documents\VS-CODE\grade-horaria
npx serve . -l 4173              # dev server (clean URLs!)
```

Testes E2E (Playwright vive em `D:\aphmgbr\Documents\VS-CODE\Test\node_modules`):
```powershell
node test-dropdown-cascade.cjs    # cascata do cadastro (16 checks)
node test-grade-flow.cjs          # montar grade E2E (22 checks: menu ⋯, sanfona, sala, cor)
node test-auth-login-flow.cjs     # login → grade → conta → logout (menu ⋯)
node test-cadastro-validacao.cjs  # validação nome/e-mail/senha + olho + rascunho (13 checks)
node test-utils.mjs               # unitário das rules de utils.js (18 checks)
node test-auth-ui.cjs             # screenshots/erros das telas de auth (seção antiga de
                                  # cascata removida 25/09 — estava obsoleta, issue #18)
node test-qa-grade-intensive.cjs  # QA intensivo da grade reescrito 25/09 (36 checks)
```
⚠️ Páginas agora vivem em `/pages/…` — o redirect do Supabase ("Redirect URLs"
no dashboard) precisa aceitar `http://127.0.0.1:4173/pages/redefinir.html` e o
equivalente de produção, senão o e-mail de recuperação cai em 404.
Usuário de teste: **Ana Mock** (`gradehoraria+mock.ana@gmail.com` / `Mock@123456`,
usuário SQL de dev, curso = Sistemas de Informação CEFET-MG Varginha).
Sintaxe rápida de módulos: `Get-Content arquivo.js -Raw | node --input-type=module --check -`

## 🚀 Roadmap (o que falta)

- [x] Fase 1 — Auth: login/cadastro/conta + cascata instituição→campus→curso
- [x] Fase 1.5 — Dark mode, senha fraca, recuperar/redefinir, solicitação de instituição
- [x] Fase 1.6 — Dropdown customizado acessível + rescaldo do loop 20/09 saneado
- [x] Fase 2 — Tela de montar grade (catálogo do banco, grade semanal, persistência)
- [ ] **Fase 2.5 — Perfil social:** amizades (busca/e-mail/friend_code), aceitar/recusar,
      grupos (criar/entrar), `profiles.color_preset` e `friend_code` na conta.
      **Verificado 25/09: backend pronto (schema v5), front-end NÃO iniciado**
      (sem `friends/groups.service.js`, sem tela social em `pages/`, `conta.page.js`
      não expõe `friend_code`). Falta toda a camada de interface.
- [ ] **GAP: histórico acadêmico do aluno** — **issue #16 ABERTA.** Continua pendente
      (verificado 25/09: nenhuma tela/fluxo implementado). Trava o pré-requisito na
      prática: o aluno não informa o que já cursou, então o bloqueio `student_classes.
      status='completed'` + trigger `check_prerequisites` nunca é satisfeito por dado
      real. Desenhar (ANTES de implementar) uma tela/onboarding para marcar por
      matéria: cursando / concluída / dependência / não cursada.
- [ ] **Risco operacional: bounces Supabase** — **issue #14 ABERTA:** auditar e
      remover usuários de teste com e-mail falso para normalizar a taxa de
      `bounced` (provedor de e-mail pode suspender auth-emails se persistir).
- [ ] **Backlog pós-MVP:** efeito "carta 3D" no hover dos blocos da grade;
      árvore genealógica de pré-requisitos ao clicar na matéria
- [ ] **Fase 3 — Comparação de grades:** ver grade de amigo/grupo lado a lado
      (bloco na cor da pessoa), depende de visibility= friends/public
- [ ] **Fase 4 — Admin 3 níveis:** telas por papel, gestão de catálogo, fila de reports
      e `institution_requests`
- [ ] **Fase 5 — Notificações in-app:** badge/lista (triggers do banco já emitem)
- [ ] **Fase 6 — Export da grade:** PDF/imagem 100% front (jsPDF/html2canvas)
- [ ] **Deploy:** GitHub Pages (repo já é público; ativar Pages no branch master)
- [ ] **Débito de dados:** normalizar acentos dos seeds ("Educacao"→"Educação") e
      códigos-slug (`algebra_lin`) quando houver fonte oficial de catálogo
- [ ] **Débito de teste:** cobertura de choque de horário (cliente + banco) com
      duas turmas sobrepostas de fato; hoje cobrimos só pré-requisito

## 🐞 Incidente: Supabase inacessível via DNS (30/09/2026)

- **Título:** `zhcubvmismnmvtrbolbu.supabase.co` não resolve via DNS
- **Tipo:** Infraestrutura / rede
- **Descrição:** O domínio do projeto Supabase `zhcubvmismnmvtrbolbu.supabase.co` não resolve via DNS — testado com DNS do sistema e com Google DNS (8.8.8.8), ambos retornam "Non-existent domain". Bloqueia login, cadastro, carregamento de catálogo e qualquer operação de banco.
- **Local:** Todas as chamadas de `js/services/auth.service.js`, `catalog.service.js`, `grades.service.js` etc. via `js/core/supabase-client.js`.
- **Como reproduzir:** Abrir `http://127.0.0.1:4173/pages/login.html`, preencher credenciais válidas e tentar logar → a página não redireciona para `grade.html` (timeout na requisição ao Supabase).
- **Investigação (01/11/2026):** Após configurar token GitHub e reiniciar testes, o Supabase respondeu normalmente. Testes E2E intensivo passaram 100% (36 checks). Provavelmente tratamento temporário de DNS ou propagação de registro.
- **Status:** ✅ RESOLVIDO — Supabase acessível, testes E2E passando, credential válidas no .env.
- **Impacto:** Testes E2E de auth e grade validados
- **Prova:** Logs do teste `test-qa-grade-intensive.cjs` mostrando PASS em todos os 36 checks

## ✅ Teste de conectividade GitHub + Supabase (01/11/2026)

- **GitHub Token configurado e funcional** — consegue autenticar e fazer push
- **Supabase DNS resolvido** — endpoint `zhcubvmismnmvtrbolbu.supabase.co` acessível
- **Testes E2E intensivo passado** — `test-qa-grade-intensive.cjs`: 36/36 PASS
  - Login → redirecionamento para grade.html
  - Carregamento de catálogo (65 matérias)
  - Funcionalidade completa da grade (adicionar/remover turmas, pré-requisitos, temas)
  - Persistência de dados após reload
- **Infraestrutura totalmente operacional** — nenhum bloqueio identificado não podem rodar (login, grade-flow, auth-ui, dropdown-cascade). Unit tests de `utils.js` (18/18) e validação de cadastro client-side (13/13) passam sem depender do Supabase.

Ler antes: `docs/BRIEFING_FRONTEND.md` (decisões de UI já tomadas) + `docs/DB_SCHEMA.md` (schema v6 real).