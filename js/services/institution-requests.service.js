/* ============================================================
   institution-requests.service.js — Pedidos de nova instituição
   O que faz: envia o pedido de quem não encontrou a própria
   instituição na cascata do cadastro (tabela institution_requests, v6).
   O que NÃO faz: não lê nem atualiza pedidos (só super admin, via
   banco) — aqui só entra INSERT. Não toca no DOM.
   Depende de: js/core/supabase-client.js.
   Nota RLS: o INSERT aceita anon (a pessoa está no cadastro, sem
   conta ainda) — ninguém LÊ nada além do super admin.
   ============================================================ */

import { supabase } from '../core/supabase-client.js';

/**
 * Registra um pedido de cadastro de instituição.
 * @param {{institutionName: string, contactEmail: string, message: string}} params
 * @returns {Promise<{error: object|null}>} error=null em sucesso.
 */
export async function submitInstitutionRequest({ institutionName, contactEmail, message }) {
  const { error } = await supabase
    .from('institution_requests')
    .insert({
      institution_name: institutionName.trim(),
      contact_email: contactEmail.trim(),
      message: message.trim(),
    });
  return { error };
}
