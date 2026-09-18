# 📐 Schema do Banco de Dados v4 — Grade Horária BSI

> **Projeto Supabase:** `zhcubvmismnmvtrbolbu` | **Versão:** 4.0 (16/09/2026)
> **v4 acima da v3:** catálogo de salas anti-duplicata (`rooms` + `schedule_rooms`), coluna `room` removida de `class_schedules`, policy INSERT em profiles.

---

## 1. Visão Geral (ER)

```mermaid
erDiagram
    institutions ||--o{ campuses : "possui"
    campuses ||--o{ courses : "oferece"
    campuses ||--o{ professors : "corpo docente"
    courses ||--o{ subjects : "catalogo (sem professor)"
    subjects ||--o{ classes : "turmas"
    classes ||--o{ class_professors : "N professores"
    professors ||--o{ class_professors : "leciona em N turmas"
    classes ||--o{ class_schedules : "N blocos dia/hora"
    class_schedules ||--o{ schedule_rooms : "N salas"
    rooms ||--o{ schedule_rooms : "usada em N blocos"
    campuses ||--o{ rooms : "catalogo de salas"
    subjects ||--o{ subjects : "pre/co-requisitos (UUID[])"
    auth_users ||--|| profiles : "1:1"
    profiles ||--o{ grades : "grades por semestre"
    grades ||--o{ grade_subjects : "blocos visuais"
    grades ||--o{ student_classes : "matriculas (status/faltas)"
    classes ||--o{ student_classes : "alunos da turma"
```

## 2. Tabelas

### A. Hierarquia institucional
- **institutions** — id, name, acronym UNIQUE, state
- **campuses** — id, institution_id FK, name, city; UNIQUE(institution_id, name)
- **courses** — id, campus_id FK, name; UNIQUE(campus_id, name)

### B. profiles
id (FK auth.users CASCADE) | email | full_name | role enum | course_id FK | avatar_url | is_public (default true) | timestamps

### C. Catálogo normalizado
| Tabela | Colunas | Índices |
|---|---|---|
| **subjects** | id, code UNIQUE (interno), course_id FK, name, workload_hours CHECK(30/60/90), prerequisites UUID[], corequisites UUID[], description, is_active | PK, code |
| **professors** | id, name, campus_id FK; UNIQUE(name, campus_id) | **idx_professors_name** (busca textual) |
| **classes** | id, code UNIQUE (interno, ex: `prog1-A`), subject_id FK CASCADE, semester, social_group_link, is_active | |
| **class_professors** | class_id FK CASCADE, professor_id FK CASCADE; PK composta | N:N |
| **class_schedules** | id, class_id FK CASCADE, day_of_week INT CHECK(0-6), start_time TIME, end_time TIME, CHECK(start<end) | **idx_class_schedules_day**, **idx_class_schedules_start** |
| **rooms** | id, name, campus_id FK; **UNIQUE(name, campus_id) — anti-duplicata** | **idx_rooms_name** |
| **schedule_rooms** | schedule_id FK CASCADE, room_id FK CASCADE; PK composta | N:N horário↔sala |

### D. Aluno
- **grades** — student_id FK CASCADE, name, semester, year, is_active, is_public; UNIQUE(student_id, semester, year, is_active)
- **grade_subjects** — grade_id, subject_id FKs, day enum, time_start/end, classroom, color; UNIQUE(grade_id, subject_id)
- **student_classes** — grade_id FK CASCADE, class_id FK CASCADE, status CHECK(enrolled/completed/dropped/pending), final_grade, **absences** INT >= 0; UNIQUE(grade_id, class_id)

## 3. Travas de segurança no banco (triggers)

### 3.1 🔒 `trg_check_prerequisites` — BEFORE INSERT em `student_classes`
Bloqueia matrícula se faltar pré-requisito com `status='completed'` no histórico do aluno (qualquer grade). Erro 23514 com nomes das matérias faltantes.

### 3.2 ⏰ `trg_check_time_conflict` — BEFORE INSERT OR UPDATE em `student_classes`
Só avalia quando `status='enrolled'`. Para cada bloco `class_schedules` da turma nova, cruza com os blocos das turmas `enrolled` do aluno (todas as grades) no mesmo `day_of_week`:

**Conflito ⟺ (novo.start < velho.end) AND (velho.start < novo.end)** — fronteira exata (16:40 → 16:40) **NÃO** é conflito.
Erro 23514: `Choque de horario com a materia: <nome>`.

## 4. Faltas (regra de 25%)
Banco guarda só `student_classes.absences`. UI calcula: `reprovado = absences > 0.25 * subjects.workload_hours`.

## 5. RLS (34 policies)
- institutions/campuses/courses/professors/rooms/classes/class_professors/class_schedules/schedule_rooms: leitura pública, escrita admin
- subjects: ativas públicas; admin CRUD
- profiles: leitura pública (is_public) ou próprio; **INSERT do próprio**; UPDATE próprio; admin total
- grades: dono ou pública
- grade_subjects: segue grade
- student_classes: dono OU colega de turma (`shares_class()`)
- Anti-recursão: `is_admin()` e `shares_class()` SECURITY DEFINER
- Realtime: 9 tabelas

## 6. Provas automatizadas (regressão v4: 44/44)
| Bateria | Resultado |
|---|---|
| `test_api.js` (auth/RLS) | 6/6 |
| `test_trigger.js` (pré-requisitos) | 10/10 |
| `test_mock_flow.js` (fluxo completo, 3 alunos) | 16/16 |
| `test_normalization.js` | 12/12 |
| (A) busca cruzada matéria + professor + dia + **sala** | ✅ |
| (A2) filtro por sala S305 (19 blocos, todos em S305) | ✅ |
| (A3) bloco com 2 salas ("S116/S114" → 2 vínculos) | ✅ |
| (A4) UNIQUE rejeita sala duplicada (erro 23505) | ✅ |
| (B) 2 professores na mesma turma ("Weider/Marcelo" → 2 vínculos) | ✅ |
| (C) sequência exata 16:40→16:40 permitida | ✅ |
| (D) choque real bloqueado pelo banco | ✅ |

## 7. Scripts (`supabase/`)
| Script | Uso |
|---|---|
| `db.js` | conexão via `../.env` |
| `reset_schema.js` | reset destrutivo + aplica schema.sql |
| `seed_subjects.mjs` | 65 disciplinas → 65 subjects + 27 professores + 12 salas + 65 classes + 72 vínculos class_professors + 89 blocos + 86 vínculos schedule_rooms (idempotente, em lote) |
| `create_mock_users.js` / `cleanup_mocks.js` | usuários fictícios completos / limpeza em cascata |
| `test_mock_flow.js` | 16 testes de fluxo real |
| `test_normalization.js` | 8 testes de normalização/choque |
| `test_api.js` / `fix_users.js` / `describe_schema.js` | baterias auxiliares |