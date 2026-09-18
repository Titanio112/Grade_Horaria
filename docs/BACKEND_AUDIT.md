# 🛡️ BACKEND_AUDIT.md — Auditoria Final e Sign-off do Backend

> **Projeto:** Grade Horária BSI | **Banco:** Supabase `zhcubvmismnmvtrbolbu` | **Data:** 16/09/2026
> **Escopo:** auditoria severa de backend (esta auditoria NÃO tocou em UI — nenhuma linha de HTML/CSS/DOM).
> **Veredito geral: ✅ APROVADO PARA UI** (backend resistiu a todos os ataques planejados).

---

## Checklist de Garantia (todas as funcionalidades mapeadas)

### Auth & Perfis
| # | Item | Resultado | Evidência |
|---|---|---|---|
| 1 | Signup cria perfil automaticamente (trigger `handle_new_user`) | ✅ | test_api.js |
| 2 | Login emite JWT (claims `role=authenticated`) | ✅ | test_api.js |
| 3 | Admin automático para email mestre | ✅ | schema.handle_new_user |
| 4 | Usuário legado consegue recriar o próprio perfil (policy INSERT) | ✅ | corrigido na v4 |

### RLS (34 policies)
| # | Item | Resultado |
|---|---|---|
| 5 | Anônimo lê catálogo (subjects/classes/classes_schedules publics) | ✅ |
| 6 | Anônimo NÃO escreve em `grades`/`student_classes` | ✅ |
| 7 | Aluno vê grade pública de colega / não vê privada | ✅ |
| 8 | Colegas de turma (shares_class) visíveis só dentro da mesma turma | ✅ |
| 9 | DELETE fora do escopo não apaga dados de terceiros | ✅ |

### Regras de negócio no banco (triggers)
| # | Trava | Resultado |
|---|---|---|
| 10 | `trg_check_prerequisites`: bloqueia matrícula sem pré-req `completed` | ✅ |
| 11 | `trg_check_prerequisites`: libera após completar pré-reqs | ✅ |
| 12 | `trg_check_time_conflict`: bloqueia choque real (mesma grade) | ✅ |
| 13 | `trg_check_time_conflict`: **bloqueia choque cross-grade** (grade pública × grade privada, mesmo aluno) | ✅ |
| 14 | Fronteira exata (aula B começa quando A termina) é permitida | ✅ |

### Integridade de dados
| # | Ataque tentado | Resultado |
|---|---|---|
| 15 | Classe sem subject existente | 🚫 23503 |
| 16 | Professor sem campus | 🚫 23503 |
| 17 | Sala sem campus | 🚫 23503 |
| 18 | Matrícula com FKs inexistentes | 🚫 P0001 (trigger) / 23503 (FK) — defesa em camadas |
| 19 | Sala duplicada no mesmo campus | 🚫 23505 (UNIQUE) |
| 20 | `absences` negativo | 🚫 CHECK constraint |
| 21 | `status` fora do enum | 🚫 CHECK constraint |
| 22 | `class_schedules` com end < start | 🚫 CHECK constraint |
| 23 | Deletar subject → classes, schedules e matrículas limpas em CASCATA (sem órfãos) | ✅ |

## Correções feitas durante a auditoria
- **Nenhuma falha de segurança do banco** foi exposta. Os únicos "fails" iniciais eram expectativas do teste, não do banco:
  1. `student_classes` com FKs nulas caía no **trigger antes da FK** (P0001) → assert ajustado, comportamento correto = linha nunca entra.
  2. DELETE sem filtro via PostgREST retorna 400 (proteção do PostgREST) → substituído por prova de contagem global intacta.
- **Correção real anterior já validada:** policy `INSERT` em profiles (v4).

## Notas de design confirmadas
- Regra dos 25% de faltas fica **na UI** por decisão arquitetural (banco guarda só o contador `absences`).
- Choque de horário é **cross-grade** (mesmo em grade privada). Intencional.
- Rate limit de email do Supabase free exige `create_mock_users.js` para testes em massa.

## Resumo da bateria (esta auditoria)
| Suite | Resultado |
|---|---|
| test_api.js | 6/6 |
| test_trigger.js | 10/10 |
| test_mock_flow.js | 16/16 |
| test_normalization.js | 12/12 |
| **test_stress.js (auditoria de edge cases)** | **17/17** |
| **TOTAL GERAL** | **61/61 — SEM FALHAS** |

**Assinatura QA:** Backend blindado. Próximo passo permitido: UI (login/cadastro) sem receio.