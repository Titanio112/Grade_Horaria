/* ============================================================
   select-cascade.component.js — <select> em cascata (3 níveis)
   O que faz: conecta três <select> (instituição → campus → curso),
   carregando cada nível quando o anterior muda, com estados de
   "Carregando…" / erro. Reutilizável em qualquer tela.
   O que NÃO faz: NÃO fala com o Supabase — quem busca os dados
   são os loaders injetados pela página (regra: componente nunca
   acessa services). Não decide o que acontece com o curso final.
   Depende de: nada além dos elementos e loaders recebidos.
   ============================================================ */

/**
 * Preenche um select com opções e um placeholder.
 * @param {HTMLSelectElement} select - elemento alvo.
 * @param {Array<{id:string, name:string}>} items - opções.
 * @param {string} placeholder - texto da opção vazia inicial.
 */
function fill(select, items, placeholder) {
  select.innerHTML = '';
  const first = new Option(placeholder, '');
  select.add(first);
  for (const item of items) {
    select.add(new Option(item.name, item.id));
  }
}

/**
 * Coloca um select em estado transitório (Carregando… / erro).
 * @param {HTMLSelectElement} select - elemento alvo.
 * @param {string} message - texto exibido na única opção.
 */
function setMessage(select, message) {
  select.innerHTML = '';
  select.add(new Option(message, ''));
}

/**
 * Cria a cascata instituição → campus → curso.
 * @param {object} config
 * @param {{institution: HTMLSelectElement, campus: HTMLSelectElement, course: HTMLSelectElement}} config.selects
 * @param {{institutions: () => Promise<Array>, campuses: (institutionId: string) => Promise<Array>, courses: (campusId: string) => Promise<Array>}} config.loaders
 * @returns {{getCourseId: () => string, selectHasError: () => boolean}}
 *   getCourseId: id do curso escolhido ('' se incompleto);
 *   selectHasError: true se algum nível falhou ao carregar.
 */
export function createSelectCascade({ selects, loaders }) {
  const { institution, campus, course } = selects;
  let loadError = false;

  campus.disabled = true;
  course.disabled = true;
  setMessage(campus, 'Selecione a instituição primeiro');
  setMessage(course, 'Selecione o campus primeiro');

  // Nível 1: instituições (carrega ao montar)
  setMessage(institution, 'Carregando…');
  institution.disabled = true;
  loaders.institutions()
    .then((items) => {
      fill(institution, items, 'Selecione a instituição');
      institution.disabled = false;
    })
    .catch(() => {
      loadError = true;
      setMessage(institution, 'Não foi possível carregar. Recarregue a página.');
    });

  institution.addEventListener('change', async () => {
    course.disabled = true;
    setMessage(course, 'Selecione o campus primeiro');
    if (!institution.value) {
      campus.disabled = true;
      setMessage(campus, 'Selecione a instituição primeiro');
      return;
    }
    campus.disabled = true;
    setMessage(campus, 'Carregando…');
    try {
      const items = await loaders.campuses(institution.value);
      fill(campus, items, 'Selecione o campus');
      campus.disabled = false;
    } catch {
      loadError = true;
      setMessage(campus, 'Não foi possível carregar.');
    }
  });

  campus.addEventListener('change', async () => {
    if (!campus.value) {
      course.disabled = true;
      setMessage(course, 'Selecione o campus primeiro');
      return;
    }
    course.disabled = true;
    setMessage(course, 'Carregando…');
    try {
      const items = await loaders.courses(campus.value);
      fill(course, items, 'Selecione o curso');
      course.disabled = false;
    } catch {
      loadError = true;
      setMessage(course, 'Não foi possível carregar.');
    }
  });

  return {
    getCourseId: () => course.value || '',
    selectHasError: () => loadError,
  };
}
