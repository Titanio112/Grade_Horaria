/* ============================================================
   class-picker.component.js — Catálogo de matérias/turmas
   O que faz: renderiza a busca + lista de matérias do curso com
   suas turmas (horário resumido, professor) e o botão de
   adicionar/remover. Marca matérias bloqueadas por pré-requisito
   e turmas já matriculadas. Filtra por texto localmente.
   O que NÃO faz: NÃO fala com o Supabase (dados prontos via
   setData), NÃO decide conflito/choque — onToggle devolve a turma
   para a página decidir e persistir.
   API:
     createClassPicker({ container, onToggle })
     → { setData({ subjects, subjectById, enrolledIds, completedIds }) }
   Depende de: css/app.css (estilos) e nada mais.
   ============================================================ */

const DAY_SHORT = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

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

/**
 * @param {{container: HTMLElement, onToggle: (cls: object, subject: object, isEnrolled: boolean) => void}} config
 */
export function createClassPicker({ container, onToggle }) {
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'search-input';
  search.placeholder = 'Buscar matéria…';
  search.setAttribute('aria-label', 'Buscar matéria');

  const list = document.createElement('div');
  list.className = 'subject-list';

  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.hidden = true;

  container.append(search, list, empty);

  let state = {
    subjects: [],
    subjectById: new Map(),
    enrolledIds: new Set(),
    completedIds: new Set(),
  };

  /** Lista de nomes dos pré-requisitos pendentes de uma matéria. */
  function missingPrereqs(subject) {
    return subject.prerequisites
      .filter((id) => !state.completedIds.has(id))
      .map((id) => state.subjectById.get(id)?.name || id);
  }

  function render() {
    const query = search.value.trim().toLowerCase();
    list.innerHTML = '';
    let visible = 0;

    for (const subject of state.subjects) {
      if (query && !`${subject.name} ${subject.code}`.toLowerCase().includes(query)) continue;
      visible++;

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

      list.appendChild(card);
    }

    empty.hidden = visible > 0;
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
