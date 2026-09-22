/* ============================================================
   form-draft.component.js — Rascunho automático de formulário
   O que faz: salva cada campo em sessionStorage a cada digitação
   (chave `gh-draft:<storageKey>:<fieldId>`), restaura ao abrir a
   página e limpa tudo quando o submit é concluído com sucesso.
   Segurança: NUNCA persistir senha — o chamador passa só os campos
   não sensíveis (nome, e-mail, texto da solicitação…).
   O que NÃO faz: não valida, não envia, não fala com o Supabase.
   sessionStorage (não localStorage): o rascunho morre ao fechar a
   aba — dado de formulário não deve morar no navegador para sempre.
   API:
     createFormDraft({ storageKey, fields }) → { clear() }
   Depende de: nada além dos elementos passados.
   ============================================================ */

function safeGet(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch { /* cheio/bloqueado: ignora */ }
}
function safeRemove(key) {
  try { sessionStorage.removeItem(key); } catch { /* idem */ }
}

/**
 * @param {{storageKey: string, fields: Array<HTMLInputElement|HTMLTextAreaElement>}} config
 * @returns {{clear: () => void}}
 */
export function createFormDraft({ storageKey, fields }) {
  const keyOf = (field) => `gh-draft:${storageKey}:${field.id}`;

  /* Restaura o que estava salvo (dispara 'input' para ligar handlers
     que dependam do evento, ex.: contadores/avisos). */
  for (const field of fields) {
    const saved = safeGet(keyOf(field));
    if (saved !== null && saved !== '') {
      field.value = saved;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /* Salva a cada digitação */
  for (const field of fields) {
    field.addEventListener('input', () => {
      if (field.value) safeSet(keyOf(field), field.value);
      else safeRemove(keyOf(field));
    });
  }

  return {
    /** Limpa o rascunho (chamar após submit bem-sucedido). */
    clear() {
      for (const field of fields) safeRemove(keyOf(field));
    },
  };
}
