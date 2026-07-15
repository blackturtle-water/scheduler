/**
 * Main Application Logic for G-Scheduler & Notes
 */

// Application State
const state = {
    events: [],
    todos: [],
    notes: [],
    ddays: [],
    currentDate: new Date() // Used for calendar view
};

// LocalStorage Keys
const STORAGE_KEYS = {
    EVENTS: 'gs_events',
    TODOS: 'gs_todos',
    NOTES: 'gs_notes',
    DDAYS: 'gs_ddays'
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    loadDataFromStorage();
    initDateTime();
    initTabs();
    initDashboard();
    initCalendar();
    initTodos();
    initNotes();
    initSettings();
    initModals();
    updateSyncIndicator();
}

// ==========================================
// DATA MANAGEMENT
// ==========================================

function loadDataFromStorage() {
    try {
        state.events = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS)) || [];
        // Migration: convert single 'date' events to multi-day style 'startDate'/'endDate'
        state.events = state.events.map(evt => {
            if (evt.date && !evt.startDate) {
                evt.startDate = evt.date;
                evt.endDate = evt.date;
                delete evt.date;
            }
            return evt;
        });
        state.todos = JSON.parse(localStorage.getItem(STORAGE_KEYS.TODOS)) || [];
        state.notes = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTES)) || [];
        state.ddays = JSON.parse(localStorage.getItem(STORAGE_KEYS.DDAYS)) || [];
    } catch (e) {
        console.error('로컬 데이터를 불러오는 중 오류 발생:', e);
    }
}

function saveDataToStorage() {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(state.events));
    localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(state.todos));
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state.notes));
    localStorage.setItem(STORAGE_KEYS.DDAYS, JSON.stringify(state.ddays));
    
    // Refresh visual panels on save
    renderDashboard();
    renderCalendar();
    renderTodoList();
    renderNotesList();
}

function getFullAppState() {
    return {
        events: state.events,
        todos: state.todos,
        notes: state.notes,
        ddays: state.ddays
    };
}

function restoreFullAppState(data) {
    if (!data) return;
    
    if (Array.isArray(data.events)) state.events = data.events;
    if (Array.isArray(data.todos)) state.todos = data.todos;
    if (Array.isArray(data.notes)) state.notes = data.notes;
    if (Array.isArray(data.ddays)) state.ddays = data.ddays;
    
    saveDataToStorage();
}

// ==========================================
// CORE UI & NAVIGATION
// ==========================================

function initDateTime() {
    const timeEl = document.getElementById('header-time');
    
    function updateHeaderTime() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        const weekday = weekdays[now.getDay()];
        
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        timeEl.textContent = `${year}. ${month}. ${day}. (${weekday}) ${hours}:${minutes}`;
    }
    
    updateHeaderTime();
    setInterval(updateHeaderTime, 60000); // Update every minute
}

function initTabs() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const pageTitle = document.getElementById('page-title');
    const btnQuickAdd = document.getElementById('btn-quick-add');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            
            // Switch navigation buttons
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Switch content panels
            tabPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === `tab-${tabName}`) {
                    panel.classList.add('active');
                }
            });
            
            // Update Page Title
            const tabTitleMap = {
                dashboard: '대시보드',
                calendar: '달력 일정',
                todos: '업무 리스트',
                notes: '정보 메모',
                settings: '설정 및 동기화'
            };
            pageTitle.textContent = tabTitleMap[tabName] || 'G-Scheduler';
            
            // Handle quick add button visibility
            if (tabName === 'settings') {
                btnQuickAdd.classList.add('hidden');
            } else {
                btnQuickAdd.classList.remove('hidden');
            }
            
            // Specific tab entry actions
            if (tabName === 'dashboard') {
                renderDashboard();
            } else if (tabName === 'calendar') {
                renderCalendar();
            } else if (tabName === 'todos') {
                renderTodoList();
            } else if (tabName === 'notes') {
                renderNotesList();
            }
        });
    });
}

function initModals() {
    // Event modal setup
    const modalEvent = document.getElementById('modal-event');
    const closeEvent = document.getElementById('modal-event-close');
    const cancelEvent = document.getElementById('btn-cancel-event');
    
    // Dday modal setup
    const modalDday = document.getElementById('modal-dday');
    const closeDday = document.getElementById('modal-dday-close');
    const cancelDday = document.getElementById('btn-cancel-dday');
    
    // Close on buttons
    [closeEvent, cancelEvent].forEach(btn => {
        btn.addEventListener('click', () => closeModal(modalEvent));
    });
    
    [closeDday, cancelDday].forEach(btn => {
        btn.addEventListener('click', () => closeModal(modalDday));
    });
    
    // Close on click outside
    window.addEventListener('click', (e) => {
        if (e.target === modalEvent) closeModal(modalEvent);
        if (e.target === modalDday) closeModal(modalDday);
    });

    // Quick add trigger (Opens event modal for today)
    const btnQuickAdd = document.getElementById('btn-quick-add');
    btnQuickAdd.addEventListener('click', () => {
        openEventModal();
    });
}

function openModal(modalEl) {
    modalEl.style.display = 'flex';
    setTimeout(() => {
        modalEl.classList.add('active');
    }, 10);
}

function closeModal(modalEl) {
    modalEl.classList.remove('active');
    setTimeout(() => {
        modalEl.style.display = 'none';
    }, 300);
}

// ==========================================
// DASHBOARD
// ==========================================

function initDashboard() {
    const btnAddDday = document.getElementById('btn-add-dday');
    btnAddDday.addEventListener('click', () => {
        openDdayModal();
    });
    
    // Handle Dday Form Submission
    const ddayForm = document.getElementById('dday-form');
    ddayForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('dday-id').value;
        const title = document.getElementById('dday-title').value.trim();
        const date = document.getElementById('dday-date').value;
        
        if (id) {
            // Edit mode (not currently exposed in UI, but good for completeness)
            const idx = state.ddays.findIndex(d => d.id === id);
            if (idx !== -1) {
                state.ddays[idx] = { id, title, date };
            }
        } else {
            // Add mode
            state.ddays.push({
                id: 'dday_' + Date.now(),
                title,
                date
            });
        }
        
        saveDataToStorage();
        closeModal(document.getElementById('modal-dday'));
        ddayForm.reset();
        renderDashboard();
    });

    renderDashboard();
}

function renderDashboard() {
    renderProgressCircle();
    renderDdayList();
    renderTodayEvents();
    renderDashboardQuickLinks();
}

function renderProgressCircle() {
    const totalTodos = state.todos.length;
    const completedTodos = state.todos.filter(t => t.completed).length;
    const percentage = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
    
    document.getElementById('progress-percentage').textContent = `${percentage}%`;
    document.getElementById('progress-ratio').textContent = `${completedTodos} / ${totalTodos} 완료`;
    
    // Update SVG progress ring
    const circle = document.getElementById('dashboard-progress-bar');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    const offset = circumference - (percentage / 100) * circumference;
    circle.style.strokeDashoffset = offset;
}

function renderDdayList() {
    const ddayListEl = document.getElementById('dashboard-dday-list');
    ddayListEl.innerHTML = '';
    
    if (state.ddays.length === 0) {
        ddayListEl.innerHTML = '<div class="no-data">등록된 D-Day 일정이 없습니다.</div>';
        return;
    }
    
    // Sort by remaining days (ascending, items that have passed last)
    const todayStr = getLocalDateString(new Date());
    const calculateDiff = (dateStr) => {
        const target = new Date(dateStr);
        const today = new Date(todayStr);
        const diffTime = target - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };
    
    const sortedDdays = [...state.ddays].sort((a, b) => {
        const diffA = calculateDiff(a.date);
        const diffB = calculateDiff(b.date);
        return diffA - diffB;
    });
    
    sortedDdays.forEach(dday => {
        const daysDiff = calculateDiff(dday.date);
        let badgeClass = 'dday-badge';
        let badgeText = '';
        
        if (daysDiff === 0) {
            badgeText = 'D-Day';
            badgeClass += ' dday-urgent';
        } else if (daysDiff > 0) {
            badgeText = `D-${daysDiff}`;
            if (daysDiff <= 3) {
                badgeClass += ' dday-urgent';
            }
        } else {
            badgeText = `D+${Math.abs(daysDiff)}`;
            badgeClass += ' dday-passed';
        }
        
        const item = document.createElement('div');
        item.className = 'dday-item';
        item.innerHTML = `
            <div class="dday-info">
                <span class="dday-title">${escapeHTML(dday.title)}</span>
                <span class="dday-target-date">${dday.date}</span>
            </div>
            <div style="display: flex; align-items: center;">
                <span class="${badgeClass}">${badgeText}</span>
                <button class="btn-delete-dday" data-id="${dday.id}" title="삭제">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
        
        // Delete action
        item.querySelector('.btn-delete-dday').addEventListener('click', (e) => {
            e.stopPropagation();
            state.ddays = state.ddays.filter(d => d.id !== dday.id);
            saveDataToStorage();
            renderDashboard();
        });
        
        ddayListEl.appendChild(item);
    });
}

function renderTodayEvents() {
    const listEl = document.getElementById('dashboard-today-events');
    listEl.innerHTML = '';
    
    const todayStr = getLocalDateString(new Date());
    const todayEvents = state.events.filter(e => {
        const start = e.startDate;
        const end = e.endDate || e.startDate;
        return todayStr >= start && todayStr <= end;
    });
    
    if (todayEvents.length === 0) {
        listEl.innerHTML = '<div class="no-data">오늘 등록된 일정이 없습니다.</div>';
        return;
    }
    
    todayEvents.forEach(evt => {
        const item = document.createElement('div');
        item.className = 'today-event-item';
        item.style.borderLeftColor = evt.color || 'var(--color-primary)';
        item.innerHTML = `
            <div class="today-event-title">${escapeHTML(evt.title)}</div>
            ${evt.desc ? `<div class="today-event-desc">${escapeHTML(evt.desc).replace(/\n/g, '<br>')}</div>` : ''}
        `;
        listEl.appendChild(item);
    });
}

function renderDashboardQuickLinks() {
    const gridEl = document.getElementById('dashboard-quick-links');
    gridEl.innerHTML = '';
    
    // Find favorite notes with content or links
    const favoriteNotes = state.notes.filter(n => n.favorite);
    
    if (favoriteNotes.length === 0) {
        gridEl.innerHTML = '<div class="no-data">중요 설정(별표)된 메모가 없습니다. 자주 참고하는 메모를 중요 등록해보세요.</div>';
        return;
    }
    
    favoriteNotes.forEach(note => {
        const card = document.createElement('div');
        card.className = 'quick-link-btn';
        
        let catText = note.category ? `<span class="quick-link-cat">${escapeHTML(note.category)}</span>` : '';
        
        card.innerHTML = `
            <div class="quick-link-title">
                <i class="fa-solid fa-star" style="color: var(--color-warning);"></i>
                <span>${escapeHTML(note.title || '제목 없음')}</span>
            </div>
            ${catText}
        `;
        
        // Click to navigate to Notes tab and load this note
        card.addEventListener('click', () => {
            // Find notes navigation button and trigger click
            const notesNavBtn = document.querySelector('.nav-btn[data-tab="notes"]');
            notesNavBtn.click();
            
            // Load note into editor
            selectNote(note.id);
        });
        
        gridEl.appendChild(card);
    });
}

function openDdayModal() {
    const modal = document.getElementById('modal-dday');
    document.getElementById('dday-id').value = '';
    document.getElementById('dday-form').reset();
    document.getElementById('dday-date').value = getLocalDateString(new Date());
    openModal(modal);
}

// ==========================================
// CALENDAR
// ==========================================

function initCalendar() {
    document.getElementById('cal-prev-month').addEventListener('click', () => {
        state.currentDate.setMonth(state.currentDate.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById('cal-next-month').addEventListener('click', () => {
        state.currentDate.setMonth(state.currentDate.getMonth() + 1);
        renderCalendar();
    });
    
    document.getElementById('cal-today').addEventListener('click', () => {
        state.currentDate = new Date();
        renderCalendar();
    });
    
    document.getElementById('btn-add-event').addEventListener('click', () => {
        openEventModal();
    });
    
    const eventForm = document.getElementById('event-form');
    
    // Auto-align end date when start date changes
    const startDateInput = document.getElementById('event-start-date');
    const endDateInput = document.getElementById('event-end-date');
    
    startDateInput.addEventListener('change', () => {
        if (!endDateInput.value || endDateInput.value < startDateInput.value) {
            endDateInput.value = startDateInput.value;
        }
    });

    eventForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('event-id').value;
        const title = document.getElementById('event-title').value.trim();
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const color = document.getElementById('event-color').value;
        const desc = document.getElementById('event-desc').value.trim();
        
        if (startDate > endDate) {
            alert('종료일은 시작일보다 빠를 수 없습니다.');
            return;
        }
        
        if (id) {
            // Edit existing
            const idx = state.events.findIndex(evt => evt.id === id);
            if (idx !== -1) {
                state.events[idx] = { id, title, startDate, endDate, color, desc };
            }
        } else {
            // Add new
            state.events.push({
                id: 'evt_' + Date.now(),
                title,
                startDate,
                endDate,
                color,
                desc
            });
        }
        
        saveDataToStorage();
        closeModal(document.getElementById('modal-event'));
        renderCalendar();
    });

    const btnDeleteEvent = document.getElementById('btn-delete-event');
    btnDeleteEvent.addEventListener('click', () => {
        const id = document.getElementById('event-id').value;
        if (id) {
            state.events = state.events.filter(evt => evt.id !== id);
            saveDataToStorage();
            closeModal(document.getElementById('modal-event'));
            renderCalendar();
        }
    });

    const btnCancelEvent = document.getElementById('btn-cancel-event');
    btnCancelEvent.addEventListener('click', () => {
        closeModal(document.getElementById('modal-event'));
    });
    
    renderCalendar();
}

function renderCalendar() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    
    // Header title
    document.getElementById('calendar-month-year').textContent = `${year}년 ${month + 1}월`;
    
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    // First day of current month
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Last day of current month
    const lastDay = new Date(year, month + 1, 0).getDate();
    // Last day of previous month
    const prevLastDay = new Date(year, month, 0).getDate();
    
    // Total cells required: pad previous month days, current month days, then pad next month days to make complete weeks (multiples of 7)
    let cells = [];
    
    // Previous Month Days Padding
    for (let x = firstDayIndex; x > 0; x--) {
        const day = prevLastDay - x + 1;
        const tempDate = new Date(year, month - 1, day);
        cells.push({
            day: day,
            dateStr: getLocalDateString(tempDate),
            isOtherMonth: true
        });
    }
    
    // Current Month Days
    for (let i = 1; i <= lastDay; i++) {
        const tempDate = new Date(year, month, i);
        cells.push({
            day: i,
            dateStr: getLocalDateString(tempDate),
            isOtherMonth: false
        });
    }
    
    // Next Month Days Padding
    const remainingCells = 42 - cells.length; // standard 6-row grid (7x6=42) or dynamic
    const nextMonthLength = remainingCells >= 0 ? remainingCells : (7 - (cells.length % 7));
    
    for (let j = 1; j <= nextMonthLength; j++) {
        const tempDate = new Date(year, month + 1, j);
        cells.push({
            day: j,
            dateStr: getLocalDateString(tempDate),
            isOtherMonth: true
        });
    }
    
    const todayStr = getLocalDateString(new Date());
    
    // Render Grid Cells
    cells.forEach(cell => {
        const cellEl = document.createElement('div');
        cellEl.className = 'calendar-cell';
        if (cell.isOtherMonth) cellEl.classList.add('other-month');
        if (cell.dateStr === todayStr) cellEl.classList.add('today');
        
        cellEl.innerHTML = `
            <span class="cell-num">${cell.day}</span>
            <div class="cell-events"></div>
        `;
        
        // Find events for this cell date (multi-day matching)
        const cellEvents = state.events.filter(e => {
            const start = e.startDate;
            const end = e.endDate || e.startDate;
            return cell.dateStr >= start && cell.dateStr <= end;
        });
        const eventsContainer = cellEl.querySelector('.cell-events');
        
        cellEvents.forEach(evt => {
            const badge = document.createElement('div');
            badge.className = 'event-badge';
            badge.style.backgroundColor = evt.color || 'var(--color-primary)';
            badge.textContent = evt.title;
            badge.title = evt.title;
            
            badge.addEventListener('click', (e) => {
                e.stopPropagation(); // Stop opening new event modal
                openEventModal(evt);
            });
            
            eventsContainer.appendChild(badge);
        });
        
        // Double click or single click to add event
        cellEl.addEventListener('click', () => {
            openEventModal(null, cell.dateStr);
        });
        
        grid.appendChild(cellEl);
    });
}

function openEventModal(eventObj = null, defaultDateStr = null) {
    const modal = document.getElementById('modal-event');
    const form = document.getElementById('event-form');
    const deleteBtn = document.getElementById('btn-delete-event');
    const titleHeader = document.getElementById('modal-event-title');
    
    form.reset();
    
    if (eventObj) {
        // Edit mode
        titleHeader.textContent = '일정 수정';
        document.getElementById('event-id').value = eventObj.id;
        document.getElementById('event-title').value = eventObj.title;
        document.getElementById('event-start-date').value = eventObj.startDate;
        document.getElementById('event-end-date').value = eventObj.endDate || eventObj.startDate;
        document.getElementById('event-color').value = eventObj.color || '#3498db';
        document.getElementById('event-desc').value = eventObj.desc || '';
        deleteBtn.classList.remove('hidden');
    } else {
        // Add mode
        titleHeader.textContent = '새 일정 추가';
        document.getElementById('event-id').value = '';
        const todayOrSelected = defaultDateStr || getLocalDateString(new Date());
        document.getElementById('event-start-date').value = todayOrSelected;
        document.getElementById('event-end-date').value = todayOrSelected;
        document.getElementById('event-color').value = '#3498db';
        deleteBtn.classList.add('hidden');
    }
    
    openModal(modal);
}

// ==========================================
// TODO LIST (TASKS)
// ==========================================

let todoFilter = 'all';

function initTodos() {
    const todoForm = document.getElementById('todo-form');
    todoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('todo-input');
        const priority = document.getElementById('todo-priority').value;
        const duedate = document.getElementById('todo-duedate').value;
        
        const titleText = input.value.trim();
        if (!titleText) return;
        
        state.todos.push({
            id: 'todo_' + Date.now(),
            text: titleText,
            priority: priority,
            duedate: duedate || null,
            completed: false
        });
        
        saveDataToStorage();
        input.value = '';
        document.getElementById('todo-duedate').value = '';
        renderTodoList();
    });
    
    // Filters setup
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            todoFilter = btn.getAttribute('data-filter');
            renderTodoList();
        });
    });
    
    renderTodoList();
}

function renderTodoList() {
    const listEl = document.getElementById('todo-items-list');
    listEl.innerHTML = '';
    
    let filteredTodos = [...state.todos];
    if (todoFilter === 'active') {
        filteredTodos = state.todos.filter(t => !t.completed);
    } else if (todoFilter === 'completed') {
        filteredTodos = state.todos.filter(t => t.completed);
    }
    
    // Sort todos: high priority first, then medium, then low, and within priority by duedate
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    filteredTodos.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const weightDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (weightDiff !== 0) return weightDiff;
        
        // Secondary sort: duedate
        if (!a.duedate) return 1;
        if (!b.duedate) return -1;
        return new Date(a.duedate) - new Date(b.duedate);
    });
    
    if (filteredTodos.length === 0) {
        listEl.innerHTML = '<div class="no-data">표시할 업무가 없습니다.</div>';
        return;
    }
    
    const todayStr = getLocalDateString(new Date());
    
    filteredTodos.forEach(todo => {
        const item = document.createElement('div');
        item.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        
        let priorityLabel = '';
        let priorityClass = '';
        if (todo.priority === 'high') { priorityLabel = '높음'; priorityClass = 'priority-high'; }
        else if (todo.priority === 'medium') { priorityLabel = '보통'; priorityClass = 'priority-medium'; }
        else { priorityLabel = '낮음'; priorityClass = 'priority-low'; }
        
        // Check overdue state
        let dueDateEl = '';
        if (todo.duedate) {
            const isOverdue = !todo.completed && (new Date(todo.duedate) < new Date(todayStr));
            dueDateEl = `
                <div class="todo-due-meta ${isOverdue ? 'overdue' : ''}">
                    <i class="fa-regular fa-calendar"></i>
                    <span>${todo.duedate} ${isOverdue ? '(지연)' : ''}</span>
                </div>
            `;
        }
        
        item.innerHTML = `
            <div class="todo-item-left">
                <label class="todo-checkbox-wrapper">
                    <input type="checkbox" ${todo.completed ? 'checked' : ''} class="todo-toggle-check">
                    <span class="todo-checkmark"></span>
                </label>
                <div class="todo-details">
                    <span class="todo-text">${escapeHTML(todo.text)}</span>
                    <div class="todo-meta">
                        <span class="todo-priority-badge ${priorityClass}">${priorityLabel}</span>
                        ${dueDateEl}
                    </div>
                </div>
            </div>
            <div class="todo-actions">
                <button class="btn-todo-action btn-todo-edit" title="수정"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn-todo-action btn-todo-delete" title="삭제"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        
        // Toggle Completed
        item.querySelector('.todo-toggle-check').addEventListener('change', () => {
            todo.completed = !todo.completed;
            saveDataToStorage();
            renderTodoList();
        });
        
        // Edit Todo text
        item.querySelector('.btn-todo-edit').addEventListener('click', () => {
            const newText = prompt('업무 내용을 수정하세요:', todo.text);
            if (newText !== null && newText.trim() !== '') {
                todo.text = newText.trim();
                saveDataToStorage();
                renderTodoList();
            }
        });
        
        // Delete Todo
        item.querySelector('.btn-todo-delete').addEventListener('click', () => {
            state.todos = state.todos.filter(t => t.id !== todo.id);
            saveDataToStorage();
            renderTodoList();
        });
        
        listEl.appendChild(item);
    });
}

// ==========================================
// INFORMATION NOTES
// ==========================================

let activeNoteId = null;

function initNotes() {
    document.getElementById('btn-new-note').addEventListener('click', () => {
        createNewNote();
    });
    
    document.getElementById('btn-save-note').addEventListener('click', () => {
        saveActiveNote();
    });
    
    document.getElementById('btn-delete-note').addEventListener('click', () => {
        deleteActiveNote();
    });
    
    document.getElementById('btn-favorite-note').addEventListener('click', () => {
        toggleNoteFavorite();
    });

    renderNotesList();
}

function createNewNote() {
    const newNote = {
        id: 'note_' + Date.now(),
        title: '',
        category: '',
        links: '',
        content: '',
        favorite: false,
        updatedAt: new Date().toISOString()
    };
    
    state.notes.unshift(newNote);
    saveDataToStorage();
    selectNote(newNote.id);
}

function selectNote(id) {
    activeNoteId = id;
    const note = state.notes.find(n => n.id === id);
    
    const placeholder = document.getElementById('note-editor-placeholder');
    const form = document.getElementById('note-editor-form');
    
    if (!note) {
        placeholder.classList.remove('hidden');
        form.classList.add('hidden');
        activeNoteId = null;
        return;
    }
    
    placeholder.classList.add('hidden');
    form.classList.remove('hidden');
    
    document.getElementById('note-id').value = note.id;
    document.getElementById('note-title').value = note.title || '';
    document.getElementById('note-category').value = note.category || '';
    document.getElementById('note-links').value = note.links || '';
    document.getElementById('note-content').value = note.content || '';
    
    // Update Favorite Icon state
    const favBtn = document.getElementById('btn-favorite-note');
    const favIcon = favBtn.querySelector('i');
    if (note.favorite) {
        favIcon.className = 'fa-solid fa-star';
        favIcon.style.color = 'var(--color-warning)';
    } else {
        favIcon.className = 'fa-regular fa-star';
        favIcon.style.color = '';
    }
    
    // Highlight selected note in sidebar list
    const noteItems = document.querySelectorAll('.note-item');
    noteItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-id') === id) {
            item.classList.add('active');
        }
    });
}

function saveActiveNote() {
    if (!activeNoteId) return;
    
    const idx = state.notes.findIndex(n => n.id === activeNoteId);
    if (idx === -1) return;
    
    const titleVal = document.getElementById('note-title').value.trim();
    
    state.notes[idx].title = titleVal || '제목 없는 메모';
    state.notes[idx].category = document.getElementById('note-category').value.trim();
    state.notes[idx].links = document.getElementById('note-links').value.trim();
    state.notes[idx].content = document.getElementById('note-content').value;
    state.notes[idx].updatedAt = new Date().toISOString();
    
    saveDataToStorage();
    renderNotesList();
    
    // Re-select to update styling in sidebar
    selectNote(activeNoteId);
    
    // Alert save success
    const btnSave = document.getElementById('btn-save-note');
    const originalText = btnSave.innerHTML;
    btnSave.innerHTML = '<i class="fa-solid fa-check"></i> 저장 완료';
    btnSave.disabled = true;
    setTimeout(() => {
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
    }, 1500);
}

function deleteActiveNote() {
    if (!activeNoteId) return;
    if (!confirm('정말 이 메모를 삭제하시겠습니까?')) return;
    
    state.notes = state.notes.filter(n => n.id !== activeNoteId);
    saveDataToStorage();
    activeNoteId = null;
    
    selectNote(null);
    renderNotesList();
}

function toggleNoteFavorite() {
    if (!activeNoteId) return;
    
    const idx = state.notes.findIndex(n => n.id === activeNoteId);
    if (idx === -1) return;
    
    state.notes[idx].favorite = !state.notes[idx].favorite;
    saveDataToStorage();
    selectNote(activeNoteId);
    renderNotesList();
}

function renderNotesList() {
    const listEl = document.getElementById('notes-list-items');
    listEl.innerHTML = '';
    
    if (state.notes.length === 0) {
        listEl.innerHTML = '<div class="no-data">메모가 없습니다.</div>';
        return;
    }
    
    // Sort notes: favorites first, then by last updated
    const sortedNotes = [...state.notes].sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    
    sortedNotes.forEach(note => {
        const item = document.createElement('div');
        item.className = 'note-item';
        if (note.id === activeNoteId) item.classList.add('active');
        item.setAttribute('data-id', note.id);
        
        const escapedTitle = escapeHTML(note.title || '제목 없는 메모');
        const categoryBadge = note.category ? `<span class="note-item-category">${escapeHTML(note.category)}</span>` : '';
        const starIcon = note.favorite ? `<i class="fa-solid fa-star note-item-star"></i>` : '';
        
        // Preview extraction
        let preview = note.content ? escapeHTML(note.content.substring(0, 30)) : '내용이 없습니다.';
        if (note.content && note.content.length > 30) preview += '...';
        
        const dateObj = new Date(note.updatedAt);
        const formattedDate = `${dateObj.getMonth()+1}/${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2,'0')}:${String(dateObj.getMinutes()).padStart(2,'0')}`;
        
        item.innerHTML = `
            ${starIcon}
            <div class="note-item-title">${escapedTitle}</div>
            <div class="note-item-preview">${preview}</div>
            <div class="note-item-meta">
                ${categoryBadge}
                <span>${formattedDate}</span>
            </div>
        `;
        
        item.addEventListener('click', () => {
            selectNote(note.id);
        });
        
        listEl.appendChild(item);
    });
}

// ==========================================
// SETTINGS & GITHUB SYNC
// ==========================================

function initSettings() {
    // Export Local Data as JSON file
    document.getElementById('btn-export-json').addEventListener('click', () => {
        const data = getFullAppState();
        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `scheduler-backup-${getLocalDateString(new Date())}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    });
    
    // Import Local Data from JSON file
    const fileTriggerBtn = document.getElementById('btn-trigger-import');
    const fileInput = document.getElementById('import-file-input');
    
    fileTriggerBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const importedData = JSON.parse(evt.target.result);
                if (confirm('백업 데이터를 불러오시겠습니까? 기존의 로컬 데이터는 덮어씌워집니다.')) {
                    restoreFullAppState(importedData);
                    alert('데이터 복원이 성공적으로 완료되었습니다.');
                    location.reload(); // Reload dashboard/calendar views
                }
            } catch (err) {
                alert('유효하지 않은 백업 JSON 파일입니다.');
                console.error(err);
            }
        };
        reader.readAsText(file);
    });

    // Github Gist Sync Settings Form
    const syncForm = document.getElementById('github-sync-form');
    const patInput = document.getElementById('github-pat');
    const gistIdInput = document.getElementById('github-gist-id');
    const syncNowBtn = document.getElementById('btn-sync-now');
    
    // Load Settings into Inputs
    const syncSettings = GithubSync.getSettings();
    patInput.value = syncSettings.pat;
    gistIdInput.value = syncSettings.gistId;
    
    if (syncSettings.pat) {
        syncNowBtn.classList.remove('hidden');
        renderSyncLogBox();
    }
    
    syncForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const patVal = patInput.value.trim();
        const gistIdVal = gistIdInput.value.trim();
        
        if (!patVal) {
            alert('GitHub Personal Access Token을 입력해주세요.');
            return;
        }
        
        GithubSync.saveSettings(patVal, gistIdVal);
        syncNowBtn.classList.remove('hidden');
        updateSyncIndicator();
        renderSyncLogBox();
        
        alert('동기화 설정이 저장되었습니다. 지금 동기화 버튼을 눌러 데이터를 업로드해보세요.');
    });
    
    syncNowBtn.addEventListener('click', async () => {
        await executeGitHubSync();
    });
}

async function executeGitHubSync() {
    const syncIndicator = document.getElementById('sidebar-sync-indicator');
    const syncText = document.getElementById('sidebar-sync-text');
    const syncNowBtn = document.getElementById('btn-sync-now');
    
    syncIndicator.className = 'sync-status syncing';
    syncText.textContent = '동기화 중...';
    syncNowBtn.disabled = true;
    
    try {
        const localData = getFullAppState();
        
        // 1. Upload/Backup local data
        const uploadResult = await GithubSync.uploadData(localData);
        
        // 2. Download from Gist to merge or verify (Gist is now ground truth)
        const downloadResult = await GithubSync.downloadData();
        
        if (downloadResult.success) {
            restoreFullAppState(downloadResult.data);
            
            // Refresh Gist settings UI (in case Gist ID was created)
            const syncSettings = GithubSync.getSettings();
            document.getElementById('github-gist-id').value = syncSettings.gistId;
            
            renderSyncLogBox();
            alert('GitHub Gist 동기화가 성공적으로 완료되었습니다!');
        }
    } catch (error) {
        alert(`동기화 실패: ${error.message}`);
        console.error(error);
    } finally {
        updateSyncIndicator();
        syncNowBtn.disabled = false;
    }
}

function updateSyncIndicator() {
    const indicator = document.getElementById('sidebar-sync-indicator');
    const indicatorText = document.getElementById('sidebar-sync-text');
    
    if (GithubSync.isConfigured()) {
        indicator.className = 'sync-status online';
        indicatorText.textContent = '클라우드 동기화';
    } else {
        indicator.className = 'sync-status offline';
        indicatorText.textContent = '로컬 모드';
    }
}

function renderSyncLogBox() {
    const logBox = document.getElementById('sync-log-box');
    const gistLink = document.getElementById('gist-url-link');
    const lastSyncTimeEl = document.getElementById('last-sync-time');
    
    const settings = GithubSync.getSettings();
    
    if (settings.pat) {
        logBox.classList.remove('hidden');
        
        if (settings.gistId) {
            gistLink.href = `https://gist.github.com/${settings.gistId}`;
            gistLink.parentElement.style.display = 'flex';
        } else {
            gistLink.parentElement.style.display = 'none';
        }
        
        if (settings.lastSync) {
            const date = new Date(settings.lastSync);
            lastSyncTimeEl.textContent = date.toLocaleString();
        } else {
            lastSyncTimeEl.textContent = '없음';
        }
    } else {
        logBox.classList.add('hidden');
    }
}

// ==========================================
// HELPER UTILITIES
// ==========================================

function getLocalDateString(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ======================================================
// FINAL SYNC PATCH: mobile status + safer download/upload sync
// ======================================================

function countAppData(data) {
    if (!data) return 0;
    return (Array.isArray(data.events) ? data.events.length : 0)
        + (Array.isArray(data.todos) ? data.todos.length : 0)
        + (Array.isArray(data.notes) ? data.notes.length : 0)
        + (Array.isArray(data.ddays) ? data.ddays.length : 0);
}

function ensureMobileSyncStatusBox() {
    let box = document.getElementById('mobile-sync-status-box');
    if (box) return box;

    box = document.createElement('div');
    box.id = 'mobile-sync-status-box';
    box.style.cssText = `
        position: fixed;
        left: 12px;
        right: 12px;
        bottom: 12px;
        z-index: 3000;
        display: none;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(17, 14, 36, 0.96);
        border: 1px solid rgba(255,255,255,0.12);
        color: #fff;
        font-size: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.35);
        backdrop-filter: blur(10px);
    `;
    box.innerHTML = `
        <span id="mobile-sync-status-text">로컬 모드</span>
        <button type="button" id="mobile-sync-status-button" style="
            border: 0;
            border-radius: 9px;
            padding: 7px 10px;
            background: #34d399;
            color: #06120d;
            font-weight: 700;
            font-size: 12px;
        ">동기화</button>
    `;
    document.body.appendChild(box);

    const btn = document.getElementById('mobile-sync-status-button');
    btn.addEventListener('click', async () => {
        if (typeof executeGitHubSync === 'function') await executeGitHubSync();
    });

    return box;
}

function setMobileSyncStatus(message, mode = 'offline') {
    const box = ensureMobileSyncStatusBox();
    const text = document.getElementById('mobile-sync-status-text');
    if (!box || !text) return;

    box.style.display = 'flex';
    text.textContent = message;

    const colors = {
        online: 'rgba(52, 211, 153, 0.20)',
        syncing: 'rgba(251, 191, 36, 0.22)',
        offline: 'rgba(255,255,255,0.06)',
        error: 'rgba(248, 113, 113, 0.24)'
    };
    box.style.background = colors[mode] || colors.offline;
}

const __oldSaveDataToStorageSyncPatch = saveDataToStorage;
function saveDataToStorage() {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(state.events));
    localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(state.todos));
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state.notes));
    localStorage.setItem(STORAGE_KEYS.DDAYS, JSON.stringify(state.ddays));

    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderTodoList === 'function') renderTodoList();
    if (typeof renderNotesList === 'function') renderNotesList();

    if (typeof AutoSync !== 'undefined' && typeof AutoSync.scheduleUpload === 'function') {
        AutoSync.scheduleUpload(getFullAppState());
    }
}

function restoreFullAppState(data) {
    if (!data) return;
    if (Array.isArray(data.events)) state.events = data.events;
    if (Array.isArray(data.todos)) state.todos = data.todos;
    if (Array.isArray(data.notes)) state.notes = data.notes;
    if (Array.isArray(data.ddays)) state.ddays = data.ddays;

    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(state.events));
    localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(state.todos));
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state.notes));
    localStorage.setItem(STORAGE_KEYS.DDAYS, JSON.stringify(state.ddays));

    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderCalendar === 'function') renderCalendar();
    if (typeof renderTodoList === 'function') renderTodoList();
    if (typeof renderNotesList === 'function') renderNotesList();
}

function updateSyncIndicator() {
    const indicator = document.getElementById('sidebar-sync-indicator');
    const indicatorText = document.getElementById('sidebar-sync-text');
    const configured = typeof GithubSync !== 'undefined' && GithubSync.isConfigured();

    if (indicator && indicatorText) {
        if (configured) {
            indicator.className = 'sync-status online';
            indicatorText.textContent = '클라우드 동기화';
        } else {
            indicator.className = 'sync-status offline';
            indicatorText.textContent = '로컬 모드';
        }
    }

    if (configured) {
        const settings = GithubSync.getSettings();
        const shortId = settings.gistId ? settings.gistId.slice(0, 8) : '미설정';
        setMobileSyncStatus(`클라우드 동기화 | Gist: ${shortId}`, 'online');
    } else {
        setMobileSyncStatus('로컬 모드 | 설정에서 PAT/Gist ID 입력 필요', 'offline');
    }
}

function renderSyncLogBox() {
    const logBox = document.getElementById('sync-log-box');
    const gistLink = document.getElementById('gist-url-link');
    const lastSyncTimeEl = document.getElementById('last-sync-time');
    if (!logBox || typeof GithubSync === 'undefined') return;

    const settings = GithubSync.getSettings();
    if (settings.pat) {
        logBox.classList.remove('hidden');
        if (settings.gistId) {
            gistLink.href = `https://gist.github.com/${settings.gistId}`;
            gistLink.textContent = 'Gist 열기';
            gistLink.parentElement.style.display = 'flex';
        } else {
            gistLink.href = '#';
            gistLink.textContent = 'Gist ID 없음';
            gistLink.parentElement.style.display = 'flex';
        }
        lastSyncTimeEl.textContent = settings.lastSync ? new Date(settings.lastSync).toLocaleString('ko-KR') : '없음';
    } else {
        logBox.classList.add('hidden');
    }
}

async function executeGitHubSync() {
    const syncIndicator = document.getElementById('sidebar-sync-indicator');
    const syncText = document.getElementById('sidebar-sync-text');
    const syncNowBtn = document.getElementById('btn-sync-now');

    try {
        if (!GithubSync.isConfigured()) {
            throw new Error('PAT가 저장되지 않았습니다. 설정 및 동기화에서 PAT를 입력한 뒤 설정 저장 및 연결을 눌러주세요.');
        }

        if (syncNowBtn) syncNowBtn.disabled = true;
        if (syncIndicator) syncIndicator.className = 'sync-status syncing';
        if (syncText) syncText.textContent = '동기화 중...';
        setMobileSyncStatus('동기화 중... 클라우드 데이터 확인', 'syncing');

        const localData = getFullAppState();
        const localCount = countAppData(localData);

        const downloadResult = await GithubSync.downloadData();
        if (downloadResult.success && downloadResult.data) {
            const remoteCount = countAppData(downloadResult.data);

            if (localCount === 0 && remoteCount > 0) {
                restoreFullAppState(downloadResult.data);
                setMobileSyncStatus(`다운로드 완료 | ${remoteCount}개 항목`, 'online');
                alert(`클라우드 데이터를 불러왔습니다. (${remoteCount}개 항목)`);
                updateSyncIndicator();
                renderSyncLogBox();
                return;
            }

            if (remoteCount > localCount) {
                restoreFullAppState(downloadResult.data);
                setMobileSyncStatus(`클라우드 최신 데이터 반영 | ${remoteCount}개 항목`, 'online');
                alert(`클라우드의 더 많은 데이터를 불러왔습니다. (${remoteCount}개 항목)`);
                updateSyncIndicator();
                renderSyncLogBox();
                return;
            }
        }

        setMobileSyncStatus('로컬 데이터를 클라우드로 업로드 중...', 'syncing');
        const uploadResult = await GithubSync.uploadData(localData);
        const total = countAppData(localData);
        setMobileSyncStatus(`업로드 완료 | ${total}개 항목`, 'online');
        alert(`동기화 완료: 현재 기기 데이터를 클라우드에 업로드했습니다. (${total}개 항목)`);

        const gistIdInput = document.getElementById('github-gist-id');
        if (gistIdInput && uploadResult.gistId) gistIdInput.value = uploadResult.gistId;
        updateSyncIndicator();
        renderSyncLogBox();
    } catch (error) {
        console.error(error);
        setMobileSyncStatus(`동기화 실패: ${error.message}`, 'error');
        alert(`동기화 실패: ${error.message}`);
        if (syncIndicator) syncIndicator.className = 'sync-status offline';
        if (syncText) syncText.textContent = '동기화 실패';
    } finally {
        if (syncNowBtn) syncNowBtn.disabled = false;
    }
}

const __oldInitSettingsSyncPatch = initSettings;
function initSettings() {
    if (typeof __oldInitSettingsSyncPatch === 'function') {
        __oldInitSettingsSyncPatch();
    }

    const patInput = document.getElementById('github-pat');
    const gistIdInput = document.getElementById('github-gist-id');
    const syncNowBtn = document.getElementById('btn-sync-now');
    const syncForm = document.getElementById('github-sync-form');

    if (typeof GithubSync !== 'undefined') {
        const settings = GithubSync.getSettings();
        if (patInput && settings.pat) patInput.value = settings.pat;
        if (gistIdInput && settings.gistId) gistIdInput.value = settings.gistId;
        if (syncNowBtn && settings.pat) syncNowBtn.classList.remove('hidden');
    }

    if (syncForm && !syncForm.dataset.finalSyncPatch) {
        syncForm.dataset.finalSyncPatch = '1';
        syncForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const patVal = patInput ? patInput.value.trim() : '';
            const gistIdVal = gistIdInput ? gistIdInput.value.trim() : '';
            if (!patVal) {
                alert('GitHub PAT를 입력해주세요.');
                return;
            }
            GithubSync.saveSettings(patVal, gistIdVal);
            if (syncNowBtn) syncNowBtn.classList.remove('hidden');
            updateSyncIndicator();
            renderSyncLogBox();
            setMobileSyncStatus('설정 저장 완료 | 동기화 버튼을 눌러주세요', 'online');
            alert('동기화 설정이 저장되었습니다. 이제 지금 동기화를 눌러주세요.');
        }, true);
    }

    updateSyncIndicator();
    renderSyncLogBox();
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        ensureMobileSyncStatusBox();
        updateSyncIndicator();
    }, 300);
});


// ======================================================
// EXISTING SITE FINAL PATCH: calendar time fields, 5-minute step
// ======================================================
(function () {
    function migrateEventTimeFields(evt) {
        if (!evt) return evt;
        if (evt.date && !evt.startDate) {
            evt.startDate = evt.date;
            evt.endDate = evt.date;
            delete evt.date;
        }
        if (!evt.endDate) evt.endDate = evt.startDate;
        if (!evt.startTime) evt.startTime = '';
        if (!evt.endTime) evt.endTime = '';
        return evt;
    }

    function ensureEventTimeFields() {
        if (document.getElementById('event-start-time')) return;
        const startDateInput = document.getElementById('event-start-date');
        const endDateInput = document.getElementById('event-end-date');
        if (!startDateInput || !endDateInput) return;

        const dateRow = startDateInput.closest('.form-row');
        if (!dateRow) return;

        const timeRow = document.createElement('div');
        timeRow.className = 'form-row';
        timeRow.innerHTML = `
            <div class="form-group">
                <label for="event-start-time">시작시간</label>
                <input type="time" id="event-start-time" step="300">
            </div>
            <div class="form-group">
                <label for="event-end-time">종료시간</label>
                <input type="time" id="event-end-time" step="300">
            </div>
        `;
        dateRow.insertAdjacentElement('afterend', timeRow);
    }

    function formatEventTime(evt) {
        if (evt.startTime && evt.endTime) return `${evt.startTime}~${evt.endTime} `;
        if (evt.startTime) return `${evt.startTime} `;
        return '';
    }

    function isDateInRange(dateStr, startDate, endDate) {
        if (!startDate) return false;
        const end = endDate || startDate;
        return dateStr >= startDate && dateStr <= end;
    }

    window.loadDataFromStorage = loadDataFromStorage = function () {
        try {
            state.events = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS)) || [];
            state.events = state.events.map(migrateEventTimeFields);
            state.todos = JSON.parse(localStorage.getItem(STORAGE_KEYS.TODOS)) || [];
            state.notes = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTES)) || [];
            state.ddays = JSON.parse(localStorage.getItem(STORAGE_KEYS.DDAYS)) || [];
        } catch (e) {
            console.error('로컬 데이터를 불러오는 중 오류 발생:', e);
        }
    };

    window.saveDataToStorage = saveDataToStorage = function () {
        localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(state.events.map(migrateEventTimeFields)));
        localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(state.todos));
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state.notes));
        localStorage.setItem(STORAGE_KEYS.DDAYS, JSON.stringify(state.ddays));

        if (typeof AutoSync !== 'undefined' && typeof AutoSync.scheduleUpload === 'function') {
            AutoSync.scheduleUpload(getFullAppState());
        }
    };

    window.restoreFullAppState = restoreFullAppState = function (data) {
        if (!data) return;
        if (Array.isArray(data.events)) state.events = data.events.map(migrateEventTimeFields);
        if (Array.isArray(data.todos)) state.todos = data.todos;
        if (Array.isArray(data.notes)) state.notes = data.notes;
        if (Array.isArray(data.ddays)) state.ddays = data.ddays;

        localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(state.events));
        localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(state.todos));
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state.notes));
        localStorage.setItem(STORAGE_KEYS.DDAYS, JSON.stringify(state.ddays));

        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof renderCalendar === 'function') renderCalendar();
        if (typeof renderTodoList === 'function') renderTodoList();
        if (typeof renderNotesList === 'function') renderNotesList();
    };

    window.initCalendar = initCalendar = function () {
        ensureEventTimeFields();

        document.getElementById('cal-prev-month')?.addEventListener('click', () => {
            state.currentDate.setMonth(state.currentDate.getMonth() - 1);
            renderCalendar();
        });
        document.getElementById('cal-next-month')?.addEventListener('click', () => {
            state.currentDate.setMonth(state.currentDate.getMonth() + 1);
            renderCalendar();
        });
        document.getElementById('cal-today')?.addEventListener('click', () => {
            state.currentDate = new Date();
            renderCalendar();
        });
        document.getElementById('btn-add-event')?.addEventListener('click', () => {
            openEventModal(null, getLocalDateString(new Date()));
        });

        const startDateInput = document.getElementById('event-start-date');
        const endDateInput = document.getElementById('event-end-date');
        startDateInput?.addEventListener('change', () => {
            if (!endDateInput.value || endDateInput.value < startDateInput.value) {
                endDateInput.value = startDateInput.value;
            }
        });

        const eventForm = document.getElementById('event-form');
        eventForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('event-id').value;
            const title = document.getElementById('event-title').value.trim();
            const startDate = document.getElementById('event-start-date').value;
            const endDate = document.getElementById('event-end-date').value;
            const startTime = document.getElementById('event-start-time')?.value || '';
            const endTime = document.getElementById('event-end-time')?.value || '';
            const color = document.getElementById('event-color').value;
            const desc = document.getElementById('event-desc').value.trim();

            if (!title) {
                alert('일정 제목을 입력해주세요.');
                return;
            }
            if (startDate > endDate) {
                alert('종료일은 시작일보다 빠를 수 없습니다.');
                return;
            }
            if (startDate === endDate && startTime && endTime && endTime < startTime) {
                alert('같은 날짜에서는 종료시간이 시작시간보다 빠를 수 없습니다.');
                return;
            }

            const eventData = { id: id || 'evt_' + Date.now(), title, startDate, endDate, startTime, endTime, color, desc };
            if (id) {
                const idx = state.events.findIndex(evt => evt.id === id);
                if (idx !== -1) state.events[idx] = eventData;
            } else {
                state.events.push(eventData);
            }

            saveDataToStorage();
            if (typeof renderDashboard === 'function') renderDashboard();
            renderCalendar();
            closeModal(document.getElementById('modal-event'));
        });

        document.getElementById('btn-delete-event')?.addEventListener('click', () => {
            const id = document.getElementById('event-id').value;
            if (!id) return;
            if (!confirm('일정을 삭제하시겠습니까?')) return;
            state.events = state.events.filter(evt => evt.id !== id);
            saveDataToStorage();
            if (typeof renderDashboard === 'function') renderDashboard();
            renderCalendar();
            closeModal(document.getElementById('modal-event'));
        });

        document.getElementById('btn-cancel-event')?.addEventListener('click', () => {
            closeModal(document.getElementById('modal-event'));
        });

        renderCalendar();
    };

    window.renderCalendar = renderCalendar = function () {
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();
        const monthYearEl = document.getElementById('calendar-month-year');
        const grid = document.getElementById('calendar-grid');
        if (monthYearEl) monthYearEl.textContent = `${year}년 ${month + 1}월`;
        if (!grid) return;
        grid.innerHTML = '';

        const firstDayIndex = new Date(year, month, 1).getDay();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const prevLastDay = new Date(year, month, 0).getDate();
        const cells = [];

        for (let x = firstDayIndex; x > 0; x--) {
            const day = prevLastDay - x + 1;
            const tempDate = new Date(year, month - 1, day);
            cells.push({ day, dateStr: getLocalDateString(tempDate), isOtherMonth: true });
        }
        for (let i = 1; i <= lastDay; i++) {
            const tempDate = new Date(year, month, i);
            cells.push({ day: i, dateStr: getLocalDateString(tempDate), isOtherMonth: false });
        }
        const remainingCells = 42 - cells.length;
        for (let j = 1; j <= remainingCells; j++) {
            const tempDate = new Date(year, month + 1, j);
            cells.push({ day: j, dateStr: getLocalDateString(tempDate), isOtherMonth: true });
        }

        const todayStr = getLocalDateString(new Date());
        state.events = state.events.map(migrateEventTimeFields);

        cells.forEach(cell => {
            const cellEl = document.createElement('div');
            cellEl.className = 'calendar-cell';
            if (cell.isOtherMonth) cellEl.classList.add('other-month');
            if (cell.dateStr === todayStr) cellEl.classList.add('today');
            cellEl.innerHTML = `<span class="cell-num">${cell.day}</span><div class="cell-events"></div>`;

            const eventsContainer = cellEl.querySelector('.cell-events');
            const cellEvents = state.events
                .filter(evt => isDateInRange(cell.dateStr, evt.startDate, evt.endDate))
                .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));

            cellEvents.forEach(evt => {
                const badge = document.createElement('div');
                badge.className = 'event-badge';
                badge.style.backgroundColor = evt.color || 'var(--color-primary)';
                badge.textContent = `${formatEventTime(evt)}${evt.title}`;
                badge.title = `${formatEventTime(evt)}${evt.title}`;
                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEventModal(evt);
                });
                eventsContainer.appendChild(badge);
            });

            cellEl.addEventListener('click', () => openEventModal(null, cell.dateStr));
            grid.appendChild(cellEl);
        });
    };

    window.renderTodayEvents = renderTodayEvents = function () {
        const listEl = document.getElementById('dashboard-today-events');
        if (!listEl) return;
        listEl.innerHTML = '';
        const today = getLocalDateString(new Date());
        state.events = state.events.map(migrateEventTimeFields);
        const todayEvents = state.events
            .filter(evt => isDateInRange(today, evt.startDate, evt.endDate))
            .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));

        if (!todayEvents.length) {
            listEl.innerHTML = '<div class="no-data">오늘 일정이 없습니다.</div>';
            return;
        }

        todayEvents.forEach(evt => {
            const item = document.createElement('div');
            item.className = 'today-event-item';
            item.style.borderLeftColor = evt.color || 'var(--color-primary)';
            item.innerHTML = `
                <div>
                    <div class="today-event-title">${escapeHTML(formatEventTime(evt) + (evt.title || ''))}</div>
                    <div class="today-event-desc">${escapeHTML(evt.desc || '')}</div>
                </div>
            `;
            listEl.appendChild(item);
        });
    };

    window.openEventModal = openEventModal = function (eventObj = null, defaultDateStr = null) {
        ensureEventTimeFields();
        const modal = document.getElementById('modal-event');
        const form = document.getElementById('event-form');
        const deleteBtn = document.getElementById('btn-delete-event');
        const titleHeader = document.getElementById('modal-event-title');
        if (form) form.reset();

        const selectedDate = defaultDateStr || getLocalDateString(new Date());

        if (eventObj) {
            eventObj = migrateEventTimeFields(eventObj);
            if (titleHeader) titleHeader.textContent = '일정 수정';
            document.getElementById('event-id').value = eventObj.id;
            document.getElementById('event-title').value = eventObj.title || '';
            document.getElementById('event-start-date').value = eventObj.startDate || selectedDate;
            document.getElementById('event-end-date').value = eventObj.endDate || eventObj.startDate || selectedDate;
            document.getElementById('event-start-time').value = eventObj.startTime || '';
            document.getElementById('event-end-time').value = eventObj.endTime || '';
            document.getElementById('event-color').value = eventObj.color || '#3498db';
            document.getElementById('event-desc').value = eventObj.desc || '';
            deleteBtn?.classList.remove('hidden');
        } else {
            if (titleHeader) titleHeader.textContent = '새 일정 추가';
            document.getElementById('event-id').value = '';
            document.getElementById('event-start-date').value = selectedDate;
            document.getElementById('event-end-date').value = selectedDate;
            document.getElementById('event-start-time').value = '';
            document.getElementById('event-end-time').value = '';
            document.getElementById('event-color').value = '#3498db';
            deleteBtn?.classList.add('hidden');
        }
        openModal(modal);
    };

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => ensureEventTimeFields(), 200);
    });
})();
