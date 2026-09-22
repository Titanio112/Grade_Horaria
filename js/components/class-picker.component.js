/* ============================================================
   class-picker.component.js — Catálogo de matérias/turmas
   O que faz: renderiza a busca + lista de matérias do curso com
   suas turmas (horário resumido, professor) e o botão de
   adicionar/remover. Marca matérias bloqueadas por pré-requisito
   e turmas já matriculadas. Filtra por texto localmente.
   Agrupa por semestre em gavetas (accordion, animação de mola) e
   oferece ordenação: 1º→último semestre (padrão), último→1º,
   alfabética (lista plana, comportamento antigo).
   O que NÃO faz: NÃO fala com o Supabase (dados prontos via
   setData), NÃO decide conflito/choque — onToggle devolve a turma
   para a página decidir e persistir.
   API:
     createClassPicker({ container, onToggle })
     → { setData({ subjects, subjectById, enrolledIds, completedIds }) }
   Depende de: css/app.css, css/components.css, css/motion.css e
   js/components/dropdown.component.js (seletor de ordenação).
   ============================================================ */

import { createDropdown } from './dropdown.component.js';

const DAY_SHORT = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

const SORT_OPTIONS = [
  { value: 'semester-asc', label: 'Semestre: 1º → último' },
  { value: 'semester-desc', label: 'Semestre: último → 1º' },
  { value: 'alpha', label: 'Ordem alfabética' },
];

function fmt(min) {
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** "Seg 07:30–09:10 · Qui 07:30–09:10" */
function scheduleSummary(schedules) {
  return schedules
    .map((s) => `${DAY_SHORT[s.day] || s.day} ${fmt(s.startMin)}–${fmt(s.endMin)}`)
    .join(' · ');
}

/** Semestre da matéria = menor semestre entre suas turmas (ou null). */
function semesterOf(subject) {
  const semesters = subject.classes
    .map((c) => c.semester)
    .filter((s) => Number.isFinite(s));
  return semesters.length ? Math.min(...semesters) : null;
}

/**
 * @param {{container: HTMLElement, onToggle: (cls: object, subject: object, isEnrolled: boolean) => void}} config
 */
export function createClassPicker({ container, onToggle }) {
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'search-input';
  search.placeholder = 'Buscar matéria…';
  search.setAttribute('aria-label', 'Buscar matéria');

  /* Seletor de ordenação (dropdown customizado, padrão do site) */
  const sortTrigger = document.createElement('button');
  sortTrigger.type = 'button';
  sortTrigger.className = 'sort-trigger';
  const sortWrap = document.createElement('div');
  sortWrap.className = 'sort-wrap';
  sortWrap.appendChild(sortTrigger);

  const list = document.createElement('div');
  list.className = 'subject-list';

  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.hidden = true;

  container.append(search, sortWrap, list, empty);

  let state = {
    subjects: [],
    subjectById: new Map(),
    enrolledIds: new Set(),
    completedIds: new Set(),
  };
  let sortMode = 'semester-asc';
  /* Gavetas RECOLHIDAS pelo usuário (chave = número ou 'none').
     Padrão: tudo começa ABERTO; o usuário pode recolher. */
  const closedSemesters = new Set();

  const sortDD = createDropdown({
    trigger: sortTrigger,
    placeholder: 'Ordenar por…',
    options: SORT_OPTIONS,
    onChange: (value) => {
      if (value) { sortMode = value; render(); }
    },
  });
  sortDD.setValue('semester-asc');

  /** Lista de nomes dos pré-requisitos pendentes de uma matéria. */
  function missingPrereqs(subject) {
    return subject.prerequisites
      .filter((id) => !state.completedIds.has(id))
      .map((id) => state.subjectById.get(id)?.name || id);
  }

  /** Monta o cartão de uma matéria (inalterado em relação à lista plana). */
  function buildCard(subject) {
      const card = document.createElement('article');
      card.className = 'subject-card';

      const head = document.createElement('div');
      head.className = 'subject-head';
      const name = document.createElement('span');
      name.className = 'subject-name';
      name.textContent = subject.name;
      const meta = document.createElement('span');
      meta.className = 'subject-meta';
      meta.textContent = `${subject.code} · ${subject.workloadHours}h`;
      head.append(name, meta);
      card.appendChild(head);

      const missing = missingPrereqs(subject);
      const hasEnrolled = subject.classes.some((c) => state.enrolledIds.has(c.id));

      if (missing.length > 0) {
        const chip = document.createElement('span');
        chip.className = 'chip chip--blocked';
        chip.title = `Falta concluir: ${missing.join(', ')}`;
        chip.textContent = `Pré-requisito: ${missing.join(', ')}`;
        card.appendChild(chip);
      } else if (hasEnrolled) {
        const chip = document.createElement('span');
        chip.className = 'chip chip--enrolled';
        chip.textContent = 'Na sua grade';
        card.appendChild(chip);
      }

      for (const cls of subject.classes) {
        const row = document.createElement('div');
        row.className = 'class-row';

        const info = document.createElement('div');
        info.className = 'class-info';
        const code = document.createElement('span');
        code.className = 'class-code';
        code.textContent = cls.code + (cls.professors.length ? ` — ${cls.professors.join(', ')}` : '');
        const when = document.createElement('span');
        when.className = 'class-when tnum';
        when.textContent = scheduleSummary(cls.schedules) || 'Horário a definir';
        info.append(code, when);

        const isEnrolled = state.enrolledIds.has(cls.id);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-icon' + (isEnrolled ? ' btn-icon--remove' : '');
        btn.textContent = isEnrolled ? '−' : '+';
        btn.title = isEnrolled ? `Remover ${subject.name}` : `Adicionar ${subject.name}`;
        btn.setAttribute('aria-label', btn.title);
        btn.addEventListener('click', () => onToggle(cls, subject, isEnrolled));

        row.append(info, btn);
        card.appendChild(row);
      }

      return card;
  }

  /** Cria o cabeçalho+gaveta de um semestre (accordion acessível). */
  function buildSemesterGroup(semester, cards, forceOpen) {
    const key = semester === null ? 'none' : String(semester);
    const isOpen = forceOpen || !closedSemesters.has(key);

    const groupEl = document.createElement('section');
    groupEl.className = 'semester-group' + (isOpen ? ' is-open' : '');

    const headerBtn = document.createElement('button');
    headerBtn.type = 'button';
    headerBtn.className = 'semester-header';
    headerBtn.setAttribute('aria-expanded', String(isOpen));

    const title = document.createElement('span');
    title.textContent = semester === null ? 'Sem semestre definido' : `${semester}º semestre`;

    const right = document.createElement('span');
    right.className = 'semester-right';
    const count = document.createElement('span');
    count.className = 'semester-count';
    count.textContent = `${cards.length} matéria${cards.length === 1 ? '' : 's'}`;
    const chevron = document.createElement('span');
    chevron.className = 'semester-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = '<svg width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M1 1l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    right.append(count, chevron);
    headerBtn.append(title, right);

    headerBtn.addEventListener('click', () => {
      const nowOpen = groupEl.classList.toggle('is-open');
      headerBtn.setAttribute('aria-expanded', String(nowOpen));
      if (nowOpen) closedSemesters.delete(key);
      else closedSemesters.add(key);
    });

    const panel = document.createElement('div');
    panel.className = 'semester-panel';
    const bodyInner = document.createElement('div');
    bodyInner.className = 'semester-body';
    for (const card of cards) bodyInner.appendChild(card);
    panel.appendChild(bodyInner);

    groupEl.append(headerBtn, panel);
    return groupEl;
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    list.innerHTML = '';

    const visibleSubjects = state.subjects.filter(
      (subject) => !query || `${subject.name} ${subject.code}`.toLowerCase().includes(query));

    if (sortMode === 'alpha') {
      /* Lista plana (comportamento original), ordem alfabética */
      for (const subject of visibleSubjects) list.appendChild(buildCard(subject));
    } else {
      /* Agrupa por semestre em gavetas; dentro da gaveta, alfabética */
      const groups = new Map();
      for (const subject of visibleSubjects) {
        const sem = semesterOf(subject);
        if (!groups.has(sem)) groups.set(sem, []);
        groups.get(sem).push(subject);
      }
      const semesters = [...groups.keys()].sort((a, b) => {
        if (a === null) return 1;
        if (b === null) return -1;
        return sortMode === 'semester-desc' ? b - a : a - b;
      });
      for (const sem of semesters) {
        const cards = groups.get(sem).map(buildCard);
        /* Com busca ativa, abre todas as gavetas com resultado */
        list.appendChild(buildSemesterGroup(sem, cards, query !== ''));
      }
    }

    empty.hidden = visibleSubjects.length > 0;
    empty.textContent = query
      ? `Nenhuma matéria encontrada para “${query}”.`
      : 'Nenhuma matéria com turmas ativas neste curso.';
  }

  search.addEventListener('input', render);

  return {
    /** Atualiza dados e redesenha mantendo o texto da busca. */
    setData: ({ subjects, subjectById, enrolledIds, completedIds }) => {
      state = { subjects, subjectById, enrolledIds, completedIds };
      render();
    },
    el: list,
  };
}
