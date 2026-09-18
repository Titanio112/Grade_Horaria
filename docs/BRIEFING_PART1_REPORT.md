# 📋 Relatório — Parte 1 (Verificação Independente)

> Data: 16/09/2026 | Método: queries diretas no Postgres + API REST real + inspeção do histórico git.
> Script reproduzível: `supabase/verify_part1.js` (6/6 PASS).

## Estado vivo do banco (evidência: `verify_part1.js`)
- **14 tabelas, 33 policies, 6 funções, 13 triggers** — RLS ativo em **14/14** tabelas ✅
- Dados: 1 instituição, 1 campus, 1 curso, 65 subjects, 27 professors, 12 rooms, 65 classes, 89 schedules, 86 schedule_rooms, 72 class_professors ✅
- Índices de busca presentes: `idx_class_schedules_day`, `idx_class_schedules_start`, `idx_professors_name`, `idx_rooms_name` ✅

## Itens pendentes (respostas com evidência)

### 1. Rotação de senha — ❌ NÃO FEITA (bloqueador)
- Evidência A: o script `check_state.js` conecta **agora** com a senha vazada (`***REMOVED_DB_PASSWORD***`) — ou seja, ela **continua ativa**.
- Evidência B: `git rev-list --all` + grep → a senha existe em **3 commits** (`22c763e`, `abde588`, `f0dee96` no arquivo `supabase/execute_schema.js`).
- **Ação necessária (antes de públicar):** (a) rotacionar a senha no dashboard Supabase; (b) reescrever o histórico (`git filter-repo --replace-text`) **antes** do primeiro push — hoje o remoto sequer recebeu push (ver item 6), então é a janela perfeita.
- Anon key exposta: ok por design (RLS protege). Senha do banco: não pode vazar.

### 2. Rate limit de e-mail / SMTP — ⚠️ RISCO REAL para lançamento
- Não há como configurar SMTP custom via SQL/REST — depende do dashboard (Settings → Auth → SMTP Custom) ou do plano pago.
- Plano free sem SMTP custom: ~4 e-mails/hora → bloqueador se houver muitos cadastros simultâneos.
- **Recomendação:** antes do lançamento, configurar SMTP custom (Resend/Brevo têm free tier generoso) OU desligar "Confirm email" (trades segurança). Decisão sua.

### 3. Import/Export JSON removido — ✅ CONFIRMADO
- `index.html`, `logica.js`, `render.js` não contêm mais `exportJSON`/`processPastedJSON`/`paste-area` (grep vazio). Decisão documentada. Export volta na Parte 2 (2.6) como PDF/imagem — encaixa.

### 4. Painel admin hoje vs. Parte 2 — ✅ BASE EXISTE
- Hoje: CRUD só via `schema.sql`/seed/pg. Reaproveitável da Parte 2: `is_admin()` (SECURITY DEFINER), policy "Admin CRUD" em 8 tabelas, `handle_new_user` com promoção automática, trigger de updated_at.
- **A implementar na v5:** papéis em 3 níveis (2.4) + `admin_grants` com `granted_by` (rastreio) + policies reescritas por escopo.

### 5. Multi-instituição — ✅ CONFIRMADO AO VIVO
- Criei uma 2ª instituição fictícia completa (UFQA: campus/curso/subject/professor/sala/turma/horário/vínculos).
- API anônima leu as 2 instituições (`CEFET-MG + UFQA`), catálogo misto (66 subjects), e duas salas "S305" (uma por campus) coexistiram sem colisão.
- Cleanup em cascata removeu tudo → banco voltou a 1 instituição. **Schema prova-se multi-tenant.**

### 6. Commits no remoto — ❌ NÃO PUSHADO
- `git ls-remote origin` → "Repository not found": o remoto `aphmgbr/grade-horaria` não existe/não está acessível e **nenhum commit subiu** (bom: o segredo no histórico não vazou para fora da máquina, mas só se o repo nunca foi público antes — confirmar).
- **Sequência obrigatória:** rotacionar senha → reescrever histórico → criar repo remoto → push.

## Veredito da Parte 1
**Backend: tecnicamente aprovado e confere com os relatórios.** Bloqueadores de Lançamento (não de dev): senha vazada (rotação+rewrite) e SMTP. Multi-instituição comprovada. Parte 2 pode começar com esses 2 pontos em aberto.
