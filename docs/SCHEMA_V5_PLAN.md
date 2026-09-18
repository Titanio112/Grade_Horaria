# 🧩 SCHEMA V5 — Plano (NÃO APLICAR sem revisão do arquiteto)

> Data: 16/09/2026 | Base: schema v4 (14 tabelas) — tudo abaixo é **proposta**.

## 2.1 — Amizades e Grupos
```sql
friendships (
  id uuid PK,
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at, updated_at,
  CHECK (requester_id <> addressee_id)
)
-- anti-par-inverso: indice unico funcional em (LEAST(a,b), GREATEST(a,b))

profiles + friend_code text UNIQUE   -- codigo curto gerado no handle_new_user

groups (id uuid PK, name text NOT NULL, created_by uuid NOT NULL REFERENCES profiles(id),
        avatar_url text, created_at, updated_at)
group_members (group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
               profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
               joined_at timestamptz DEFAULT now(), PK(group_id, profile_id))
```
**RLS:**
- friendships: SELECT se for uma das pontas; INSERT se `requester=auth.uid()`; UPDATE (aceitar/recusar) só `addressee=auth.uid()`; DELETE das duas pontas.
- groups: SELECT só membros; INSERT autenticado; UPDATE só criador; group_members: INSERT só criador (convite fechado no MVP).
- Lookup por código: função `lookup_profile_by_code(text)` SECURITY DEFINER retornando só (id, nome, avatar) — evita varredura de perfis.

## 2.2 — Comparação/or cores
```sql
profiles + color_preset text NOT NULL DEFAULT 'blue'  -- paleta fechada no front
```
Sem tabela nova. Visão individual usa `grade_subjects.color`; comparação usa `profiles.color_preset`. Preset garante contraste/a11y.

## 2.3 — Privacidade em 3 níveis (mudança real de schema)
```sql
CREATE TYPE grade_visibility AS ENUM ('private','friends','public');
-- grades: REMOVER is_public; + visibility grade_visibility NOT NULL DEFAULT 'private'
```
**Policies reescritas (grades + grade_subjects):** SELECT se dono | `public` | (`friends` AND friendship accepted) | admin. Helper `is_friend(uuid,uuid)` SECURITY DEFINER.
**Nota:** `shares_class` (colegas de turma) permanece — visibilidade de "quem cursa comigo" é separada da visibilidade da grade (decisão). Migração de dados: `is_public=true` → `public`, senão `private`.

## 2.4 — Administração em 3 níveis (delegação rastreada)
```sql
CREATE TYPE admin_level AS ENUM ('super','institution','course');

admin_grants (
  id uuid PK,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level admin_level NOT NULL,
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE, -- obrigatorio se 'institution'
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,           -- obrigatorio se 'course'
  granted_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, level, institution_id, course_id),
  CHECK (
    (level='super'       AND institution_id IS NULL     AND course_id IS NULL) OR
    (level='institution' AND institution_id IS NOT NULL AND course_id IS NULL) OR
    (level='course'      AND course_id IS NOT NULL)
  )
)
```
**Funções SECURITY DEFINER:** `is_super_admin()`, `is_institution_admin(uuid)`, `is_course_admin(uuid)`, `grant_admin(perfil, level, inst, curso)` — a função implementa a cascata: só super concede instituição; só admin-de-instituição concede curso da própria instituição; ninguém concede nível >= ao próprio; grava `granted_by`.
**Policies do catálogo reescritas:** campuses/courses/subjects/professors/rooms/classes/class_professors/class_schedules/schedule_rooms passam a checar escopo (super → tudo; institution → própria inst; course → próprio curso).
**Seed antecipado:** `handle_new_user` concede `super` a `aphmgbr@gmail.com`.

## 2.5 — Notificações
```sql
notifications (
  id uuid PK,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,             -- 'schedule_changed','professor_changed','friend_request',...
  title text NOT NULL, body text, payload jsonb DEFAULT '{}',
  read_at timestamptz, created_at timestamptz DEFAULT now()
)
```
**Origem:** triggers AFTER UPDATE em `classes` e `class_schedules` (+ schedule_rooms) → INSERT p/ todo aluno `enrolled` na turma. E-mail: Edge Function + provider; no MVP o in-app basta (SMTP depende do bloqueador da Parte 1).

## 2.6 — Exportar/imprimir grade
Sem schema. PDF/imagem é front-end (jsPDF/print CSS). JSON import/export **não volta**.

## 2.7 — Aviso de responsabilidade + report
```sql
reports (
  id uuid PK,
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at, resolved_at, resolved_by uuid REFERENCES profiles(id)
)
```
RLS: INSERT autenticado; SELECT = autor + admin do escopo; UPDATE status = admin do escopo. Roteamento: report → turma → subject → course → institution → admin correspondente.

## 2.8 — Cadastro com escolha de instituição
Sem mudança de schema: `profiles.course_id` já existe e hierarquia institutions/campi/courses já é pública para SELECT. Só fluxo de UI.

## Perguntas abertas para o arquiteto
1. Grupo: exigir que todo membro já seja amigo do criador ao ser convidado? (MVP: não)
2. `profiles.is_public` (ser encontrado na busca) convive separado de `grades.visibility`? Proposta: sim.
3. Dedup de notificações por turma+dia (anti-spam quando admin faz edições em sequência)? Recomendo sim.
4. E-mail de notificação no MVP ou só in-app? (depende do SMTP — bloqueador Parte 1)
5. Formato do `friend_code`: sugiro 6 chars alfanumérico uppercase com retry em colisão.
6. Paleta de cores `color_preset`: eu sugiro a minha ou você define?
7. Quer que eu gere o SQL de migração v5 com rollback junto (downgrade script)?
8. Parte 2.9 (longo prazo, não implementar): scraper de PDFs oficiais do CEFET — registrar como ideia futura.

## Checklist de aplicação (quando aprovado)
1. migrations: enum visibility + drop is_public + dados migrados
2. profiles + friend_code + color_preset
3. friendships/groups/group_members + RLS + lookup_profile_by_code
4. admin_grants + funções de escopo + grant_admin + policies reescritas + seed super (Antônio)
5. notifications + triggers de mudança de turma
6. reports + roteamento por escopo
7. novas baterias: testes de privacidade 3 níveis, delegação admin, notificações
8. Documentar em DB_SCHEMA.md v5 + BACKEND_AUDIT v5

## Nada aplicado. Aguardando revisão.