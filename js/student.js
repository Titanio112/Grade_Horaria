// student.js - Painel do Aluno (Grade + Colegas hover)
import { supabase } from './supabase-client.js';
import { getProfile } from './auth.js';

let currentGrade = null;
let classmatesCache = new Map();

export async function initStudentPanel() {
    const profile = getProfile();
    if (!profile) return;
    
    await loadActiveGrade();
    renderSchedule();
    setupRealtime();
    setupHoverTooltips();
}

async function loadActiveGrade() {
    const profile = getProfile();
    const { data, error } = await supabase
        .from('grades')
        .select(`
            *,
            grade_subjects (
                *,
                subjects (*)
            )
        `)
        .eq('student_id', profile.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    
function renderSchedule() {
    const container = document.getElementById('student-schedule');
    if (!container) return;
    
    if (!currentGrade || !currentGrade.grade_subjects?.length) {
        container.innerHTML = `
            <div class="empty-schedule">
                <p>Nenhuma matéria na grade.</p>
                <button id="btn-add-subject" class="btn-primary">Adicionar Matéria</button>
            </div>
        `;
        setupAddSubjectBtn();
        return;
    }
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayLabels = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    let html = '<table class="schedule-table"><thead><tr><th>Horário</th>';
    days.forEach(d => html += `<th>${dayLabels[days.indexOf(d)]}</th>`);
    html += '</tr></thead><tbody>';
    
    const slots = generateTimeSlots();
    
    slots.forEach((slot, i) => {
        html += `<tr><td class="time-slot">${slot.label}</td>`;
        days.forEach(day => {
            const subject = currentGrade.grade_subjects?.find(gs => 
                gs.day === day && gs.time_start <= slot.start && gs.time_end > slot.start
            );
            
            if (subject) {
                const rowspan = calculateRowspan(subject, slots, i);
                if (rowspan > 0) {
                    const subj = subject.subjects || {};
                    html += `<td class="subject-cell" rowspan="${rowspan}" 
                        data-subject-id="${subj.id}"
                        style="background: ${subject.color || '#3B82F6'}20; border-left: 4px solid ${subject.color || '#3B82F6'}">
                        <div class="subject-info">
                            <strong>${subj.code || subj.name || 'Matéria'}</strong>
                            <small>${subj.professor || ''}</small>
                            <span class="classmates-indicator" data-subject-id="${subj.id}">👥</span>
                        </div>
                    </td>`;
                } else if (rowspan === 0) {
                    // skip
                } else {
                    html += '<td></td>';
                }
            } else {
                html += '<td></td>';
            }
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function generateTimeSlots() {
    const slots = [];
    let current = new Date(2000, 0, 1, 7, 30);
    const end = new Date(2000, 0, 1, 22, 0);
    
// ============================================================================
// HOVER TOOLTIPS - VER COLEGAS NA MATÉRIA
// ============================================================================

function setupHoverTooltips() {
    document.addEventListener('mouseover', async (e) => {
        const indicator = e.target.closest('.classmates-indicator');
        if (!indicator) return;
        
        const subjectId = indicator.dataset.subjectId;
        if (!subjectId) return;
        
        showClassmatesTooltip(indicator, subjectId, true);
        
        let classmates = classmatesCache.get(subjectId);
        if (!classmates) {
            classmates = await fetchClassmates(subjectId);
            classmatesCache.set(subjectId, classmates);
        }
        showClassmatesTooltip(indicator, subjectId, false, classmates);
    });
    
    document.addEventListener('mouseout', (e) => {
        if (e.target.closest('.classmates-indicator')) hideClassmatesTooltip();
    });
}

async function fetchClassmates(subjectId) {
    const profile = getProfile();
    if (!profile) return [];
    
    const { data, error } = await supabase
        .rpc('get_classmates_in_subject', {
            p_subject_id: subjectId,
            p_current_student_id: profile.id
        });
    
    if (error) { console.error('Erro ao buscar colegas:', error); return []; }
    return data || [];
}

let tooltipEl = null;

function showClassmatesTooltip(indicator, subjectId, loading = false, classmates = []) {
    if (loading) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'classmates-tooltip loading';
        tooltipEl.innerHTML = '<span class="spinner"></span> Carregando...';
    } else {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'classmates-tooltip';
        
        if (classmates.length === 0) {
            tooltipEl.innerHTML = '<p class="no-classmates">Nenhum colega nesta matéria ainda</p>';
        } else {
            tooltipEl.innerHTML = `
                <h4>Colegas na matéria</h4>
                <ul>
                    ${classmates.map(c => `
                        <li><span class="classmate-name">${c.full_name || c.email}</span>
                            <span class="classmate-status ${c.status}">${c.status}</span></li>
                    `).join('')}
                </ul>
                <small>${classmates.length} colega(s)</small>
            `;
        }
    }
    
    document.body.appendChild(tooltipEl);
    positionTooltip(indicator, tooltipEl);
}

function hideClassmatesTooltip() {
    if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
}

function positionTooltip(trigger, tooltip) {
    const rect = trigger.getBoundingClientRect();
    tooltip.style.cssText = `
        position: fixed; left: ${rect.right + 8}px; top: ${rect.top}px; z-index: 1000;
// ============================================================================
// REALTIME
// ============================================================================

function setupRealtime() {
    const profile = getProfile();
    if (!profile || !currentGrade) return;
    
    const channel = supabase
        .channel(`grade-${profile.id}`)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'grade_subjects',
            filter: `grade_id=eq.${currentGrade.id}`
        }, () => { loadActiveGrade().then(renderSchedule); })
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'student_subjects',
            filter: `student_id=eq.${profile.id}`
        }, () => { classmatesCache.clear(); })
        .subscribe();
    
    window.addEventListener('beforeunload', () => supabase.removeChannel(channel));
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
        background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem;
        padding: 0.75rem; min-width: 200px; max-width: 300px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15); font-size: 0.875rem;
    `;
    
    const tooltipRect = tooltip.getBoundingClientRect();
    if (tooltipRect.right > window.innerWidth - 8) {
        tooltip.style.left = `${rect.left - tooltipRect.width - 8}px`;
    }
    if (tooltipRect.bottom > window.innerHeight - 8) {
        tooltip.style.top = `${window.innerHeight - tooltipRect.height - 8}px`;
    }
}
    while (current < end) {
        const start = current.toTimeString().slice(0, 5);
        current.setMinutes(current.getMinutes() + 50);
        const endTime = current.toTimeString().slice(0, 5);
        current.setMinutes(current.getMinutes() + 10);
        slots.push({ start, end: endTime, label: `${start} - ${endTime}` });
    }
    return slots;
}

function calculateRowspan(subject, slots, currentIndex) {
    const subjectEnd = subject.time_end;
    let count = 0;
    for (let i = currentIndex; i < slots.length; i++) {
        if (slots[i].start < subjectEnd) count++;
        else break;
    }
    return count;
}

function setupAddSubjectBtn() {
    const btn = document.getElementById('btn-add-subject');
    if (btn) btn.addEventListener('click', () => showToast('Funcionalidade em desenvolvimento', 'info'));
}
    if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar grade:', error);
        return;
    }
    
    currentGrade = data || null;
    if (!currentGrade) await createDefaultGrade();
}

async function createDefaultGrade() {
    const profile = getProfile();
    const now = new Date();
    const semester = now.getMonth() < 6 ? 1 : 2;
    const year = now.getFullYear();
    
    const { data: grade } = await supabase
        .from('grades')
        .insert({ student_id: profile.id, name: 'Minha Grade', semester, year, is_active: true })
        .select().single();
    
    if (grade) currentGrade = { ...grade, grade_subjects: [] };
}