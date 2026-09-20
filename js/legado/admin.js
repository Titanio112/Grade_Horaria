// admin.js - Painel Administrativo (CRUD de Matérias)
import { supabase } from './supabase-client.js';
import { checkIsAdmin } from './auth.js';

let subjectsCache = [];
let editingSubjectId = null;

export async function initAdminPanel() {
    if (!checkIsAdmin()) return;
    await loadSubjects();
    renderSubjectsTable();
    setupEventListeners();
}
async function loadSubjects() {
    const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('semester', { ascending: true })
        .order('code', { ascending: true });
    
    if (error) {
        console.error('Erro ao carregar matérias:', error);
        showToast('Erro ao carregar matérias', 'error');
        return;
    }
    subjectsCache = data || [];
}

function renderSubjectsTable() {
    const tbody = document.getElementById('admin-subjects-tbody');
    if (!tbody) return;
    tbody.innerHTML = subjectsCache.map(subject => `
        <tr data-id="${subject.id}">
            <td><code>${subject.code}</code></td>
            <td>${subject.name}</td>
            <td>${subject.credits}</td>
            <td>${subject.workload}h</td>
            <td>${subject.professor || '-'}</td>
            <td>${subject.semester || '-'}</td>
            <td><span class="status-badge ${subject.is_active ? 'active' : 'inactive'}">${subject.is_active ? 'Ativa' : 'Inativa'}</span></td>
            <td class="actions">
                <button class="btn-icon edit-btn" title="Editar" data-id="${subject.id}">✏️</button>
                <button class="btn-icon delete-btn" title="Excluir" data-id="${subject.id}">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function setupEventListeners() {
    const newBtn = document.getElementById('admin-new-subject');
    if (newBtn) newBtn.addEventListener('click', () => openSubjectModal());
    
    const form = document.getElementById('admin-subject-form');
    if (form) form.addEventListener('submit', handleSubjectSubmit);
    
    const cancelBtn = document.getElementById('admin-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeSubjectModal);
    
    const modal = document.getElementById('admin-subject-modal');
function openSubjectModal(id = null) {
    const modal = document.getElementById('admin-subject-modal');
    const form = document.getElementById('admin-subject-form');
    const title = document.getElementById('admin-modal-title');
    
    if (!modal || !form) return;
    
    editingSubjectId = id;
    form.reset();
    
    if (id) {
        title.textContent = 'Editar Matéria';
        const subject = subjectsCache.find(s => s.id === id);
        if (subject) populateForm(subject);
    } else {
        title.textContent = 'Nova Matéria';
        form.is_active.checked = true;
    }
    
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeSubjectModal() {
    const modal = document.getElementById('admin-subject-modal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
        editingSubjectId = null;
    }
}

function populateForm(subject) {
    const form = document.getElementById('admin-subject-form');
    if (!form) return;
    
    Object.keys(subject).forEach(key => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) {
            if (input.type === 'checkbox') input.checked = subject[key];
            else if (Array.isArray(subject[key])) input.value = subject[key].join(', ');
            else input.value = subject[key] || '';
        }
    });
    
    const scheduleInput = form.querySelector('[name="schedule"]');
    if (scheduleInput && subject.schedule) {
        scheduleInput.value = JSON.stringify(subject.schedule, null, 2);
    }
}

async function handleSubjectSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const subjectData = {};
    
    formData.forEach((value, key) => {
        if (key === 'prerequisites' || key === 'corequisites') {
            subjectData[key] = value.split(',').map(s => s.trim()).filter(Boolean);
        } else if (key === 'schedule') {
            try { subjectData[key] = JSON.parse(value); } catch { subjectData[key] = {}; }
        } else if (key === 'is_active') {
            subjectData[key] = true;
        } else if (key === 'credits' || key === 'workload' || key === 'semester') {
            subjectData[key] = parseInt(value) || 0;
        } else {
            subjectData[key] = value;
        }
    });
    
    Object.keys(subjectData).forEach(key => {
        if (subjectData[key] === '' || subjectData[key] === null) delete subjectData[key];
    });
    
    let result;
    if (editingSubjectId) {
        result = await supabase.from('subjects').update(subjectData).eq('id', editingSubjectId).select().single();
    } else {
        subjectData.created_by = (await supabase.auth.getUser()).data.user?.id;
        result = await supabase.from('subjects').insert(subjectData).select().single();
    }
    
    if (result.error) {
        showToast(`Erro: ${result.error.message}`, 'error');
        return;
    }
    
    showToast(editingSubjectId ? 'Matéria atualizada!' : 'Matéria criada!', 'success');
    closeSubjectModal();
    await loadSubjects();
    renderSubjectsTable();
}

async function confirmDeleteSubject(id) {
    if (!confirm('Tem certeza que deseja excluir esta matéria?')) return;
    
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    
    if (error) {
        showToast(`Erro: ${error.message}`, 'error');
        return;
    }
    
    showToast('Matéria excluída!', 'success');
    await loadSubjects();
    renderSubjectsTable();
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 1rem; right: 1rem; z-index: 1000;
        padding: 0.75rem 1.5rem; border-radius: 0.5rem;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6'};
        color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeSubjectModal(); });
    
    const table = document.getElementById('admin-subjects-table');
    if (table) {
        table.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            const deleteBtn = e.target.closest('.delete-btn');
            if (editBtn) openSubjectModal(editBtn.dataset.id);
            if (deleteBtn) confirmDeleteSubject(deleteBtn.dataset.id);
        });
    }
}