/**
 * grade.page.js — Tela de montar grade (grade.html).
 *
 * O que faz: exige sessão (senão vai para login), resolve o curso do
 * aluno (com backfill igual ao da conta), carrega o catálogo do curso
 * via catalog.service, garante a grade ativa via grades.service e
 * orquestra os componentes (catálogo à esquerda, grade semanal à
 * direita). Checa pré-requisito e choque de horário no cliente antes
 * de salvar (o banco também trava — aqui é só UX).
 * O que NÃO faz: não fala com o Supabase diretamente (só via
 * services), não contém CSS.
 * Depende de: js/services/{auth,profiles,catalog,grades}.service.js,
 * js/components/{class-picker,weekly-grid,dropdown,theme-toggle}.js.
 */

import { getSession, signOut } from '../services/auth.service.js';
import { getMyProfile, ensureProfileCourse } from '../services/profiles.service.js';
import { listCatalog, listCompletedSubjectIds } from '../services/catalog.service.js';
import {
  getOrCreateActiveGrade,
  listEnrolledClassIds,
  addClass,
  removeClass,
  setGradeVisibility,
} from '../services/grades.service.js';
import { createClassPicker } from '../components/class-picker.component.js';
import { createWeeklyGrid } from '../components/weekly-grid.component.js';
import { createDropdown } from '../components/dropdown.component.js';
import { createHeaderMenu } from '../components/header-menu.component.js';
import { mountThemeToggle } from '../components/theme-toggle.component.js';

const pickerSlot = document.getElementById('class-picker');
const gridSlot = document.getElementById('weekly-grid');
const summaryEl = document.getElementById('grade-summary');
const statusEl = document.getElementById('grade-status');

/** Estado da tela (só a página conhece). */
const state = {
  subjects: [],
  subjectById: new Map(),
  classIndex: new Map(),   // classId → { subject, cls }
  enrolledIds: new Set(),
  completedIds: new Set(),
  grade: null,
};

let grid = null;
let picker = null;

/** Exibe/limpa mensagem de status (erro ou info). */
function showStatus(message, kind = 'error') {
  statusEl.textContent = message || '';
  statusEl.className = `page-status page-status--${kind}`;
  statusEl.hidden = !message;
}

/** Turma colide com algo já matriculado? Retorna a matéria conflitante ou null. */
function findConflict(candidate) {
  for (const classId of state.enrolledIds) {
    const entry = state.classIndex.get(classId);
    if (!entry) continue;
    for (const a of candidate.schedules) {
      for (const b of entry.cls.schedules) {
        if (a.day === b.day && a.startMin < b.endMin && b.startMin < a.endMin) {
          return entry.subject.name;
        }
      }
    }
  }
  return null;
}

/** Consistência visual: redesenha catálogo, grid e resumo. */
function renderAll() {
  picker.setData({
    subjects: state.subjects,
    subjectById: state.subjectById,
    enrolledIds: state.enrolledIds,
    completedIds: state.completedIds,
  });

  const blocks = [];
  const enrolledSubjects = new Set();
  for (const classId of state.enrolledIds) {
    const entry = state.classIndex.get(classId);
    if (!entry) continue;
    enrolledSubjects.add(entry.subject.id);
    const subjectIndex = state.subjects.findIndex((s) => s.id === entry.subject.id);
    for (const sc of entry.cls.schedules) {
      blocks.push({
        classId,
        day: sc.day,
        startMin: sc.startMin,
        endMin: sc.endMin,
        title: entry.subject.name,
        subtitle: entry.cls.code,
        room: (sc.rooms || []).join(', '),
        professors: entry.cls.professors || [],
        subjectColor: entry.subject.color || null,
        colorIndex: Math.max(0, subjectIndex),
      });
    }
  }
  grid.setBlocks(blocks);

  const hours = [...enrolledSubjects].reduce(
    (sum, id) => sum + (state.subjectById.get(id)?.workloadHours || 0), 0);
  summaryEl.textContent =
    `${state.enrolledIds.size} turma${state.enrolledIds.size === 1 ? '' : 's'} · ${hours}h/semana`;
}

/** Adiciona ou remove turma, com validações locais e erro amigável. */
async function toggleClass(cls, subject, isEnrolled) {
  showStatus('', 'error');

  if (isEnrolled) {
    const { error } = await removeClass(state.grade.id, cls.id);
    if (error) {
      showStatus('Não consegui remover a turma. Tente de novo.');
      return;
    }
    state.enrolledIds.delete(cls.id);
    renderAll();
    return;
  }

  // 1) Pré-requisitos (o banco também bloqueia; aqui explicamos antes)
  const missing = subject.prerequisites
    .filter((id) => !state.completedIds.has(id))
    .map((id) => state.subjectById.get(id)?.name || id);
  if (missing.length > 0) {
    showStatus(`Pré-requisito pendente para “${subject.name}”: ${missing.join(', ')}.`);
    return;
  }

  // 2) Choque de horário
  const conflict = findConflict(cls);
  if (conflict) {
    showStatus(`Choque de horário com “${conflict}”.`);
    return;
  }

  // 3) Persiste (o banco é a autoridade final)
  const { error, friendlyError } = await addClass(state.grade.id, cls.id);
  if (error) {
    showStatus(friendlyError);
    return;
  }
  state.enrolledIds.add(cls.id);
  renderAll();
}


async function init() {
  const session = await getSession();
  if (!session) {
    window.location.replace('login.html');
    return;
  }

  const { data: profile } = await getMyProfile(session.user.id);
  const { courseId } = profile
    ? await ensureProfileCourse(session.user, profile)
    : { courseId: null };
  const effectiveCourseId = profile?.course_id || courseId;

  if (!effectiveCourseId) {
    showStatus('Ainda não sabemos seu curso. Abra a página Conta para concluir o cadastro do perfil.');
    return;
  }

  const [catalogRes, completedRes, gradeRes] = await Promise.all([
    listCatalog(effectiveCourseId),
    listCompletedSubjectIds(session.user.id),
    getOrCreateActiveGrade(session.user.id),
  ]);

  if (catalogRes.error) {
    showStatus('Não foi possível carregar o catálogo do seu curso. Recarregue a página.');
    return;
  }
  if (gradeRes.error || !gradeRes.data) {
    showStatus('Não foi possível abrir sua grade. Recarregue a página.');
    return;
  }

  state.subjects = catalogRes.data.subjects;
  state.subjectById = catalogRes.data.byId;
  state.completedIds = completedRes.data || new Set();
  state.grade = gradeRes.data;
  for (const subject of state.subjects) {
    for (const cls of subject.classes) {
      state.classIndex.set(cls.id, { subject, cls });
    }
  }

  const enrolledRes = await listEnrolledClassIds(state.grade.id);
  state.enrolledIds = enrolledRes.data || new Set();

  grid = createWeeklyGrid({ container: gridSlot, onRemove: (classId) => {
    const entry = state.classIndex.get(classId);
    if (entry) toggleClass(entry.cls, entry.subject, true);
  }});
  picker = createClassPicker({ container: pickerSlot, onToggle: toggleClass });

  renderAll();

  /* Visibilidade da grade (private/friends/public) — dropdown customizado */
  const visibilityDD = createDropdown({
    trigger: document.getElementById('visibility-trigger'),
    placeholder: 'Visibilidade',
    options: [
      { value: 'private', label: '🔒 Só eu' },
      { value: 'friends', label: '👥 Amigos' },
      { value: 'public', label: '🌐 Pública' },
    ],
    onChange: async (value) => {
      if (!value || value === state.grade.visibility) return;
      const { error } = await setGradeVisibility(state.grade.id, value);
      if (error) {
        showStatus('Não consegui mudar a visibilidade. Tente de novo.');
        visibilityDD.setValue(state.grade.visibility);
        return;
      }
      state.grade.visibility = value;
    },
  });
  visibilityDD.setValue(state.grade.visibility || 'private');

  /* Header: menu ⋯ (Minha grade / Conta / Sair) + toggle de tema inline */
  const menu = createHeaderMenu({
    container: document.getElementById('header-menu-slot'),
    links: [
      { href: 'grade.html', label: 'Minha grade', current: true },
      { href: 'conta.html', label: 'Conta' },
    ],
    onLogout: async () => {
      menu.logoutButton.disabled = true;
      menu.logoutButton.textContent = 'Saindo…';
      await signOut();
      window.location.replace('login.html');
    },
  });

  /* Aviso não-obstrutivo quando a grade é recém-criada e vazia */
  if (enrolledRes.data && enrolledRes.data.size === 0) {
    showStatus('Grade pronta! Adicione turmas pelo catálogo ao lado.', 'info');
  }
}

init();
mountThemeToggle(document.getElementById('theme-toggle-slot'));

