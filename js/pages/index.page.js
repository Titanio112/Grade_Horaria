/**
 * index.page.js — Landing/roteador da raiz (index.html, exigido pelo GitHub Pages).
 *
 * O que faz: checa se existe sessão ativa e redireciona — logado vai
 * para conta.html, deslogado vai para login.html. Não renderiza UI
 * além do estado "carregando" que já está no HTML.
 * O que NÃO faz: não é uma landing de marketing, não tem formulários.
 * Depende de: js/services/auth.service.js.
 */

import { getSession } from '../services/auth.service.js';

const session = await getSession();
/* index.html fica na raiz (GitHub Pages); as telas vivem em pages/ */
window.location.replace(session ? 'pages/grade.html' : 'pages/login.html');
