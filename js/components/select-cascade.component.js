/* ============================================================
   select-cascade.component.js — Dropdown customizado em cascata (3 níveis)
   O que faz: conecta três dropdowns customizados (instituição → campus → curso),
   carregando cada nível quando o anterior muda, com estados de
   "Carregando…" / erro. Reutilizável em qualquer tela.
   O que NÃO faz: NÃO fala com o Supabase — quem busca os dados
   são os loaders injetados pela página (regra: componente nunca
   acessa services). Não decide o que acontece com o curso final.
   Depende de: js/components/dropdown.component.js (createDropdown).
   ============================================================ */

import { createDropdown } from './dropdown.component.js';

/**
 * Preenche um dropdown com opções e um placeholder.
 * @param {object} dropdown - instância retornada por createDropdown.
 * @param {Array<{id:string, name:string}>} items - opções.
 * @param {string} placeholder - texto da opção vazia inicial.
 */
function fill(dropdown, items, placeholder) {
  dropdown.setOptions(
    items.map(i => ({ value: i.id, label: i.name })),
    placeholder // placeholder novo substitui o "Carregando…" inicial
  );
}

/**
 * Coloca um dropdown em estado transitório (Carregando… / erro).
 * @param {object} dropdown - instância retornada por createDropdown.
 * @param {string} message - texto exibido.
 */
function setMessage(dropdown, message) {
  dropdown.setOptions([{ value: '', label: message }]);
  dropdown.disable();
}

/**
 * Cria a cascata instituição → campus → curso usando dropdowns customizados.
 * @param {object} config
 * @param {{institution: HTMLElement, campus: HTMLElement, course: HTMLElement}} config.triggers
 *   Três elementos <button> que servirão de gatilho para os dropdowns.
 * @param {{institutions: () => Promise<Array>, campuses: (institutionId: string) => Promise<Array>, courses: (campusId: string) => Promise<Array>}} config.loaders
 * @returns {{getCourseId: () => string, selectHasError: () => boolean}}
 *   getCourseId: id do curso escolhido ('' se incompleto);
 *   selectHasError: true se algum nível falhou ao carregar.
 */
export function createSelectCascade({ triggers, loaders }) {
  const { institution: instTrigger, campus: campTrigger, course: courTrigger } = triggers;
  let loadError = false;

  // Cria os três dropdowns customizados
  const institutionDD = createDropdown({
    trigger: instTrigger,
    placeholder: 'Carregando…',
    required: true,
    onChange: (value) => {
      courseDD.disable();
      setMessage(courseDD, 'Selecione o campus primeiro');
      if (!value) {
        campusDD.disable();
        setMessage(campusDD, 'Selecione a instituição primeiro');
        return;
      }
      campusDD.disable();
      setMessage(campusDD, 'Carregando…');
      loaders.campuses(value)
        .then((items) => {
          fill(campusDD, items, 'Selecione o campus');
          campusDD.enable();
        })
        .catch(() => {
          loadError = true;
          setMessage(campusDD, 'Não foi possível carregar.');
        });
    },
  });

  const campusDD = createDropdown({
    trigger: campTrigger,
    placeholder: 'Selecione a instituição primeiro',
    required: true,
    onChange: (value) => {
      if (!value) {
        courseDD.disable();
        setMessage(courseDD, 'Selecione o campus primeiro');
        return;
      }
      courseDD.disable();
      setMessage(courseDD, 'Carregando…');
      loaders.courses(value)
        .then((items) => {
          fill(courseDD, items, 'Selecione o curso');
          courseDD.enable();
        })
        .catch(() => {
          loadError = true;
          setMessage(courseDD, 'Não foi possível carregar.');
        });
    },
  });

  const courseDD = createDropdown({
    trigger: courTrigger,
    placeholder: 'Selecione o campus primeiro',
    required: true,
    onChange: () => {},
  });

  // Campus e curso começam desabilitados até o nível anterior ser escolhido
  campusDD.disable();
  courseDD.disable();

  // Inicial: carrega instituições
  setMessage(institutionDD, 'Carregando…');
  institutionDD.disable();
  loaders.institutions()
    .then((items) => {
      fill(institutionDD, items, 'Selecione a instituição');
      institutionDD.enable();
    })
    .catch(() => {
      loadError = true;
      setMessage(institutionDD, 'Não foi possível carregar. Recarregue a página.');
    });

  return {
    getCourseId: () => courseDD.getValue(),
    selectHasError: () => loadError,
  };
}
