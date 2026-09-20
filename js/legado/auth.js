// auth.js - Gerenciamento de autenticação e sessão
// ⚠️ LEGADO: mantido apenas para referência histórica. O código novo usa js/services/auth.service.js.
import { supabase, getCurrentUser, getCurrentProfile, isAdmin, onAuthStateChange, signIn, signUp, signOut } from '../core/supabase-client.js';

let currentProfile = null;
let authListeners = [];

export async function initAuth() {
    // Verificar sessão existente
    const profile = await getCurrentProfile();
    if (profile) {
        currentProfile = profile;
        notifyListeners('auth_change', profile);
    }
    
    // Listener para mudanças de auth
    onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            const profile = await getCurrentProfile();
            currentProfile = profile;
            notifyListeners('signed_in', profile);
        } else if (event === 'SIGNED_OUT') {
            currentProfile = null;
            notifyListeners('signed_out', null);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
            const profile = await getCurrentProfile();
            currentProfile = profile;
            notifyListeners('token_refreshed', profile);
        }
    });
}

export function getProfile() {
    return currentProfile;
}

export function getUserRole() {
    return currentProfile?.role || 'guest';
}

export function checkIsAdmin() {
    return isAdmin(currentProfile);
}

export function requireAuth(redirectTo = 'login.html') {
    if (!currentProfile) {
        window.location.href = redirectTo;
        return false;
    }
    return true;
}

export function requireAdmin(redirectTo = 'index.html') {
    if (!checkIsAdmin()) {
        alert('Acesso negado: apenas administradores');
        window.location.href = redirectTo;
        return false;
    }
    return true;
}

export function subscribe(listener) {
    authListeners.push(listener);
    return () => {
        authListeners = authListeners.filter(l => l !== listener);
    };
}

function notifyListeners(event, data) {
    authListeners.forEach(listener => listener(event, data));
}

// UI Helpers
export async function handleLogin(form) {
    const email = form.email.value;
    const password = form.password.value;
    
    const { data, error } = await signIn(email, password);
    
    if (error) {
        showError(form, error.message);
        return false;
    }
    
    return true;
}

export async function handleRegister(form) {
    const email = form.email.value;
    const password = form.password.value;
    const fullName = form.fullName?.value || '';
    
    const { data, error } = await signUp(email, password, fullName);
    
    if (error) {
        showError(form, error.message);
        return false;
    }
    
    return true;
}

export async function handleLogout() {
    const { error } = await signOut();
    if (error) {
        console.error('Erro ao sair:', error);
        return false;
    }
    return true;
}

function showError(form, message) {
    const errorEl = form.querySelector('.error-message') || createErrorElement(form);
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function createErrorElement(form) {
    const el = document.createElement('div');
    el.className = 'error-message';
    el.style.cssText = 'color: #ef4444; font-size: 0.875rem; margin-top: 0.5rem;';
    form.appendChild(el);
    return el;
}