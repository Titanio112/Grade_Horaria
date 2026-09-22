/* ============================================================
   weekly-grid.component.js — Grade semanal (Seg–Sáb, 7h–23h)
   O que faz: renderiza a grade de horários e os blocos das
   turmas matriculadas (posicionamento absoluto por minuto),
   com botão de remover em cada bloco. Cores vêm da paleta
   --block-N de css/tokens.css (cicla de 1 a 8).
   O que NÃO faz: NÃO fala com o Supabase, NÃO decide o que
   entra/sai — a página entrega os blocos prontos via setBlocks.
   API:
     createWeeklyGrid({ container, onRemove })
     → { setBlocks(blocks) }
     bloco: { classId, day (1=seg..6=sáb), startMin, endMin,
              title, subtitle, colorIndex }
   Depende de: css/app.css (estilos .wg-*) e css/tokens.css (cores).
   ============================================================ */

const DAYS = [
  { n: 1, label: 'Seg' },
  { n: 2, label: 'Ter' },
  { n: 3, label: 'Qua' },
  { n: 4, label: 'Qui' },
  { n: 5, label: 'Sex' },
  { n: 6, label: 'Sáb' },
];
const GRID_START_HOUR = 7;
const GRID_END_HOUR = 23;

/**
 * Monta a grade semanal dentro de `container`.
 * @param {{container: HTMLElement, onRemove: (classId: string) => void}} config
 * @returns {{setBlocks: (blocks: Array) => void, el: HTMLElement}}
 */
export function createWeeklyGrid({ container, onRemove = () => {} }) {
  const el = document.createElement('div');
  el.className = 'weekly-grid';

  /* Cabeçalho dos dias */
  const header = document.createElement('div');
  header.className = 'wg-header';
  header.appendChild(document.createElement('span')); // canto do gutter
  for (const d of DAYS) {
    const h = document.createElement('div');
    h.className = 'wg-day';
    h.textContent = d.label;
    header.appendChild(h);
  }
  el.appendChild(header);

  /* Corpo: gutter de horários + uma coluna por dia */
  const body = document.createElement('div');
  body.className = 'wg-body';

  const gutter = document.createElement('div');
  gutter.className = 'wg-gutter';
  const totalHours = GRID_END_HOUR - GRID_START_HOUR;
  for (let h = GRID_START_HOUR; h <= GRID_END_HOUR; h++) {
    const t = document.createElement('span');
    t.className = 'wg-time';
    t.style.top = `${((h - GRID_START_HOUR) / totalHours) * 100}%`;
    t.textContent = `${h}:00`;
    gutter.appendChild(t);
  }
  body.appendChild(gutter);

  const columns = new Map();
  for (const d of DAYS) {
    const col = document.createElement('div');
    col.className = 'wg-col';
    col.style.height = `calc(${totalHours} * var(--hour-h))`;
    col.dataset.day = String(d.n);
    body.appendChild(col);
    columns.set(d.n, col);
  }
  gutter.style.height = `calc(${totalHours} * var(--hour-h))`;

  el.appendChild(body);

  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.textContent = 'Grade vazia — adicione turmas pelo catálogo ao lado.';
  el.appendChild(empty);

  container.appendChild(el);

  function fmt(min) {
    const h = Math.floor(min / 60);
    const m = String(min % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  /**
   * Redesenha os blocos. Fora do intervalo 7h–23h o bloco é
   * cortado/clampado para não escapar do grid.
   */
  function setBlocks(blocks) {
    for (const col of columns.values()) col.innerHTML = '';
    empty.hidden = blocks.length > 0;

    const gridStart = GRID_START_HOUR * 60;
    const gridEnd = GRID_END_HOUR * 60;

    for (const b of blocks) {
      const col = columns.get(b.day);
      if (!col) continue;

      const start = Math.max(b.startMin, gridStart);
      const end = Math.min(b.endMin, gridEnd);
      if (end <= start) continue;

      const block = document.createElement('div');
      block.className = 'wg-block';
      block.style.top = `${((start - gridStart) / (totalHours * 60)) * 100}%`;
      block.style.height = `${((end - start) / (totalHours * 60)) * 100}%`;
      if (b.subjectColor) {
        /* Cor algorítmica da matéria (subjects.color, gerada por curso):
           fundo = tint suave, borda/texto = a cor misturada ao tema. */
        block.style.background = `color-mix(in srgb, ${b.subjectColor} 16%, var(--surface))`;
        block.style.borderColor = b.subjectColor;
        block.style.color = `color-mix(in srgb, ${b.subjectColor} 72%, var(--ink))`;
      } else {
        /* Fallback: paleta fixa --block-N (matéria sem cor gerada) */
        const n = (b.colorIndex % 8) + 1;
        block.style.background = `var(--block-${n}-bg)`;
        block.style.borderColor = `var(--block-${n}-border)`;
        block.style.color = `var(--block-${n}-text)`;
      }
      block.dataset.classId = b.classId;

      const title = document.createElement('span');
      title.className = 'b-title';
      title.textContent = b.title;

      /* Linha 1: horário + sala (a sala mora em schedule_rooms no banco) */
      const sub = document.createElement('span');
      sub.className = 'b-sub';
      const when = `${fmt(b.startMin)}–${fmt(b.endMin)}`;
      sub.textContent = b.room ? `${when} · ${b.room}` : (b.subtitle || when);

      block.append(title, sub);

      /* Linha 2: professor(es), quando existir */
      const profs = (b.professors || []).filter(Boolean).join(', ');
      if (profs) {
        const profLine = document.createElement('span');
        profLine.className = 'b-sub';
        profLine.textContent = profs;
        block.appendChild(profLine);
      }

      /* Tooltip com a ficha completa (útil quando o bloco é estreito/baixo) */
      const tipParts = [b.title, b.subtitle, when, b.room, profs].filter(Boolean);
      block.title = tipParts.join(' · ');

      const rm = document.createElement('button');
      rm.className = 'b-remove';
      rm.type = 'button';
      rm.title = `Remover ${b.title}`;
      rm.setAttribute('aria-label', `Remover ${b.title} da grade`);
      rm.textContent = '×';
      rm.addEventListener('click', () => onRemove(b.classId));

      block.appendChild(rm);
      col.appendChild(block);
    }
  }

  return { setBlocks, el };
}
