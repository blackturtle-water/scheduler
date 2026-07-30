/**
 * G-Scheduler & Notes - FINAL SAFE SYNC VERSION
 * - Fixes initSettings recursion
 * - Adds explicit Cloud Upload / Cloud Download buttons
 * - Moves mobile sync status bar to TOP
 * - Prevents empty local data from overwriting non-empty cloud data
 * - Preserves PAT on mobile even when password input appears blank
 * - Calendar event time fields with 5-minute step
 */

const state = {
  events: [],
  todos: [],
  notes: [],
  ddays: [],
  currentDate: new Date()
};

const STORAGE_KEYS = {
  EVENTS: 'gs_events',
  TODOS: 'gs_todos',
  NOTES: 'gs_notes',
  DDAYS: 'gs_ddays'
};

let todoFilter = 'all';
let activeNoteId = null;
let editingTodoId = null;

// =====================================================
// BASIC UTILITIES
// =====================================================
function getLocalDateString(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function migrateEventTimeFields(evt) {
  if (!evt) return evt;
  if (evt.date && !evt.startDate) {
    evt.startDate = evt.date;
    evt.endDate = evt.date;
    delete evt.date;
  }
  if (!evt.startDate && evt.endDate) evt.startDate = evt.endDate;
  if (!evt.endDate) evt.endDate = evt.startDate;
  if (!evt.startTime) evt.startTime = '';
  if (!evt.endTime) evt.endTime = '';
  return evt;
}

function isDateInRange(dateStr, startDate, endDate) {
  if (!startDate) return false;
  const end = endDate || startDate;
  return dateStr >= startDate && dateStr <= end;
}

function formatEventTime(evt) {
  if (evt.startTime && evt.endTime) return `${evt.startTime}~${evt.endTime} `;
  if (evt.startTime) return `${evt.startTime} `;
  return '';
}

function countAppData(data) {
  if (!data) return 0;
  return (Array.isArray(data.events) ? data.events.length : 0)
    + (Array.isArray(data.todos) ? data.todos.length : 0)
    + (Array.isArray(data.notes) ? data.notes.length : 0)
    + (Array.isArray(data.ddays) ? data.ddays.length : 0);
}

function normalizeAppData(data) {
  return {
    events: Array.isArray(data?.events) ? data.events.map(migrateEventTimeFields) : [],
    todos: Array.isArray(data?.todos) ? data.todos : [],
    notes: Array.isArray(data?.notes) ? data.notes : [],
    ddays: Array.isArray(data?.ddays) ? data.ddays : [],
    updatedAt: data?.updatedAt || new Date().toISOString()
  };
}

function mergeById(localArr = [], remoteArr = [], preferRemote = true) {
  const map = new Map();
  localArr.forEach(item => {
    if (!item) return;
    const id = item.id || `${Date.now()}_${Math.random()}`;
    map.set(id, { ...item, id });
  });
  remoteArr.forEach(item => {
    if (!item) return;
    const id = item.id || `${Date.now()}_${Math.random()}`;
    if (!map.has(id)) {
      map.set(id, { ...item, id });
      return;
    }
    const existing = map.get(id);
    const a = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
    const b = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
    if (b > a || (a === 0 && b === 0 && preferRemote)) map.set(id, { ...item, id });
  });
  return Array.from(map.values());
}

function mergeAppData(localData, remoteData) {
  const local = normalizeAppData(localData);
  const remote = normalizeAppData(remoteData);
  return {
    events: mergeById(local.events, remote.events, true).map(migrateEventTimeFields),
    todos: mergeById(local.todos, remote.todos, true),
    notes: mergeById(local.notes, remote.notes, true),
    ddays: mergeById(local.ddays, remote.ddays, true),
    updatedAt: new Date().toISOString()
  };
}

// =====================================================
// DATA MANAGEMENT
// =====================================================
function loadDataFromStorage() {
  try {
    state.events = (JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS)) || []).map(migrateEventTimeFields);
    state.todos = JSON.parse(localStorage.getItem(STORAGE_KEYS.TODOS)) || [];
    state.notes = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTES)) || [];
    state.ddays = JSON.parse(localStorage.getItem(STORAGE_KEYS.DDAYS)) || [];
  } catch (e) {
    console.error('로컬 데이터를 불러오는 중 오류 발생:', e);
  }
}

function saveDataToStorage() {
  saveDataToStorageOnly();
}

function saveDataToStorageOnly() {
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(state.events.map(migrateEventTimeFields)));
  localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(state.todos));
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state.notes));
  localStorage.setItem(STORAGE_KEYS.DDAYS, JSON.stringify(state.ddays));
}

function getFullAppState() {
  return {
    events: state.events.map(migrateEventTimeFields),
    todos: state.todos,
    notes: state.notes,
    ddays: state.ddays,
    updatedAt: new Date().toISOString()
  };
}

function restoreFullAppState(data) {
  const normalized = normalizeAppData(data);
  state.events = normalized.events;
  state.todos = normalized.todos;
  state.notes = normalized.notes;
  state.ddays = normalized.ddays;
  saveDataToStorageOnly();
  renderAll();
}

// =====================================================
// INITIALIZATION
// =====================================================
document.addEventListener('DOMContentLoaded', initApp);

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
  renderAll();
  updateSyncIndicator();
  renderSyncLogBox();
}

function renderAll() {
  renderDashboard();
  renderCalendar();
  renderTodoList();
  renderNotesList();
}

function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = 'flex';
  setTimeout(() => modalEl.classList.add('active'), 10);
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('active');
  setTimeout(() => { modalEl.style.display = 'none'; }, 250);
}

function initDateTime() {
  const timeEl = document.getElementById('header-time');
  const update = () => {
    if (!timeEl) return;
    const now = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    timeEl.textContent = `${now.getFullYear()}. ${String(now.getMonth()+1).padStart(2,'0')}. ${String(now.getDate()).padStart(2,'0')}. (${days[now.getDay()]}) ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  };
  update();
  setInterval(update, 30000);
}

function initTabs() {
  const titles = { dashboard: '대시보드', calendar: '달력 일정', todos: '업무 리스트', notes: '정보 메모', settings: '설정 및 동기화' };
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`)?.classList.add('active');
      const pageTitle = document.getElementById('page-title');
      if (pageTitle) pageTitle.textContent = titles[tab] || '';
      if (tab === 'settings') renderSyncLogBox();
    });
  });
  document.getElementById('btn-quick-add')?.addEventListener('click', () => openEventModal(null, getLocalDateString(new Date())));
}

function initModals() {
  document.getElementById('modal-event-close')?.addEventListener('click', () => closeModal(document.getElementById('modal-event')));
  document.getElementById('modal-dday-close')?.addEventListener('click', () => closeModal(document.getElementById('modal-dday')));
  document.getElementById('btn-cancel-dday')?.addEventListener('click', () => closeModal(document.getElementById('modal-dday')));
}

// =====================================================
// DASHBOARD
// =====================================================
function initDashboard() {
  document.getElementById('btn-add-dday')?.addEventListener('click', openDdayModal);
  document.getElementById('dday-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('dday-id').value || 'dday_' + Date.now();
    const title = document.getElementById('dday-title').value.trim();
    const date = document.getElementById('dday-date').value;
    if (!title || !date) return;
    const idx = state.ddays.findIndex(d => d.id === id);
    const item = { id, title, date, updatedAt: new Date().toISOString() };
    if (idx >= 0) state.ddays[idx] = item; else state.ddays.push(item);
    saveDataToStorage();
    renderDashboard();
    closeModal(document.getElementById('modal-dday'));
  });
}

function renderDashboard() {
  renderProgressCircle();
  renderDdayList();
  renderTodayEvents();
  renderDashboardQuickLinks();
}

function renderProgressCircle() {
  const total = state.todos.length;
  const completed = state.todos.filter(t => t.completed).length;
  const pct = total ? Math.round(completed / total * 100) : 0;
  const pctEl = document.getElementById('progress-percentage');
  const ratioEl = document.getElementById('progress-ratio');
  const circle = document.getElementById('dashboard-progress-bar');
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (ratioEl) ratioEl.textContent = `${completed} / ${total} 완료`;
  if (circle) {
    const dash = 439.82;
    circle.style.strokeDashoffset = String(dash - dash * pct / 100);
  }
}

function renderDdayList() {
  const el = document.getElementById('dashboard-dday-list');
  if (!el) return;
  el.innerHTML = '';
  if (!state.ddays.length) { el.innerHTML = '<div class="no-data">등록된 D-Day 일정이 없습니다.</div>'; return; }
  const today = new Date(getLocalDateString(new Date()));
  state.ddays.slice().sort((a,b) => a.date.localeCompare(b.date)).forEach(d => {
    const diff = Math.ceil((new Date(d.date) - today) / 86400000);
    const badgeText = diff === 0 ? 'D-Day' : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
    const item = document.createElement('div');
    item.className = 'dday-item';
    item.innerHTML = `<div class="dday-info"><div class="dday-title">${escapeHTML(d.title)}</div><div class="dday-target-date">${escapeHTML(d.date)}</div></div><div><span class="dday-badge ${diff < 0 ? 'dday-passed' : diff <= 7 ? 'dday-urgent' : ''}">${badgeText}</span><button class="btn-delete-dday" data-id="${d.id}"><i class="fa-solid fa-trash"></i></button></div>`;
    el.appendChild(item);
  });
  el.querySelectorAll('.btn-delete-dday').forEach(btn => btn.addEventListener('click', () => {
    state.ddays = state.ddays.filter(d => d.id !== btn.dataset.id);
    saveDataToStorage(); renderDashboard();
  }));
}

function renderTodayEvents() {
  const el = document.getElementById('dashboard-today-events');
  if (!el) return;
  el.innerHTML = '';
  const today = getLocalDateString(new Date());
  const items = state.events.map(migrateEventTimeFields)
    .filter(e => isDateInRange(today, e.startDate, e.endDate))
    .sort((a,b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
  if (!items.length) { el.innerHTML = '<div class="no-data">오늘 일정이 없습니다.</div>'; return; }
  items.forEach(evt => {
    const item = document.createElement('div');
    item.className = 'today-event-item';
    item.style.borderLeftColor = evt.color || '#3498db';
    item.innerHTML = `<div><div class="today-event-title">${escapeHTML(formatEventTime(evt) + evt.title)}</div><div class="today-event-desc">${escapeHTML(evt.desc || '')}</div></div>`;
    el.appendChild(item);
  });
}

function renderDashboardQuickLinks() {
  const el = document.getElementById('dashboard-quick-links');
  if (!el) return;
  el.innerHTML = '';
  const favs = state.notes.filter(n => n.favorite);
  if (!favs.length) { el.innerHTML = '<div class="no-data">등록된 중요 메모가 없습니다.</div>'; return; }
  favs.forEach(n => {
    const a = document.createElement('button');
    a.className = 'quick-link-btn';
    a.innerHTML = `<div class="quick-link-title"><i class="fa-solid fa-star"></i>${escapeHTML(n.title || '제목 없음')}</div><div class="quick-link-cat">${escapeHTML(n.category || '메모')}</div>`;
    a.addEventListener('click', () => { document.querySelector('.nav-btn[data-tab="notes"]')?.click(); selectNote(n.id); });
    el.appendChild(a);
  });
}

function openDdayModal() {
  document.getElementById('dday-id').value = '';
  document.getElementById('dday-form')?.reset();
  document.getElementById('dday-date').value = getLocalDateString(new Date());
  openModal(document.getElementById('modal-dday'));
}

// =====================================================
// CALENDAR
// =====================================================
function ensureEventTimeFields() {
  if (document.getElementById('event-start-time')) return;
  const startDateInput = document.getElementById('event-start-date');
  const endDateInput = document.getElementById('event-end-date');
  if (!startDateInput || !endDateInput) return;
  const dateRow = startDateInput.closest('.form-row');
  if (!dateRow) return;
  const row = document.createElement('div');
  row.className = 'form-row';
  row.innerHTML = `<div class="form-group"><label for="event-start-time">시작시간</label><input type="time" id="event-start-time" step="300"></div><div class="form-group"><label for="event-end-time">종료시간</label><input type="time" id="event-end-time" step="300"></div>`;
  dateRow.insertAdjacentElement('afterend', row);
}

function initCalendar() {
  ensureEventTimeFields();
  document.getElementById('cal-prev-month')?.addEventListener('click', () => { state.currentDate.setMonth(state.currentDate.getMonth() - 1); renderCalendar(); });
  document.getElementById('cal-next-month')?.addEventListener('click', () => { state.currentDate.setMonth(state.currentDate.getMonth() + 1); renderCalendar(); });
  document.getElementById('cal-today')?.addEventListener('click', () => { state.currentDate = new Date(); renderCalendar(); });
  document.getElementById('btn-add-event')?.addEventListener('click', () => openEventModal(null, getLocalDateString(new Date())));
  document.getElementById('event-start-date')?.addEventListener('change', () => {
    const s = document.getElementById('event-start-date'); const e = document.getElementById('event-end-date');
    if (s && e && (!e.value || e.value < s.value)) e.value = s.value;
  });
  document.getElementById('event-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('event-id').value;
    const title = document.getElementById('event-title').value.trim();
    const startDate = document.getElementById('event-start-date').value;
    const endDate = document.getElementById('event-end-date').value;
    const startTime = document.getElementById('event-start-time')?.value || '';
    const endTime = document.getElementById('event-end-time')?.value || '';
    const color = document.getElementById('event-color').value;
    const desc = document.getElementById('event-desc').value.trim();
    if (!title) return alert('일정 제목을 입력해주세요.');
    if (startDate > endDate) return alert('종료일은 시작일보다 빠를 수 없습니다.');
    if (startDate === endDate && startTime && endTime && endTime < startTime) return alert('같은 날짜에서는 종료시간이 시작시간보다 빠를 수 없습니다.');
    const eventData = { id: id || 'evt_' + Date.now(), title, startDate, endDate, startTime, endTime, color, desc, updatedAt: new Date().toISOString() };
    const idx = state.events.findIndex(x => x.id === id);
    if (idx >= 0) state.events[idx] = eventData; else state.events.push(eventData);
    saveDataToStorage(); renderDashboard(); renderCalendar(); closeModal(document.getElementById('modal-event'));
  });
  document.getElementById('btn-delete-event')?.addEventListener('click', () => {
    const id = document.getElementById('event-id').value;
    if (!id || !confirm('일정을 삭제하시겠습니까?')) return;
    state.events = state.events.filter(e => e.id !== id);
    saveDataToStorage(); renderDashboard(); renderCalendar(); closeModal(document.getElementById('modal-event'));
  });
  document.getElementById('btn-cancel-event')?.addEventListener('click', () => closeModal(document.getElementById('modal-event')));
}

function renderCalendar() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const header = document.getElementById('calendar-month-year');
  const grid = document.getElementById('calendar-grid');
  if (header) header.textContent = `${year}년 ${month + 1}월`;
  if (!grid) return;
  grid.innerHTML = '';
  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const prevLastDay = new Date(year, month, 0).getDate();
  const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const cells = [];
  for (let x = firstDayIndex; x > 0; x--) {
    const day = prevLastDay - x + 1;
    const dateObj = new Date(year, month - 1, day);
    cells.push({ day, dateStr: getLocalDateString(dateObj), weekday: weekdayLabels[dateObj.getDay()], isOtherMonth: true });
  }
  for (let i = 1; i <= lastDay; i++) {
    const dateObj = new Date(year, month, i);
    cells.push({ day: i, dateStr: getLocalDateString(dateObj), weekday: weekdayLabels[dateObj.getDay()], isOtherMonth: false });
  }
  while (cells.length < 42) {
    const day = cells.length - firstDayIndex - lastDay + 1;
    const dateObj = new Date(year, month + 1, day);
    cells.push({ day, dateStr: getLocalDateString(dateObj), weekday: weekdayLabels[dateObj.getDay()], isOtherMonth: true });
  }
  const today = getLocalDateString(new Date());
  state.events = state.events.map(migrateEventTimeFields);
  cells.forEach(cell => {
    const cellEl = document.createElement('div');
    cellEl.className = 'calendar-cell';
    if (cell.isOtherMonth) cellEl.classList.add('other-month');
    if (cell.dateStr === today) cellEl.classList.add('today');
    cellEl.innerHTML = `<div class="cell-date-header"><span class="cell-num">${cell.day}</span><span class="cell-weekday">${cell.weekday}</span></div><div class="cell-events"></div>`;
    const container = cellEl.querySelector('.cell-events');
    state.events.filter(e => isDateInRange(cell.dateStr, e.startDate, e.endDate))
      .sort((a,b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'))
      .forEach(evt => {
        const badge = document.createElement('div');
        badge.className = 'event-badge';
        badge.style.backgroundColor = evt.color || '#3498db';
        badge.textContent = `${formatEventTime(evt)}${evt.title}`;
        badge.title = badge.textContent;
        badge.addEventListener('click', ev => { ev.stopPropagation(); openEventModal(evt); });
        container.appendChild(badge);
      });
    cellEl.addEventListener('click', () => openEventModal(null, cell.dateStr));
    grid.appendChild(cellEl);
  });
}

function openEventModal(eventObj = null, defaultDateStr = null) {
  ensureEventTimeFields();
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
  openModal(document.getElementById('modal-event'));
}

// =====================================================
// TODOS
// =====================================================
function setTodoFormMode(mode = 'add') {
  const cardTitle = document.querySelector('.todo-sidebar-card h3');
  const submitBtn = document.querySelector('#todo-form button[type="submit"]');
  if (mode === 'edit') {
    if (cardTitle) cardTitle.textContent = '할 일 수정';
    if (submitBtn) submitBtn.textContent = '수정 완료';
  } else {
    editingTodoId = null;
    if (cardTitle) cardTitle.textContent = '새 할 일 추가';
    if (submitBtn) submitBtn.textContent = '추가하기';
  }
}

function startEditTodo(todoId) {
  const todo = state.todos.find(t => t.id === todoId);
  if (!todo) return;
  editingTodoId = todo.id;
  document.getElementById('todo-input').value = todo.text || '';
  document.getElementById('todo-priority').value = todo.priority || 'medium';
  document.getElementById('todo-duedate').value = todo.duedate || '';
  setTodoFormMode('edit');
  document.querySelector('.todo-sidebar-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('todo-input')?.focus();
}

function initTodos() {
  const form = document.getElementById('todo-form');
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    if (!text) return;
    const priority = document.getElementById('todo-priority').value;
    const duedate = document.getElementById('todo-duedate').value;

    if (editingTodoId) {
      const todo = state.todos.find(t => t.id === editingTodoId);
      if (todo) {
        todo.text = text;
        todo.priority = priority;
        todo.duedate = duedate;
        todo.updatedAt = new Date().toISOString();
      }
    } else {
      state.todos.push({ id: 'todo_' + Date.now(), text, priority, duedate, completed: false, updatedAt: new Date().toISOString() });
    }

    input.value = '';
    document.getElementById('todo-priority').value = 'medium';
    document.getElementById('todo-duedate').value = '';
    setTodoFormMode('add');
    saveDataToStorage(); renderTodoList(); renderDashboard();
  });
  document.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', () => {
    todoFilter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); renderTodoList();
  }));
}

function renderTodoList() {
  const el = document.getElementById('todo-items-list');
  if (!el) return;
  el.innerHTML = '';
  let list = state.todos;
  if (todoFilter === 'active') list = list.filter(t => !t.completed);
  if (todoFilter === 'completed') list = list.filter(t => t.completed);
  if (!list.length) { el.innerHTML = '<div class="no-data">할 일이 없습니다. 여유로운 하루를 보내세요!</div>'; return; }
  const labels = { high: '높음', medium: '보통', low: '낮음' };
  list.forEach(t => {
    const item = document.createElement('div');
    item.className = 'todo-item' + (t.completed ? ' completed' : '');
    item.innerHTML = `<div class="todo-item-left"><label class="todo-checkbox-wrapper"><input type="checkbox" ${t.completed ? 'checked' : ''}><span class="todo-checkmark"></span></label><div class="todo-details"><div class="todo-text">${escapeHTML(t.text)}</div><div class="todo-meta"><span class="todo-priority-badge priority-${t.priority || 'medium'}">${labels[t.priority] || '보통'}</span>${t.duedate ? `<span class="todo-due-meta"><i class="fa-regular fa-calendar"></i>${escapeHTML(t.duedate)}</span>` : ''}</div></div></div><div class="todo-actions"><button class="btn-todo-action btn-todo-edit" title="수정"><i class="fa-solid fa-pen"></i></button><button class="btn-todo-action btn-todo-delete" title="삭제"><i class="fa-solid fa-trash"></i></button></div>`;
    item.querySelector('input').addEventListener('change', e => { t.completed = e.target.checked; t.updatedAt = new Date().toISOString(); saveDataToStorage(); renderTodoList(); renderDashboard(); });
    item.querySelector('.btn-todo-edit').addEventListener('click', () => startEditTodo(t.id));
    item.querySelector('.btn-todo-delete').addEventListener('click', () => { state.todos = state.todos.filter(x => x.id !== t.id); if (editingTodoId === t.id) setTodoFormMode('add'); saveDataToStorage(); renderTodoList(); renderDashboard(); });
    el.appendChild(item);
  });
}

// =====================================================
// NOTES
// =====================================================
function initNotes() {
  document.getElementById('btn-new-note')?.addEventListener('click', createNewNote);
  document.getElementById('btn-save-note')?.addEventListener('click', saveActiveNote);
  document.getElementById('btn-delete-note')?.addEventListener('click', deleteActiveNote);
  document.getElementById('btn-favorite-note')?.addEventListener('click', toggleNoteFavorite);
}

function createNewNote() {
  const note = { id: 'note_' + Date.now(), title: '', category: '', links: '', content: '', favorite: false, updatedAt: new Date().toISOString() };
  state.notes.unshift(note); activeNoteId = note.id;
  saveDataToStorage(); renderNotesList(); selectNote(note.id);
}

function selectNote(id) {
  activeNoteId = id;
  const note = state.notes.find(n => n.id === id);
  if (!note) return;
  document.getElementById('note-editor-placeholder')?.classList.add('hidden');
  document.getElementById('note-editor-form')?.classList.remove('hidden');
  document.getElementById('note-id').value = note.id;
  document.getElementById('note-title').value = note.title || '';
  document.getElementById('note-category').value = note.category || '';
  document.getElementById('note-links').value = note.links || '';
  document.getElementById('note-content').value = note.content || '';
  const star = document.querySelector('#btn-favorite-note i');
  if (star) star.className = note.favorite ? 'fa-solid fa-star' : 'fa-regular fa-star';
  renderNotesList();
}

function saveActiveNote() {
  if (!activeNoteId) return;
  const note = state.notes.find(n => n.id === activeNoteId);
  if (!note) return;
  note.title = document.getElementById('note-title').value.trim();
  note.category = document.getElementById('note-category').value.trim();
  note.links = document.getElementById('note-links').value.trim();
  note.content = document.getElementById('note-content').value;
  note.updatedAt = new Date().toISOString();
  saveDataToStorage(); renderNotesList(); renderDashboard();
}

function deleteActiveNote() {
  if (!activeNoteId || !confirm('정말 이 메모를 삭제하시겠습니까?')) return;
  state.notes = state.notes.filter(n => n.id !== activeNoteId);
  activeNoteId = null;
  saveDataToStorage(); renderNotesList(); renderDashboard();
  document.getElementById('note-editor-form')?.classList.add('hidden');
  document.getElementById('note-editor-placeholder')?.classList.remove('hidden');
}

function toggleNoteFavorite() {
  if (!activeNoteId) return;
  const note = state.notes.find(n => n.id === activeNoteId);
  if (!note) return;
  note.favorite = !note.favorite;
  saveActiveNote(); selectNote(note.id); renderDashboard();
}

function renderNotesList() {
  const el = document.getElementById('notes-list-items');
  if (!el) return;
  el.innerHTML = '';
  if (!state.notes.length) { el.innerHTML = '<div class="no-data">메모가 없습니다.</div>'; return; }
  state.notes.forEach(n => {
    const item = document.createElement('div');
    item.className = 'note-item' + (n.id === activeNoteId ? ' active' : '');
    item.innerHTML = `<div class="note-item-title">${escapeHTML(n.title || '제목 없는 메모')}${n.favorite ? '<span class="note-item-star"><i class="fa-solid fa-star"></i></span>' : ''}</div><div class="note-item-preview">${escapeHTML((n.content || '').slice(0, 60))}</div><div class="note-item-meta"><span class="note-item-category">${escapeHTML(n.category || '분류 없음')}</span><span>${n.updatedAt ? new Date(n.updatedAt).toLocaleDateString('ko-KR') : ''}</span></div>`;
    item.addEventListener('click', () => selectNote(n.id));
    el.appendChild(item);
  });
}

// =====================================================
// SAFE CLOUD SYNC
// =====================================================
function ensureMobileSyncStatusBox() {
  let box = document.getElementById('mobile-sync-status-box');
  if (box) return box;
  box = document.createElement('div');
  box.id = 'mobile-sync-status-box';
  box.className = 'sync-status offline';
  box.style.cssText = [
    'position:fixed',
    'left:0',
    'right:0',
    'top:0',
    'z-index:99999',
    'border-radius:0',
    'padding:calc(8px + env(safe-area-inset-top)) 14px 8px 14px',
    'background:rgba(15,12,32,.96)',
    'border-bottom:1px solid rgba(255,255,255,.14)',
    'font-size:12px',
    'display:none',
    'gap:8px',
    'align-items:center',
    'box-shadow:0 6px 18px rgba(0,0,0,.35)'
  ].join(';');
  box.innerHTML = '<i class="fa-solid fa-circle"></i><span id="mobile-sync-status-text">로컬 모드</span><button id="mobile-sync-status-close" style="margin-left:auto;background:transparent;border:0;color:inherit;font-size:18px;line-height:1;cursor:pointer">×</button>';
  document.body.appendChild(box);
  document.getElementById('mobile-sync-status-close')?.addEventListener('click', () => box.style.display = 'none');
  return box;
}

function setMobileSyncStatus(message, mode = 'offline', autoHide = true) {
  const box = ensureMobileSyncStatusBox();
  const text = document.getElementById('mobile-sync-status-text');
  if (!box || !text) return;
  box.className = `sync-status ${mode}`;
  box.style.display = 'flex';
  text.textContent = message;
  if (autoHide && mode === 'online') setTimeout(() => { box.style.display = 'none'; }, 3500);
}

function makeSyncButton(id, cls, icon, text) {
  let btn = document.getElementById(id);
  if (btn) return btn;
  btn = document.createElement('button');
  btn.type = 'button';
  btn.id = id;
  btn.className = cls;
  btn.innerHTML = `<i class="${icon}"></i> ${text}`;
  return btn;
}

function ensureManualSyncButtons() {
  const box = document.querySelector('.sync-actions-box');
  if (!box) return;
  const syncNowBtn = document.getElementById('btn-sync-now');
  const downloadBtn = makeSyncButton('btn-cloud-download', 'btn btn-secondary hidden', 'fa-solid fa-cloud-arrow-down', '클라우드 불러오기');
  const uploadBtn = makeSyncButton('btn-cloud-upload', 'btn btn-success hidden', 'fa-solid fa-cloud-arrow-up', '클라우드 업로드');
  if (!document.getElementById('btn-cloud-download')) box.appendChild(downloadBtn);
  if (!document.getElementById('btn-cloud-upload')) box.appendChild(uploadBtn);
  if (syncNowBtn) syncNowBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> 병합 동기화';
  downloadBtn.addEventListener('click', downloadFromCloud, { once: false });
  uploadBtn.addEventListener('click', uploadToCloud, { once: false });
}

function getSavedPatOrInput() {
  const patInput = document.getElementById('github-pat');
  const saved = typeof GithubSync !== 'undefined' ? GithubSync.getSettings().pat : '';
  return (patInput?.value || '').trim() || saved || '';
}

function initSettings() {
  document.getElementById('btn-export-json')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(getFullAppState(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `g-scheduler-backup-${getLocalDateString(new Date())}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  });
  document.getElementById('btn-trigger-import')?.addEventListener('click', () => document.getElementById('import-file-input')?.click());
  document.getElementById('import-file-input')?.addEventListener('change', e => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { restoreFullAppState(JSON.parse(reader.result)); alert('데이터 복원이 완료되었습니다.'); } catch { alert('JSON 파일을 읽을 수 없습니다.'); } };
    reader.readAsText(file);
  });

  ensureManualSyncButtons();

  const patInput = document.getElementById('github-pat');
  const gistIdInput = document.getElementById('github-gist-id');
  const syncNowBtn = document.getElementById('btn-sync-now');
  const syncForm = document.getElementById('github-sync-form');
  const downloadBtn = document.getElementById('btn-cloud-download');
  const uploadBtn = document.getElementById('btn-cloud-upload');

  if (patInput) {
    patInput.setAttribute('autocomplete', 'new-password');
    patInput.setAttribute('autocapitalize', 'off');
    patInput.setAttribute('spellcheck', 'false');
  }

  if (typeof GithubSync !== 'undefined') {
    const settings = GithubSync.getSettings();
    if (patInput && settings.pat) {
      patInput.value = settings.pat;
      patInput.placeholder = '저장된 PAT 사용 중';
    }
    if (gistIdInput && settings.gistId) gistIdInput.value = settings.gistId;
    const configured = !!settings.pat;
    [syncNowBtn, downloadBtn, uploadBtn].forEach(btn => btn && btn.classList.toggle('hidden', !configured));
  }

  if (syncForm && !syncForm.dataset.finalSafeSync) {
    syncForm.dataset.finalSafeSync = '1';
    syncForm.addEventListener('submit', e => {
      e.preventDefault();
      if (typeof GithubSync === 'undefined') return alert('github-sync.js가 로드되지 않았습니다.');
      const existing = GithubSync.getSettings();
      const patVal = (patInput?.value || '').trim() || existing.pat;
      const gistIdVal = (gistIdInput?.value || '').trim() || existing.gistId;
      if (!patVal) return alert('GitHub PAT를 입력해주세요.');
      GithubSync.saveSettings(patVal, gistIdVal);
      [syncNowBtn, downloadBtn, uploadBtn].forEach(btn => btn && btn.classList.remove('hidden'));
      if (patInput) {
        patInput.value = patVal;
        patInput.placeholder = '저장된 PAT 사용 중';
      }
      updateSyncIndicator(); renderSyncLogBox();
      setMobileSyncStatus('설정 저장 완료 | 불러오기 또는 업로드를 선택하세요', 'online');
      alert('동기화 설정이 저장되었습니다. 이제 클라우드 불러오기 또는 클라우드 업로드를 선택하세요.');
    }, true);
  }

  syncNowBtn?.addEventListener('click', executeGitHubSync);
  updateSyncIndicator();
  renderSyncLogBox();
}

function assertCloudReady() {
  if (typeof GithubSync === 'undefined') throw new Error('github-sync.js가 로드되지 않았습니다.');
  const pat = getSavedPatOrInput();
  const gistId = document.getElementById('github-gist-id')?.value.trim() || GithubSync.getSettings().gistId;
  if (!pat) throw new Error('PAT가 저장되지 않았습니다.');
  GithubSync.saveSettings(pat, gistId);
}

async function downloadFromCloud() {
  const btn = document.getElementById('btn-cloud-download');
  try {
    assertCloudReady();
    btn && (btn.disabled = true);
    updateSyncIndicator('syncing');
    setMobileSyncStatus('클라우드에서 불러오는 중...', 'syncing', false);
    const remoteData = await GithubSync.downloadData();
    if (!remoteData || countAppData(remoteData) === 0) throw new Error('클라우드에 불러올 데이터가 없습니다.');
    restoreFullAppState(remoteData);
    localStorage.setItem(GithubSync.KEYS.LAST_SYNC, new Date().toISOString());
    updateSyncIndicator('online'); renderSyncLogBox();
    setMobileSyncStatus('클라우드 불러오기 완료', 'online');
    alert('클라우드 데이터를 이 기기로 불러왔습니다.');
  } catch (err) {
    console.error(err);
    updateSyncIndicator('offline');
    setMobileSyncStatus('불러오기 실패 | ' + err.message, 'offline', false);
    alert('클라우드 불러오기 실패: ' + err.message);
  } finally {
    btn && (btn.disabled = false);
  }
}

async function uploadToCloud() {
  const btn = document.getElementById('btn-cloud-upload');
  try {
    assertCloudReady();
    btn && (btn.disabled = true);
    updateSyncIndicator('syncing');
    setMobileSyncStatus('클라우드에 업로드 중...', 'syncing', false);
    const localData = getFullAppState();
    const localCount = countAppData(localData);
    let remoteCount = 0;
    try {
      const remoteData = await GithubSync.downloadData();
      remoteCount = countAppData(remoteData);
    } catch (e) {
      remoteCount = 0;
    }
    if (localCount === 0 && remoteCount > 0) {
      throw new Error('현재 기기 데이터가 비어 있어 업로드를 차단했습니다. 먼저 클라우드 불러오기를 해주세요.');
    }
    await GithubSync.uploadData(localData);
    localStorage.setItem(GithubSync.KEYS.LAST_SYNC, new Date().toISOString());
    updateSyncIndicator('online'); renderSyncLogBox();
    setMobileSyncStatus('클라우드 업로드 완료', 'online');
    alert('현재 기기 데이터를 클라우드에 업로드했습니다.');
  } catch (err) {
    console.error(err);
    updateSyncIndicator('offline');
    setMobileSyncStatus('업로드 실패 | ' + err.message, 'offline', false);
    alert('클라우드 업로드 실패: ' + err.message);
  } finally {
    btn && (btn.disabled = false);
  }
}

async function executeGitHubSync() {
  const syncNowBtn = document.getElementById('btn-sync-now');
  try {
    assertCloudReady();
    syncNowBtn && (syncNowBtn.disabled = true);
    updateSyncIndicator('syncing');
    setMobileSyncStatus('병합 동기화 중...', 'syncing', false);
    const localData = getFullAppState();
    const remoteData = await GithubSync.downloadData();
    let finalData;
    if (!remoteData || countAppData(remoteData) === 0) {
      finalData = localData;
    } else if (countAppData(localData) === 0) {
      finalData = remoteData;
    } else {
      finalData = mergeAppData(localData, remoteData);
    }
    restoreFullAppState(finalData);
    await GithubSync.uploadData(getFullAppState());
    localStorage.setItem(GithubSync.KEYS.LAST_SYNC, new Date().toISOString());
    updateSyncIndicator('online'); renderSyncLogBox();
    setMobileSyncStatus('병합 동기화 완료', 'online');
    alert('병합 동기화가 완료되었습니다.');
  } catch (err) {
    console.error(err);
    updateSyncIndicator('offline');
    setMobileSyncStatus('동기화 실패 | ' + err.message, 'offline', false);
    alert('동기화 실패: ' + err.message);
  } finally {
    syncNowBtn && (syncNowBtn.disabled = false);
  }
}

function updateSyncIndicator(forceMode) {
  const indicator = document.getElementById('sidebar-sync-indicator');
  const text = document.getElementById('sidebar-sync-text');
  if (!indicator || !text) return;
  const configured = typeof GithubSync !== 'undefined' && GithubSync.isConfigured();
  const mode = forceMode || (configured ? 'online' : 'offline');
  indicator.classList.remove('online', 'offline', 'syncing');
  indicator.classList.add(mode);
  text.textContent = mode === 'syncing' ? '동기화 중' : configured ? '클라우드 동기화' : '로컬 모드';
}

function renderSyncLogBox() {
  const logBox = document.getElementById('sync-log-box');
  const gistLink = document.getElementById('gist-url-link');
  const lastSyncTimeEl = document.getElementById('last-sync-time');
  if (!logBox || typeof GithubSync === 'undefined') return;
  const s = GithubSync.getSettings();
  if (s.pat || s.gistId) logBox.classList.remove('hidden'); else logBox.classList.add('hidden');
  if (gistLink && s.gistId) {
    gistLink.href = `https://gist.github.com/${s.gistId}`;
    gistLink.textContent = '이동하기';
  }
  if (lastSyncTimeEl) {
    const last = localStorage.getItem(GithubSync.KEYS.LAST_SYNC);
    lastSyncTimeEl.textContent = last ? new Date(last).toLocaleString('ko-KR') : '없음';
  }
}

// =====================================================
// PATCH 20260729: Calendar search, Korean holidays, row-height fix support, expanded colors
// =====================================================
const EVENT_COLOR_OPTIONS_V2 = [
  ['#3498db', '파란색'], ['#2ecc71', '녹색'], ['#e74c3c', '빨간색'], ['#f1c40f', '노란색'], ['#9b59b6', '보라색'],
  ['#1abc9c', '민트'], ['#e67e22', '주황색'], ['#34495e', '남색'], ['#ff6b81', '핑크'], ['#00b894', '청록'],
  ['#6c5ce7', '인디고'], ['#fd79a8', '라즈베리'], ['#00cec9', '터쿼이즈'], ['#d63031', '진홍'], ['#0984e3', '스카이블루'],
  ['#b2bec3', '회색'], ['#2d3436', '차콜'], ['#fab1a0', '살구'], ['#55efc4', '라이트민트'], ['#a29bfe', '라벤더']
];

let calendarSearchQuery = '';
const HOLIDAY_CACHE_KEY = 'gs_kr_holidays_cache_v2';
let krHolidayMap = {};
let holidayLoadStarted = false;

function ensureEventColorOptionsV2() {
  const select = document.getElementById('event-color');
  if (!select || select.dataset.extendedColors === '1') return;
  const current = select.value || '#3498db';
  select.innerHTML = '';
  EVENT_COLOR_OPTIONS_V2.forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    opt.style.backgroundColor = value;
    opt.style.color = isLightColor(value) ? '#111' : '#fff';
    select.appendChild(opt);
  });
  select.value = EVENT_COLOR_OPTIONS_V2.some(([v]) => v === current) ? current : '#3498db';
  select.dataset.extendedColors = '1';
}

function isLightColor(hex) {
  const c = String(hex || '').replace('#', '');
  if (c.length !== 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

function ensureCalendarSearchUI() {
  const actions = document.querySelector('.calendar-actions');
  const calendarContainer = document.querySelector('.calendar-container');
  if (!actions || !calendarContainer) return;

  if (!document.getElementById('calendar-search-wrap')) {
    const wrap = document.createElement('div');
    wrap.id = 'calendar-search-wrap';
    wrap.className = 'calendar-search-wrap';
    wrap.innerHTML = `
      <i class="fa-solid fa-magnifying-glass"></i>
      <input type="search" id="calendar-search-input" placeholder="일정 검색" autocomplete="off">
      <button type="button" id="calendar-search-clear" title="검색 초기화">×</button>
    `;
    actions.insertBefore(wrap, actions.firstChild);

    const input = wrap.querySelector('#calendar-search-input');
    const clear = wrap.querySelector('#calendar-search-clear');
    input.addEventListener('input', () => {
      calendarSearchQuery = input.value.trim().toLowerCase();
      renderCalendar();
      renderCalendarSearchResults();
    });
    clear.addEventListener('click', () => {
      input.value = '';
      calendarSearchQuery = '';
      renderCalendar();
      renderCalendarSearchResults();
      input.focus();
    });
  }

  if (!document.getElementById('calendar-search-results')) {
    const results = document.createElement('div');
    results.id = 'calendar-search-results';
    results.className = 'calendar-search-results hidden';
    const header = calendarContainer.querySelector('.calendar-header');
    header.insertAdjacentElement('afterend', results);
  }
}

function eventMatchesSearch(evt) {
  if (!calendarSearchQuery) return true;
  const haystack = [
    evt.title || '', evt.desc || '', evt.startDate || '', evt.endDate || '', evt.startTime || '', evt.endTime || ''
  ].join(' ').toLowerCase();
  return haystack.includes(calendarSearchQuery);
}

function getMatchingEventsForSearch() {
  if (!calendarSearchQuery) return [];
  return state.events
    .map(migrateEventTimeFields)
    .filter(eventMatchesSearch)
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '') || (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
}

function renderCalendarSearchResults() {
  const box = document.getElementById('calendar-search-results');
  if (!box) return;
  const matches = getMatchingEventsForSearch();
  if (!calendarSearchQuery) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  box.classList.remove('hidden');
  if (!matches.length) {
    box.innerHTML = `<div class="calendar-search-empty">검색 결과가 없습니다.</div>`;
    return;
  }
  box.innerHTML = `
    <div class="calendar-search-title">검색 결과 ${matches.length}건</div>
    <div class="calendar-search-list"></div>
  `;
  const list = box.querySelector('.calendar-search-list');
  matches.slice(0, 30).forEach(evt => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'calendar-search-item';
    item.innerHTML = `
      <span class="calendar-search-color" style="background:${evt.color || '#3498db'}"></span>
      <span class="calendar-search-main">
        <strong>${escapeHTML(evt.title || '제목 없음')}</strong>
        <small>${escapeHTML(evt.startDate || '')}${evt.endDate && evt.endDate !== evt.startDate ? ' ~ ' + escapeHTML(evt.endDate) : ''} ${escapeHTML(formatEventTime(evt))}</small>
      </span>
    `;
    item.addEventListener('click', () => {
      const d = evt.startDate ? new Date(evt.startDate) : new Date();
      if (!Number.isNaN(d.getTime())) state.currentDate = new Date(d.getFullYear(), d.getMonth(), 1);
      renderCalendar();
      openEventModal(evt);
    });
    list.appendChild(item);
  });
}

function loadHolidayCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(HOLIDAY_CACHE_KEY) || '{}');
    if (cached && cached.data) krHolidayMap = cached.data;
  } catch {
    krHolidayMap = {};
  }
}

async function loadKoreanHolidays() {
  if (holidayLoadStarted) return;
  holidayLoadStarted = true;
  loadHolidayCache();
  try {
    const res = await fetch('https://holidays.hyunbin.page/basic.json', { cache: 'force-cache' });
    if (!res.ok) throw new Error('holiday fetch failed');
    const data = await res.json();
    const normalized = {};
    Object.entries(data || {}).forEach(([date, value]) => {
      normalized[date] = Array.isArray(value) ? value : [String(value)];
    });
    krHolidayMap = normalized;
    localStorage.setItem(HOLIDAY_CACHE_KEY, JSON.stringify({ updatedAt: new Date().toISOString(), data: krHolidayMap }));
    renderCalendar();
  } catch (err) {
    console.warn('공휴일 데이터를 불러오지 못했습니다. 기본 공휴일만 표시합니다.', err);
    addFallbackFixedHolidaysForVisibleYear();
    renderCalendar();
  }
}

function addFallbackFixedHolidaysForVisibleYear() {
  const y = state.currentDate.getFullYear();
  const fixed = {
    [`${y}-01-01`]: ['신정'],
    [`${y}-03-01`]: ['삼일절'],
    [`${y}-05-05`]: ['어린이날'],
    [`${y}-06-06`]: ['현충일'],
    [`${y}-08-15`]: ['광복절'],
    [`${y}-10-03`]: ['개천절'],
    [`${y}-10-09`]: ['한글날'],
    [`${y}-12-25`]: ['기독탄신일']
  };
  krHolidayMap = { ...fixed, ...krHolidayMap };
}

function getHolidaysForDate(dateStr) {
  const arr = krHolidayMap[dateStr];
  return Array.isArray(arr) ? arr : [];
}

// Override initCalendar with search/color/holiday enhancement
function initCalendar() {
  ensureEventTimeFields();
  ensureEventColorOptionsV2();
  ensureCalendarSearchUI();
  loadHolidayCache();
  loadKoreanHolidays();

  document.getElementById('cal-prev-month')?.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    addFallbackFixedHolidaysForVisibleYear();
    renderCalendar();
    loadKoreanHolidays();
  });
  document.getElementById('cal-next-month')?.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    addFallbackFixedHolidaysForVisibleYear();
    renderCalendar();
    loadKoreanHolidays();
  });
  document.getElementById('cal-today')?.addEventListener('click', () => {
    state.currentDate = new Date();
    renderCalendar();
  });
  document.getElementById('btn-add-event')?.addEventListener('click', () => openEventModal(null, getLocalDateString(new Date())));

  document.getElementById('event-start-date')?.addEventListener('change', () => {
    const s = document.getElementById('event-start-date');
    const e = document.getElementById('event-end-date');
    if (s && e && (!e.value || e.value < s.value)) e.value = s.value;
  });

  document.getElementById('event-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('event-id').value;
    const title = document.getElementById('event-title').value.trim();
    const startDate = document.getElementById('event-start-date').value;
    const endDate = document.getElementById('event-end-date').value;
    const startTime = document.getElementById('event-start-time')?.value || '';
    const endTime = document.getElementById('event-end-time')?.value || '';
    const color = document.getElementById('event-color').value;
    const desc = document.getElementById('event-desc').value.trim();
    if (!title) return alert('일정 제목을 입력해주세요.');
    if (startDate > endDate) return alert('종료일은 시작일보다 빠를 수 없습니다.');
    if (startDate === endDate && startTime && endTime && endTime < startTime) return alert('같은 날짜에서는 종료시간이 시작시간보다 빠를 수 없습니다.');
    const eventData = { id: id || 'evt_' + Date.now(), title, startDate, endDate, startTime, endTime, color, desc, updatedAt: new Date().toISOString() };
    const idx = state.events.findIndex(x => x.id === id);
    if (idx >= 0) state.events[idx] = eventData;
    else state.events.push(eventData);
    saveDataToStorage();
    renderDashboard();
    renderCalendar();
    renderCalendarSearchResults();
    closeModal(document.getElementById('modal-event'));
  });

  document.getElementById('btn-delete-event')?.addEventListener('click', () => {
    const id = document.getElementById('event-id').value;
    if (!id || !confirm('일정을 삭제하시겠습니까?')) return;
    state.events = state.events.filter(e => e.id !== id);
    saveDataToStorage();
    renderDashboard();
    renderCalendar();
    renderCalendarSearchResults();
    closeModal(document.getElementById('modal-event'));
  });
  document.getElementById('btn-cancel-event')?.addEventListener('click', () => closeModal(document.getElementById('modal-event')));
}

// Override renderCalendar with search + holiday + row-auto rendering
function renderCalendar() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const header = document.getElementById('calendar-month-year');
  const grid = document.getElementById('calendar-grid');
  if (header) header.textContent = `${year}년 ${month + 1}월`;
  if (!grid) return;
  grid.innerHTML = '';

  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const prevLastDay = new Date(year, month, 0).getDate();
  const cells = [];
  for (let x = firstDayIndex; x > 0; x--) {
    const day = prevLastDay - x + 1;
    cells.push({ day, dateStr: getLocalDateString(new Date(year, month - 1, day)), isOtherMonth: true });
  }
  for (let i = 1; i <= lastDay; i++) {
    cells.push({ day: i, dateStr: getLocalDateString(new Date(year, month, i)), isOtherMonth: false });
  }
  while (cells.length < 42) {
    const day = cells.length - firstDayIndex - lastDay + 1;
    cells.push({ day, dateStr: getLocalDateString(new Date(year, month + 1, day)), isOtherMonth: true });
  }

  const today = getLocalDateString(new Date());
  state.events = state.events.map(migrateEventTimeFields);
  cells.forEach(cell => {
    const cellEl = document.createElement('div');
    cellEl.className = 'calendar-cell';
    if (cell.isOtherMonth) cellEl.classList.add('other-month');
    if (cell.dateStr === today) cellEl.classList.add('today');
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(cell.dateStr).getDay()];
    cellEl.innerHTML = `<div class="cell-date-header"><span class="cell-num">${cell.day}</span><span class="cell-weekday">${weekday}</span></div><div class="cell-events"></div>`;
    const eventsContainer = cellEl.querySelector('.cell-events');

    getHolidaysForDate(cell.dateStr).forEach(name => {
      if (calendarSearchQuery && !String(name).toLowerCase().includes(calendarSearchQuery)) return;
      const holiday = document.createElement('div');
      holiday.className = 'event-badge holiday-badge';
      holiday.textContent = name;
      holiday.title = `공휴일: ${name}`;
      eventsContainer.appendChild(holiday);
    });

    state.events
      .filter(e => isDateInRange(cell.dateStr, e.startDate, e.endDate))
      .filter(eventMatchesSearch)
      .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'))
      .forEach(evt => {
        const badge = document.createElement('div');
        badge.className = 'event-badge';
        badge.style.backgroundColor = evt.color || '#3498db';
        badge.style.color = isLightColor(evt.color || '#3498db') ? '#111' : '#fff';
        badge.textContent = `${formatEventTime(evt)}${evt.title}`;
        badge.title = badge.textContent;
        badge.addEventListener('click', ev => {
          ev.stopPropagation();
          openEventModal(evt);
        });
        eventsContainer.appendChild(badge);
      });
    cellEl.addEventListener('click', () => openEventModal(null, cell.dateStr));
    grid.appendChild(cellEl);
  });
  renderCalendarSearchResults();
}

// Override modal open to keep expanded color set
function openEventModal(eventObj = null, defaultDateStr = null) {
  ensureEventTimeFields();
  ensureEventColorOptionsV2();
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
    const select = document.getElementById('event-color');
    if (select) select.value = EVENT_COLOR_OPTIONS_V2.some(([v]) => v === eventObj.color) ? eventObj.color : '#3498db';
    document.getElementById('event-desc').value = eventObj.desc || '';
    deleteBtn?.classList.remove('hidden');
  } else {
    if (titleHeader) titleHeader.textContent = '새 일정 추가';
    document.getElementById('event-id').value = '';
    document.getElementById('event-start-date').value = selectedDate;
    document.getElementById('event-end-date').value = selectedDate;
    document.getElementById('event-start-time').value = '';
    document.getElementById('event-end-time').value = '';
    const select = document.getElementById('event-color');
    if (select) select.value = '#3498db';
    deleteBtn?.classList.add('hidden');
  }
  openModal(document.getElementById('modal-event'));
}


// =====================================================
// PATCH 20260729-2: Date click opens day schedule detail instead of add modal
// =====================================================
function getEventsForDate(dateStr) {
  return state.events
    .map(migrateEventTimeFields)
    .filter(e => isDateInRange(dateStr, e.startDate, e.endDate))
    .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99') || (a.title || '').localeCompare(b.title || ''));
}

function ensureDayScheduleModal() {
  let modal = document.getElementById('modal-day-schedule');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'modal-day-schedule';
  modal.innerHTML = `
    <div class="modal-content day-schedule-modal-content">
      <div class="modal-header">
        <h3 id="day-schedule-title">일정 목록</h3>
        <button class="btn-close" id="modal-day-schedule-close">&times;</button>
      </div>
      <div id="day-schedule-list" class="day-schedule-list"></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="btn-close-day-schedule">닫기</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('modal-day-schedule-close')?.addEventListener('click', () => closeModal(modal));
  document.getElementById('btn-close-day-schedule')?.addEventListener('click', () => closeModal(modal));
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal(modal);
  });
  return modal;
}

function openDayScheduleModal(dateStr) {
  const modal = ensureDayScheduleModal();
  const title = document.getElementById('day-schedule-title');
  const list = document.getElementById('day-schedule-list');
  const d = new Date(dateStr);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const displayDate = Number.isNaN(d.getTime()) ? dateStr : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`;
  if (title) title.textContent = `${displayDate} 일정`;
  if (!list) return;
  list.innerHTML = '';

  const holidays = typeof getHolidaysForDate === 'function' ? getHolidaysForDate(dateStr) : [];
  const events = getEventsForDate(dateStr);

  if (!holidays.length && !events.length) {
    list.innerHTML = '<div class="day-schedule-empty">등록된 일정이 없습니다.</div>';
    openModal(modal);
    return;
  }

  holidays.forEach(name => {
    const item = document.createElement('div');
    item.className = 'day-schedule-item holiday-detail-item';
    item.innerHTML = `
      <div class="day-schedule-color holiday-dot"></div>
      <div class="day-schedule-body">
        <div class="day-schedule-name">${escapeHTML(name)}</div>
        <div class="day-schedule-meta">공휴일</div>
      </div>
    `;
    list.appendChild(item);
  });

  events.forEach(evt => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'day-schedule-item day-event-item';
    item.innerHTML = `
      <span class="day-schedule-color" style="background:${evt.color || '#3498db'}"></span>
      <span class="day-schedule-body">
        <strong class="day-schedule-name">${escapeHTML(evt.title || '제목 없음')}</strong>
        <span class="day-schedule-meta">${escapeHTML(formatEventTime(evt))}${escapeHTML(evt.startDate || '')}${evt.endDate && evt.endDate !== evt.startDate ? ' ~ ' + escapeHTML(evt.endDate) : ''}</span>
        ${evt.desc ? `<span class="day-schedule-desc">${escapeHTML(evt.desc)}</span>` : ''}
      </span>
    `;
    item.addEventListener('click', () => {
      closeModal(modal);
      openEventModal(evt);
    });
    list.appendChild(item);
  });
  openModal(modal);
}

// Override renderCalendar once more: date cell click = detail modal, add only via [일정 추가] button
function renderCalendar() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const header = document.getElementById('calendar-month-year');
  const grid = document.getElementById('calendar-grid');
  if (header) header.textContent = `${year}년 ${month + 1}월`;
  if (!grid) return;
  grid.innerHTML = '';

  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const prevLastDay = new Date(year, month, 0).getDate();
  const cells = [];
  for (let x = firstDayIndex; x > 0; x--) {
    const day = prevLastDay - x + 1;
    cells.push({ day, dateStr: getLocalDateString(new Date(year, month - 1, day)), isOtherMonth: true });
  }
  for (let i = 1; i <= lastDay; i++) {
    cells.push({ day: i, dateStr: getLocalDateString(new Date(year, month, i)), isOtherMonth: false });
  }
  while (cells.length < 42) {
    const day = cells.length - firstDayIndex - lastDay + 1;
    cells.push({ day, dateStr: getLocalDateString(new Date(year, month + 1, day)), isOtherMonth: true });
  }

  const today = getLocalDateString(new Date());
  state.events = state.events.map(migrateEventTimeFields);

  cells.forEach(cell => {
    const cellEl = document.createElement('div');
    cellEl.className = 'calendar-cell';
    if (cell.isOtherMonth) cellEl.classList.add('other-month');
    if (cell.dateStr === today) cellEl.classList.add('today');
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(cell.dateStr).getDay()];
    cellEl.innerHTML = `<div class="cell-date-header"><span class="cell-num">${cell.day}</span><span class="cell-weekday">${weekday}</span></div><div class="cell-events"></div>`;
    const eventsContainer = cellEl.querySelector('.cell-events');

    const holidays = typeof getHolidaysForDate === 'function' ? getHolidaysForDate(cell.dateStr) : [];
    holidays.forEach(name => {
      if (calendarSearchQuery && !String(name).toLowerCase().includes(calendarSearchQuery)) return;
      const holiday = document.createElement('div');
      holiday.className = 'event-badge holiday-badge';
      holiday.textContent = name;
      holiday.title = `공휴일: ${name}`;
      eventsContainer.appendChild(holiday);
    });

    state.events
      .filter(e => isDateInRange(cell.dateStr, e.startDate, e.endDate))
      .filter(eventMatchesSearch)
      .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'))
      .forEach(evt => {
        const badge = document.createElement('div');
        badge.className = 'event-badge';
        badge.style.backgroundColor = evt.color || '#3498db';
        badge.style.color = isLightColor(evt.color || '#3498db') ? '#111' : '#fff';
        badge.textContent = `${formatEventTime(evt)}${evt.title}`;
        badge.title = badge.textContent;
        badge.addEventListener('click', ev => {
          ev.stopPropagation();
          openEventModal(evt);
        });
        eventsContainer.appendChild(badge);
      });

    cellEl.addEventListener('click', () => openDayScheduleModal(cell.dateStr));
    grid.appendChild(cellEl);
  });
  if (typeof renderCalendarSearchResults === 'function') renderCalendarSearchResults();
}


// =====================================================
// PATCH 20260730: recurring events, reminders, event completion
// =====================================================
const EVENT_REPEAT_OPTIONS_V3 = [
  ['none', '반복 없음'],
  ['daily', '매일'],
  ['weekly', '매주'],
  ['monthly', '매월'],
  ['yearly', '매년']
];
const EVENT_REMINDER_OPTIONS_V3 = [
  ['none', '알림 없음'],
  ['at', '정시'],
  ['10m', '10분 전'],
  ['30m', '30분 전'],
  ['1h', '1시간 전'],
  ['1d', '1일 전']
];
const EVENT_NOTIFY_SENT_KEY_V3 = 'gs_event_notifications_sent_v3';
let eventReminderTimerV3 = null;

function ensureEventAdvancedFieldsV3() {
  ensureEventTimeFields();
  const colorSelect = document.getElementById('event-color');
  if (!colorSelect || document.getElementById('event-repeat')) return;
  const colorRow = colorSelect.closest('.form-row') || colorSelect.closest('.form-group');
  const row = document.createElement('div');
  row.className = 'form-row event-advanced-row';
  row.innerHTML = `
    <div class="form-group">
      <label for="event-repeat">반복</label>
      <select id="event-repeat"></select>
    </div>
    <div class="form-group">
      <label for="event-reminder">알림</label>
      <select id="event-reminder"></select>
    </div>
  `;
  if (colorRow) colorRow.insertAdjacentElement('afterend', row);
  const repeat = document.getElementById('event-repeat');
  const reminder = document.getElementById('event-reminder');
  EVENT_REPEAT_OPTIONS_V3.forEach(([value, label]) => repeat.insertAdjacentHTML('beforeend', `<option value="${value}">${label}</option>`));
  EVENT_REMINDER_OPTIONS_V3.forEach(([value, label]) => reminder.insertAdjacentHTML('beforeend', `<option value="${value}">${label}</option>`));

  const desc = document.getElementById('event-desc');
  if (desc && !document.getElementById('event-completed-wrap')) {
    const completedWrap = document.createElement('label');
    completedWrap.id = 'event-completed-wrap';
    completedWrap.className = 'event-completed-wrap';
    completedWrap.innerHTML = '<input type="checkbox" id="event-completed"> <span>일정 완료</span>';
    desc.closest('.form-group')?.insertAdjacentElement('afterend', completedWrap);
  }
}

function getRepeatValue(evt) {
  return evt.repeat || evt.repeatType || 'none';
}

function getEventSpanDays(evt) {
  const s = new Date(evt.startDate);
  const e = new Date(evt.endDate || evt.startDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  return Math.max(0, Math.round((e - s) / 86400000));
}

function addDaysToDateString(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}

function monthDiff(from, to) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function isRecurringEventOnDate(evt, dateStr) {
  evt = migrateEventTimeFields(evt);
  const repeat = getRepeatValue(evt);
  if (!repeat || repeat === 'none') return isDateInRange(dateStr, evt.startDate, evt.endDate);
  if (!evt.startDate) return false;
  const base = new Date(evt.startDate);
  const target = new Date(dateStr);
  if (Number.isNaN(base.getTime()) || Number.isNaN(target.getTime())) return false;
  if (target < new Date(getLocalDateString(base))) return false;

  const span = getEventSpanDays(evt);
  for (let offset = 0; offset <= span; offset++) {
    const check = new Date(target);
    check.setDate(check.getDate() - offset);
    if (check < base) continue;
    if (repeat === 'daily') return true;
    if (repeat === 'weekly') {
      const diffDays = Math.round((check - base) / 86400000);
      if (diffDays >= 0 && diffDays % 7 === 0) return true;
    }
    if (repeat === 'monthly') {
      if (check.getDate() === base.getDate() && monthDiff(base, check) >= 0) return true;
    }
    if (repeat === 'yearly') {
      if (check.getMonth() === base.getMonth() && check.getDate() === base.getDate() && check.getFullYear() >= base.getFullYear()) return true;
    }
  }
  return false;
}

function getOccurrenceForDate(evt, dateStr) {
  const repeat = getRepeatValue(evt);
  const completedMap = evt.completedOccurrences || {};
  const occurrence = {
    ...migrateEventTimeFields(evt),
    occurrenceDate: dateStr,
    occurrenceKey: `${evt.id || 'evt'}__${dateStr}`,
    isRecurringOccurrence: repeat && repeat !== 'none',
    completed: repeat && repeat !== 'none' ? !!completedMap[dateStr] : !!evt.completed
  };
  return occurrence;
}

function getEventsForDate(dateStr) {
  return state.events
    .map(migrateEventTimeFields)
    .filter(e => isRecurringEventOnDate(e, dateStr))
    .map(e => getOccurrenceForDate(e, dateStr))
    .sort((a, b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99') || (a.title || '').localeCompare(b.title || ''));
}

function toggleEventCompleted(evt, dateStr) {
  const id = evt.id;
  const idx = state.events.findIndex(e => e.id === id);
  if (idx < 0) return;
  const original = state.events[idx];
  const repeat = getRepeatValue(original);
  if (repeat && repeat !== 'none') {
    original.completedOccurrences = original.completedOccurrences || {};
    original.completedOccurrences[dateStr] = !original.completedOccurrences[dateStr];
  } else {
    original.completed = !original.completed;
  }
  original.updatedAt = new Date().toISOString();
  saveDataToStorage();
  renderDashboard();
  renderCalendar();
  if (typeof renderCalendarSearchResults === 'function') renderCalendarSearchResults();
}

function getAllEventOccurrencesForSearchV3() {
  const year = state.currentDate.getFullYear();
  const start = new Date(year - 1, 0, 1);
  const end = new Date(year + 1, 11, 31);
  const result = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = getLocalDateString(cursor);
    getEventsForDate(dateStr).forEach(evt => result.push(evt));
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function getMatchingEventsForSearch() {
  if (!calendarSearchQuery) return [];
  return getAllEventOccurrencesForSearchV3()
    .filter(eventMatchesSearch)
    .sort((a, b) => (a.occurrenceDate || a.startDate || '').localeCompare(b.occurrenceDate || b.startDate || '') || (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
}

function getReminderOffsetMinutes(value) {
  if (value === 'at') return 0;
  if (value === '10m') return 10;
  if (value === '30m') return 30;
  if (value === '1h') return 60;
  if (value === '1d') return 1440;
  return null;
}

function getSentNotificationMapV3() {
  try { return JSON.parse(localStorage.getItem(EVENT_NOTIFY_SENT_KEY_V3) || '{}'); }
  catch { return {}; }
}

function saveSentNotificationMapV3(map) {
  localStorage.setItem(EVENT_NOTIFY_SENT_KEY_V3, JSON.stringify(map));
}

function requestNotificationPermissionV3() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission().catch(() => {});
}

function runEventReminderCheckV3() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const sent = getSentNotificationMapV3();
  for (let i = -1; i <= 14; i++) {
    const dateStr = addDaysToDateString(getLocalDateString(now), i);
    getEventsForDate(dateStr).forEach(evt => {
      const reminder = evt.reminder || 'none';
      const offset = getReminderOffsetMinutes(reminder);
      if (offset === null || !evt.startTime || evt.completed) return;
      const eventTime = new Date(`${dateStr}T${evt.startTime}:00`);
      if (Number.isNaN(eventTime.getTime())) return;
      const notifyAt = new Date(eventTime.getTime() - offset * 60000);
      const diff = now.getTime() - notifyAt.getTime();
      const key = `${evt.occurrenceKey || evt.id}_${reminder}_${dateStr}_${evt.startTime}`;
      if (diff >= 0 && diff < 65000 && !sent[key]) {
        new Notification(evt.title || '일정 알림', {
          body: `${dateStr} ${formatEventTime(evt)}${evt.desc || ''}`.trim(),
          tag: key
        });
        sent[key] = new Date().toISOString();
      }
    });
  }
  saveSentNotificationMapV3(sent);
}

function startEventReminderTimerV3() {
  if (eventReminderTimerV3) return;
  requestNotificationPermissionV3();
  runEventReminderCheckV3();
  eventReminderTimerV3 = setInterval(runEventReminderCheckV3, 60000);
}

function buildEventBadgeElementV3(evt) {
  const badge = document.createElement('div');
  badge.className = 'event-badge' + (evt.completed ? ' event-completed' : '');
  badge.style.backgroundColor = evt.color || '#3498db';
  badge.style.color = isLightColor(evt.color || '#3498db') ? '#111' : '#fff';
  const repeatMark = evt.isRecurringOccurrence ? '↻ ' : '';
  const doneMark = evt.completed ? '✓ ' : '';
  badge.textContent = `${doneMark}${repeatMark}${formatEventTime(evt)}${evt.title}`;
  badge.title = badge.textContent;
  badge.addEventListener('click', ev => {
    ev.stopPropagation();
    openEventModal(evt);
  });
  return badge;
}

// Override initCalendar for repeat/reminder/completion fields
function initCalendar() {
  ensureEventTimeFields();
  ensureEventColorOptionsV2();
  ensureEventAdvancedFieldsV3();
  ensureCalendarSearchUI();
  loadHolidayCache();
  loadKoreanHolidays();
  startEventReminderTimerV3();

  document.getElementById('cal-prev-month')?.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    addFallbackFixedHolidaysForVisibleYear();
    renderCalendar();
    loadKoreanHolidays();
  });
  document.getElementById('cal-next-month')?.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    addFallbackFixedHolidaysForVisibleYear();
    renderCalendar();
    loadKoreanHolidays();
  });
  document.getElementById('cal-today')?.addEventListener('click', () => {
    state.currentDate = new Date();
    renderCalendar();
  });
  document.getElementById('btn-add-event')?.addEventListener('click', () => openEventModal(null, getLocalDateString(new Date())));

  document.getElementById('event-start-date')?.addEventListener('change', () => {
    const s = document.getElementById('event-start-date');
    const e = document.getElementById('event-end-date');
    if (s && e && (!e.value || e.value < s.value)) e.value = s.value;
  });

  document.getElementById('event-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('event-id').value;
    const title = document.getElementById('event-title').value.trim();
    const startDate = document.getElementById('event-start-date').value;
    const endDate = document.getElementById('event-end-date').value;
    const startTime = document.getElementById('event-start-time')?.value || '';
    const endTime = document.getElementById('event-end-time')?.value || '';
    const color = document.getElementById('event-color').value;
    const desc = document.getElementById('event-desc').value.trim();
    const repeat = document.getElementById('event-repeat')?.value || 'none';
    const reminder = document.getElementById('event-reminder')?.value || 'none';
    const completed = !!document.getElementById('event-completed')?.checked;
    if (!title) return alert('일정 제목을 입력해주세요.');
    if (startDate > endDate) return alert('종료일은 시작일보다 빠를 수 없습니다.');
    if (startDate === endDate && startTime && endTime && endTime < startTime) return alert('같은 날짜에서는 종료시간이 시작시간보다 빠를 수 없습니다.');
    if (reminder !== 'none' && !startTime) return alert('알림을 사용하려면 시작시간을 입력해주세요.');
    const old = state.events.find(x => x.id === id) || {};
    const eventData = {
      ...old,
      id: id || 'evt_' + Date.now(),
      title, startDate, endDate, startTime, endTime, color, desc, repeat, reminder, completed,
      updatedAt: new Date().toISOString()
    };
    if (repeat === 'none') delete eventData.completedOccurrences;
    const idx = state.events.findIndex(x => x.id === id);
    if (idx >= 0) state.events[idx] = eventData;
    else state.events.push(eventData);
    if (reminder !== 'none') requestNotificationPermissionV3();
    saveDataToStorage();
    renderDashboard();
    renderCalendar();
    renderCalendarSearchResults();
    closeModal(document.getElementById('modal-event'));
  });

  document.getElementById('btn-delete-event')?.addEventListener('click', () => {
    const id = document.getElementById('event-id').value;
    if (!id || !confirm('일정을 삭제하시겠습니까? 반복 일정이면 전체 반복 일정이 삭제됩니다.')) return;
    state.events = state.events.filter(e => e.id !== id);
    saveDataToStorage();
    renderDashboard();
    renderCalendar();
    renderCalendarSearchResults();
    closeModal(document.getElementById('modal-event'));
  });
  document.getElementById('btn-cancel-event')?.addEventListener('click', () => closeModal(document.getElementById('modal-event')));
}

// Override day schedule modal with completion toggle
function openDayScheduleModal(dateStr) {
  const modal = ensureDayScheduleModal();
  const title = document.getElementById('day-schedule-title');
  const list = document.getElementById('day-schedule-list');
  const d = new Date(dateStr);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const displayDate = Number.isNaN(d.getTime()) ? dateStr : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`;
  if (title) title.textContent = `${displayDate} 일정`;
  if (!list) return;
  list.innerHTML = '';
  const holidays = typeof getHolidaysForDate === 'function' ? getHolidaysForDate(dateStr) : [];
  const events = getEventsForDate(dateStr);
  if (!holidays.length && !events.length) {
    list.innerHTML = '<div class="day-schedule-empty">등록된 일정이 없습니다.</div>';
    openModal(modal);
    return;
  }
  holidays.forEach(name => {
    const item = document.createElement('div');
    item.className = 'day-schedule-item holiday-detail-item';
    item.innerHTML = `<div class="day-schedule-color holiday-dot"></div><div class="day-schedule-body"><div class="day-schedule-name">${escapeHTML(name)}</div><div class="day-schedule-meta">공휴일</div></div>`;
    list.appendChild(item);
  });
  events.forEach(evt => {
    const item = document.createElement('div');
    item.className = 'day-schedule-item day-event-item' + (evt.completed ? ' day-event-completed' : '');
    item.innerHTML = `
      <button type="button" class="day-complete-toggle" title="완료 체크">${evt.completed ? '✓' : ''}</button>
      <span class="day-schedule-color" style="background:${evt.color || '#3498db'}"></span>
      <button type="button" class="day-schedule-open">
        <span class="day-schedule-body">
          <strong class="day-schedule-name">${escapeHTML(evt.title || '제목 없음')}</strong>
          <span class="day-schedule-meta">${evt.isRecurringOccurrence ? '↻ 반복 | ' : ''}${evt.reminder && evt.reminder !== 'none' ? '🔔 알림 | ' : ''}${escapeHTML(formatEventTime(evt))}${escapeHTML(evt.occurrenceDate || evt.startDate || '')}</span>
          ${evt.desc ? `<span class="day-schedule-desc">${escapeHTML(evt.desc)}</span>` : ''}
        </span>
      </button>
    `;
    item.querySelector('.day-complete-toggle')?.addEventListener('click', () => {
      toggleEventCompleted(evt, dateStr);
      openDayScheduleModal(dateStr);
    });
    item.querySelector('.day-schedule-open')?.addEventListener('click', () => {
      closeModal(modal);
      openEventModal(evt);
    });
    list.appendChild(item);
  });
  openModal(modal);
}

// Override renderCalendar to use recurring occurrences and completion state
function renderCalendar() {
  const year = state.currentDate.getFullYear();
  const month = state.currentDate.getMonth();
  const header = document.getElementById('calendar-month-year');
  const grid = document.getElementById('calendar-grid');
  if (header) header.textContent = `${year}년 ${month + 1}월`;
  if (!grid) return;
  grid.innerHTML = '';
  const firstDayIndex = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const prevLastDay = new Date(year, month, 0).getDate();
  const cells = [];
  for (let x = firstDayIndex; x > 0; x--) {
    const day = prevLastDay - x + 1;
    cells.push({ day, dateStr: getLocalDateString(new Date(year, month - 1, day)), isOtherMonth: true });
  }
  for (let i = 1; i <= lastDay; i++) cells.push({ day: i, dateStr: getLocalDateString(new Date(year, month, i)), isOtherMonth: false });
  while (cells.length < 42) {
    const day = cells.length - firstDayIndex - lastDay + 1;
    cells.push({ day, dateStr: getLocalDateString(new Date(year, month + 1, day)), isOtherMonth: true });
  }
  const today = getLocalDateString(new Date());
  state.events = state.events.map(migrateEventTimeFields);
  cells.forEach(cell => {
    const cellEl = document.createElement('div');
    cellEl.className = 'calendar-cell';
    if (cell.isOtherMonth) cellEl.classList.add('other-month');
    if (cell.dateStr === today) cellEl.classList.add('today');
    const weekday = ['일', '월', '화', '수', '목', '금', '토'][new Date(cell.dateStr).getDay()];
    cellEl.innerHTML = `<div class="cell-date-header"><span class="cell-num">${cell.day}</span><span class="cell-weekday">${weekday}</span></div><div class="cell-events"></div>`;
    const eventsContainer = cellEl.querySelector('.cell-events');
    const holidays = typeof getHolidaysForDate === 'function' ? getHolidaysForDate(cell.dateStr) : [];
    holidays.forEach(name => {
      if (calendarSearchQuery && !String(name).toLowerCase().includes(calendarSearchQuery)) return;
      const holiday = document.createElement('div');
      holiday.className = 'event-badge holiday-badge';
      holiday.textContent = name;
      holiday.title = `공휴일: ${name}`;
      eventsContainer.appendChild(holiday);
    });
    getEventsForDate(cell.dateStr)
      .filter(eventMatchesSearch)
      .forEach(evt => eventsContainer.appendChild(buildEventBadgeElementV3(evt)));
    cellEl.addEventListener('click', () => openDayScheduleModal(cell.dateStr));
    grid.appendChild(cellEl);
  });
  if (typeof renderCalendarSearchResults === 'function') renderCalendarSearchResults();
}

// Override modal open for repeat/reminder/completion values
function openEventModal(eventObj = null, defaultDateStr = null) {
  ensureEventTimeFields();
  ensureEventColorOptionsV2();
  ensureEventAdvancedFieldsV3();
  const form = document.getElementById('event-form');
  const deleteBtn = document.getElementById('btn-delete-event');
  const titleHeader = document.getElementById('modal-event-title');
  if (form) form.reset();
  const selectedDate = defaultDateStr || getLocalDateString(new Date());
  if (eventObj) {
    eventObj = migrateEventTimeFields(eventObj);
    if (titleHeader) titleHeader.textContent = eventObj.isRecurringOccurrence ? '반복 일정 수정' : '일정 수정';
    document.getElementById('event-id').value = eventObj.id;
    document.getElementById('event-title').value = eventObj.title || '';
    document.getElementById('event-start-date').value = eventObj.startDate || selectedDate;
    document.getElementById('event-end-date').value = eventObj.endDate || eventObj.startDate || selectedDate;
    document.getElementById('event-start-time').value = eventObj.startTime || '';
    document.getElementById('event-end-time').value = eventObj.endTime || '';
    const select = document.getElementById('event-color');
    if (select) select.value = EVENT_COLOR_OPTIONS_V2.some(([v]) => v === eventObj.color) ? eventObj.color : '#3498db';
    document.getElementById('event-repeat').value = getRepeatValue(eventObj);
    document.getElementById('event-reminder').value = eventObj.reminder || 'none';
    document.getElementById('event-completed').checked = !!eventObj.completed;
    document.getElementById('event-desc').value = eventObj.desc || '';
    deleteBtn?.classList.remove('hidden');
  } else {
    if (titleHeader) titleHeader.textContent = '새 일정 추가';
    document.getElementById('event-id').value = '';
    document.getElementById('event-start-date').value = selectedDate;
    document.getElementById('event-end-date').value = selectedDate;
    document.getElementById('event-start-time').value = '';
    document.getElementById('event-end-time').value = '';
    const select = document.getElementById('event-color');
    if (select) select.value = '#3498db';
    document.getElementById('event-repeat').value = 'none';
    document.getElementById('event-reminder').value = 'none';
    document.getElementById('event-completed').checked = false;
    document.getElementById('event-desc').value = '';
    deleteBtn?.classList.add('hidden');
  }
  openModal(document.getElementById('modal-event'));
}


// =====================================================
// PATCH 20260730-3: Advanced recurring schedule conditions
// =====================================================
const EVENT_REPEAT_OPTIONS_V4 = [
  ['none', '반복 없음'],
  ['daily', '매일'],
  ['weekly', '매주 지정 요일'],
  ['biweekly', '격주 지정 요일'],
  ['monthlyDate', '매월 지정일'],
  ['monthlyLastWeekday', '매월 마지막주 지정 요일'],
  ['monthlyLastBusinessDay', '매월 마지막 평일'],
  ['yearly', '매년']
];
const WEEKDAY_OPTIONS_V4 = [
  ['0', '일요일'], ['1', '월요일'], ['2', '화요일'], ['3', '수요일'], ['4', '목요일'], ['5', '금요일'], ['6', '토요일']
];

function getDateWeekStartV4(dateObj) {
  const d = new Date(getLocalDateString(dateObj));
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function firstSelectedWeekdayOnOrAfterV4(startDateStr, weekday) {
  const d = new Date(startDateStr);
  if (Number.isNaN(d.getTime())) return null;
  const diff = (Number(weekday) - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function getLastWeekdayOfMonthV4(year, monthIndex, weekday) {
  const d = new Date(year, monthIndex + 1, 0);
  const target = Number(weekday);
  while (d.getDay() !== target) d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

function getLastBusinessDayOfMonthV4(year, monthIndex) {
  const d = new Date(year, monthIndex + 1, 0);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

function getDefaultWeekdayFromStartDateV4() {
  const start = document.getElementById('event-start-date')?.value;
  const d = start ? new Date(start) : new Date();
  return String(Number.isNaN(d.getTime()) ? new Date().getDay() : d.getDay());
}

function ensureAdvancedRepeatDetailFieldsV4() {
  ensureEventAdvancedFieldsV3();
  const repeat = document.getElementById('event-repeat');
  if (!repeat) return;

  if (repeat.dataset.advancedRepeatV4 !== '1') {
    repeat.innerHTML = '';
    EVENT_REPEAT_OPTIONS_V4.forEach(([value, label]) => {
      repeat.insertAdjacentHTML('beforeend', `<option value="${value}">${label}</option>`);
    });
    repeat.dataset.advancedRepeatV4 = '1';
  }

  if (!document.getElementById('event-repeat-detail')) {
    const detail = document.createElement('div');
    detail.id = 'event-repeat-detail';
    detail.className = 'event-repeat-detail hidden';
    detail.innerHTML = `
      <div class="form-row">
        <div class="form-group repeat-weekday-field hidden">
          <label for="event-repeat-weekday">반복 요일</label>
          <select id="event-repeat-weekday"></select>
        </div>
        <div class="form-group repeat-monthday-field hidden">
          <label for="event-repeat-monthday">매월 반복일</label>
          <select id="event-repeat-monthday"></select>
        </div>
      </div>
      <small class="input-tip repeat-helper-text" id="event-repeat-helper"></small>
    `;
    const advRow = document.querySelector('.event-advanced-row');
    advRow?.insertAdjacentElement('afterend', detail);
    const weekday = document.getElementById('event-repeat-weekday');
    WEEKDAY_OPTIONS_V4.forEach(([value, label]) => weekday.insertAdjacentHTML('beforeend', `<option value="${value}">${label}</option>`));
    const monthDay = document.getElementById('event-repeat-monthday');
    for (let i = 1; i <= 31; i++) monthDay.insertAdjacentHTML('beforeend', `<option value="${i}">${i}일</option>`);
  }

  repeat.removeEventListener('change', updateRepeatDetailVisibilityV4);
  repeat.addEventListener('change', updateRepeatDetailVisibilityV4);
  document.getElementById('event-start-date')?.removeEventListener('change', syncRepeatDefaultByStartDateV4);
  document.getElementById('event-start-date')?.addEventListener('change', syncRepeatDefaultByStartDateV4);
  syncRepeatDefaultByStartDateV4();
  updateRepeatDetailVisibilityV4();
}

function syncRepeatDefaultByStartDateV4() {
  const weekday = document.getElementById('event-repeat-weekday');
  const monthDay = document.getElementById('event-repeat-monthday');
  const start = document.getElementById('event-start-date')?.value;
  if (weekday && !weekday.dataset.userTouched) weekday.value = getDefaultWeekdayFromStartDateV4();
  if (monthDay && start && !monthDay.dataset.userTouched) {
    const d = new Date(start);
    if (!Number.isNaN(d.getTime())) monthDay.value = String(d.getDate());
  }
  weekday?.addEventListener('change', () => weekday.dataset.userTouched = '1', { once: true });
  monthDay?.addEventListener('change', () => monthDay.dataset.userTouched = '1', { once: true });
}

function updateRepeatDetailVisibilityV4() {
  const repeat = document.getElementById('event-repeat')?.value || 'none';
  const detail = document.getElementById('event-repeat-detail');
  const weekdayField = document.querySelector('.repeat-weekday-field');
  const monthdayField = document.querySelector('.repeat-monthday-field');
  const helper = document.getElementById('event-repeat-helper');
  if (!detail || !weekdayField || !monthdayField || !helper) return;

  detail.classList.toggle('hidden', ['none', 'daily', 'yearly', 'monthlyLastBusinessDay'].includes(repeat));
  weekdayField.classList.toggle('hidden', !['weekly', 'biweekly', 'monthlyLastWeekday'].includes(repeat));
  monthdayField.classList.toggle('hidden', repeat !== 'monthlyDate');

  const weekdayLabel = WEEKDAY_OPTIONS_V4.find(([v]) => v === (document.getElementById('event-repeat-weekday')?.value || ''))?.[1] || '선택 요일';
  const dayLabel = document.getElementById('event-repeat-monthday')?.value || '';
  const messages = {
    none: '',
    daily: '매일 같은 시간에 반복됩니다.',
    weekly: `매주 ${weekdayLabel}에 반복됩니다.`,
    biweekly: `격주 ${weekdayLabel}에 반복됩니다. 시작일 이후 첫 ${weekdayLabel}을 기준으로 2주마다 표시됩니다.`,
    monthlyDate: `매월 ${dayLabel}일에 반복됩니다. 해당 날짜가 없는 달은 표시하지 않습니다.`,
    monthlyLastWeekday: `매월 마지막주 ${weekdayLabel}에 반복됩니다.`,
    monthlyLastBusinessDay: '매월 마지막 평일에 반복됩니다. 토요일/일요일은 제외합니다.',
    yearly: '매년 같은 월/일에 반복됩니다.'
  };
  helper.textContent = messages[repeat] || '';
}

function getRepeatValue(evt) {
  const r = evt.repeat || evt.repeatType || 'none';
  if (r === 'monthly') return 'monthlyDate';
  return r;
}

function isRecurringEventOnDate(evt, dateStr) {
  evt = migrateEventTimeFields(evt);
  const repeat = getRepeatValue(evt);
  if (!repeat || repeat === 'none') return isDateInRange(dateStr, evt.startDate, evt.endDate);
  if (!evt.startDate) return false;
  const base = new Date(evt.startDate);
  const target = new Date(dateStr);
  if (Number.isNaN(base.getTime()) || Number.isNaN(target.getTime())) return false;
  if (target < new Date(getLocalDateString(base))) return false;

  const span = typeof getEventSpanDays === 'function' ? getEventSpanDays(evt) : 0;
  for (let offset = 0; offset <= span; offset++) {
    const check = new Date(target);
    check.setDate(check.getDate() - offset);
    if (check < base) continue;
    const checkStr = getLocalDateString(check);

    if (repeat === 'daily') return true;
    if (repeat === 'weekly') {
      const weekday = evt.repeatWeekday ?? String(base.getDay());
      if (check.getDay() === Number(weekday)) return true;
    }
    if (repeat === 'biweekly') {
      const weekday = evt.repeatWeekday ?? String(base.getDay());
      if (check.getDay() !== Number(weekday)) continue;
      const first = firstSelectedWeekdayOnOrAfterV4(evt.startDate, weekday);
      if (!first || check < first) continue;
      const weekDiff = Math.floor((getDateWeekStartV4(check) - getDateWeekStartV4(first)) / (7 * 86400000));
      if (weekDiff >= 0 && weekDiff % 2 === 0) return true;
    }
    if (repeat === 'monthlyDate') {
      const day = Number(evt.repeatMonthDay || base.getDate());
      if (check.getDate() === day && monthDiff(base, check) >= 0) return true;
    }
    if (repeat === 'monthlyLastWeekday') {
      const weekday = evt.repeatWeekday ?? String(base.getDay());
      if (checkStr === getLastWeekdayOfMonthV4(check.getFullYear(), check.getMonth(), weekday)) return true;
    }
    if (repeat === 'monthlyLastBusinessDay') {
      if (checkStr === getLastBusinessDayOfMonthV4(check.getFullYear(), check.getMonth())) return true;
    }
    if (repeat === 'yearly') {
      if (check.getMonth() === base.getMonth() && check.getDate() === base.getDate() && check.getFullYear() >= base.getFullYear()) return true;
    }
  }
  return false;
}

// Override initCalendar once more with advanced repeat fields
function initCalendar() {
  ensureEventTimeFields();
  ensureEventColorOptionsV2();
  ensureEventAdvancedFieldsV3();
  ensureAdvancedRepeatDetailFieldsV4();
  ensureCalendarSearchUI();
  loadHolidayCache();
  loadKoreanHolidays();
  startEventReminderTimerV3();

  document.getElementById('cal-prev-month')?.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    addFallbackFixedHolidaysForVisibleYear();
    renderCalendar();
    loadKoreanHolidays();
  });
  document.getElementById('cal-next-month')?.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    addFallbackFixedHolidaysForVisibleYear();
    renderCalendar();
    loadKoreanHolidays();
  });
  document.getElementById('cal-today')?.addEventListener('click', () => {
    state.currentDate = new Date();
    renderCalendar();
  });
  document.getElementById('btn-add-event')?.addEventListener('click', () => openEventModal(null, getLocalDateString(new Date())));
  document.getElementById('event-start-date')?.addEventListener('change', () => {
    const s = document.getElementById('event-start-date');
    const e = document.getElementById('event-end-date');
    if (s && e && (!e.value || e.value < s.value)) e.value = s.value;
    syncRepeatDefaultByStartDateV4();
    updateRepeatDetailVisibilityV4();
  });

  document.getElementById('event-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('event-id').value;
    const title = document.getElementById('event-title').value.trim();
    const startDate = document.getElementById('event-start-date').value;
    const endDate = document.getElementById('event-end-date').value;
    const startTime = document.getElementById('event-start-time')?.value || '';
    const endTime = document.getElementById('event-end-time')?.value || '';
    const color = document.getElementById('event-color').value;
    const desc = document.getElementById('event-desc').value.trim();
    const repeat = document.getElementById('event-repeat')?.value || 'none';
    const reminder = document.getElementById('event-reminder')?.value || 'none';
    const repeatWeekday = document.getElementById('event-repeat-weekday')?.value || getDefaultWeekdayFromStartDateV4();
    const repeatMonthDay = document.getElementById('event-repeat-monthday')?.value || (startDate ? String(new Date(startDate).getDate()) : '1');
    const completed = !!document.getElementById('event-completed')?.checked;
    if (!title) return alert('일정 제목을 입력해주세요.');
    if (startDate > endDate) return alert('종료일은 시작일보다 빠를 수 없습니다.');
    if (startDate === endDate && startTime && endTime && endTime < startTime) return alert('같은 날짜에서는 종료시간이 시작시간보다 빠를 수 없습니다.');
    if (reminder !== 'none' && !startTime) return alert('알림을 사용하려면 시작시간을 입력해주세요.');
    const old = state.events.find(x => x.id === id) || {};
    const eventData = {
      ...old,
      id: id || 'evt_' + Date.now(),
      title, startDate, endDate, startTime, endTime, color, desc,
      repeat, reminder, completed,
      repeatWeekday: ['weekly', 'biweekly', 'monthlyLastWeekday'].includes(repeat) ? repeatWeekday : '',
      repeatMonthDay: repeat === 'monthlyDate' ? repeatMonthDay : '',
      updatedAt: new Date().toISOString()
    };
    if (repeat === 'none') delete eventData.completedOccurrences;
    const idx = state.events.findIndex(x => x.id === id);
    if (idx >= 0) state.events[idx] = eventData;
    else state.events.push(eventData);
    if (reminder !== 'none') requestNotificationPermissionV3();
    saveDataToStorage();
    renderDashboard();
    renderCalendar();
    renderCalendarSearchResults();
    closeModal(document.getElementById('modal-event'));
  });

  document.getElementById('btn-delete-event')?.addEventListener('click', () => {
    const id = document.getElementById('event-id').value;
    if (!id || !confirm('일정을 삭제하시겠습니까? 반복 일정이면 전체 반복 일정이 삭제됩니다.')) return;
    state.events = state.events.filter(e => e.id !== id);
    saveDataToStorage();
    renderDashboard();
    renderCalendar();
    renderCalendarSearchResults();
    closeModal(document.getElementById('modal-event'));
  });
  document.getElementById('btn-cancel-event')?.addEventListener('click', () => closeModal(document.getElementById('modal-event')));
}

// Override modal open with advanced repeat field values
function openEventModal(eventObj = null, defaultDateStr = null) {
  ensureEventTimeFields();
  ensureEventColorOptionsV2();
  ensureEventAdvancedFieldsV3();
  ensureAdvancedRepeatDetailFieldsV4();
  const form = document.getElementById('event-form');
  const deleteBtn = document.getElementById('btn-delete-event');
  const titleHeader = document.getElementById('modal-event-title');
  if (form) form.reset();
  const selectedDate = defaultDateStr || getLocalDateString(new Date());
  if (eventObj) {
    eventObj = migrateEventTimeFields(eventObj);
    if (titleHeader) titleHeader.textContent = eventObj.isRecurringOccurrence ? '반복 일정 수정' : '일정 수정';
    document.getElementById('event-id').value = eventObj.id;
    document.getElementById('event-title').value = eventObj.title || '';
    document.getElementById('event-start-date').value = eventObj.startDate || selectedDate;
    document.getElementById('event-end-date').value = eventObj.endDate || eventObj.startDate || selectedDate;
    document.getElementById('event-start-time').value = eventObj.startTime || '';
    document.getElementById('event-end-time').value = eventObj.endTime || '';
    const select = document.getElementById('event-color');
    if (select) select.value = EVENT_COLOR_OPTIONS_V2.some(([v]) => v === eventObj.color) ? eventObj.color : '#3498db';
    document.getElementById('event-repeat').value = getRepeatValue(eventObj);
    document.getElementById('event-reminder').value = eventObj.reminder || 'none';
    document.getElementById('event-repeat-weekday').value = String(eventObj.repeatWeekday || new Date(eventObj.startDate || selectedDate).getDay());
    document.getElementById('event-repeat-monthday').value = String(eventObj.repeatMonthDay || new Date(eventObj.startDate || selectedDate).getDate());
    document.getElementById('event-completed').checked = !!eventObj.completed;
    document.getElementById('event-desc').value = eventObj.desc || '';
    deleteBtn?.classList.remove('hidden');
  } else {
    if (titleHeader) titleHeader.textContent = '새 일정 추가';
    document.getElementById('event-id').value = '';
    document.getElementById('event-start-date').value = selectedDate;
    document.getElementById('event-end-date').value = selectedDate;
    document.getElementById('event-start-time').value = '';
    document.getElementById('event-end-time').value = '';
    const select = document.getElementById('event-color');
    if (select) select.value = '#3498db';
    document.getElementById('event-repeat').value = 'none';
    document.getElementById('event-reminder').value = 'none';
    document.getElementById('event-repeat-weekday').value = getDefaultWeekdayFromStartDateV4();
    document.getElementById('event-repeat-monthday').value = String(new Date(selectedDate).getDate());
    document.getElementById('event-completed').checked = false;
    document.getElementById('event-desc').value = '';
    deleteBtn?.classList.add('hidden');
  }
  updateRepeatDetailVisibilityV4();
  openModal(document.getElementById('modal-event'));
}


// =====================================================
// PATCH 20260730-4: interval weekly, nth weekday, edit scope for recurring events
// =====================================================
let currentEditingOccurrenceV5 = null;

const EVENT_REPEAT_OPTIONS_V5 = [
  ['none', '반복 없음'],
  ['daily', '매일'],
  ['weekly', '매주 지정 요일'],
  ['intervalWeeks', 'N주마다 지정 요일'],
  ['biweekly', '격주 지정 요일'],
  ['monthlyDate', '매월 지정일'],
  ['monthlyNthWeekday', '매월 N째주 지정 요일'],
  ['monthlyLastWeekday', '매월 마지막주 지정 요일'],
  ['monthlyLastBusinessDay', '매월 마지막 평일'],
  ['yearly', '매년']
];
const MONTH_WEEK_OPTIONS_V5 = [
  ['1', '첫째주'], ['2', '둘째주'], ['3', '셋째주'], ['4', '넷째주'], ['5', '다섯째주']
];

function getDateOnlyV5(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return getLocalDateString(d);
}
function dateAddDaysV5(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}
function isAfterRepeatUntilV5(evt, dateStr) {
  return !!evt.repeatUntil && dateStr > evt.repeatUntil;
}
function getNthWeekdayOfMonthV5(year, monthIndex, nth, weekday) {
  const first = new Date(year, monthIndex, 1);
  const diff = (Number(weekday) - first.getDay() + 7) % 7;
  const d = new Date(year, monthIndex, 1 + diff + (Number(nth) - 1) * 7);
  if (d.getMonth() !== monthIndex) return '';
  return getLocalDateString(d);
}
function getRepeatIntervalWeeksV5(evt) {
  const n = Number(evt.repeatIntervalWeeks || (getRepeatValue(evt) === 'biweekly' ? 2 : 1));
  return Number.isFinite(n) && n > 0 ? Math.min(Math.max(Math.round(n), 1), 52) : 1;
}

function ensureAdvancedRepeatDetailFieldsV4() {
  ensureEventAdvancedFieldsV3();
  const repeat = document.getElementById('event-repeat');
  if (!repeat) return;

  if (repeat.dataset.advancedRepeatV5 !== '1') {
    repeat.innerHTML = '';
    EVENT_REPEAT_OPTIONS_V5.forEach(([value, label]) => {
      repeat.insertAdjacentHTML('beforeend', `<option value="${value}">${label}</option>`);
    });
    repeat.dataset.advancedRepeatV5 = '1';
  }

  if (!document.getElementById('event-repeat-detail')) {
    const detail = document.createElement('div');
    detail.id = 'event-repeat-detail';
    detail.className = 'event-repeat-detail hidden';
    detail.innerHTML = `
      <div class="form-row">
        <div class="form-group repeat-weekday-field hidden">
          <label for="event-repeat-weekday">반복 요일</label>
          <select id="event-repeat-weekday"></select>
        </div>
        <div class="form-group repeat-interval-field hidden">
          <label for="event-repeat-interval-weeks">반복 간격</label>
          <select id="event-repeat-interval-weeks"></select>
        </div>
        <div class="form-group repeat-monthweek-field hidden">
          <label for="event-repeat-monthweek">매월 반복 주차</label>
          <select id="event-repeat-monthweek"></select>
        </div>
        <div class="form-group repeat-monthday-field hidden">
          <label for="event-repeat-monthday">매월 반복일</label>
          <select id="event-repeat-monthday"></select>
        </div>
      </div>
      <small class="input-tip repeat-helper-text" id="event-repeat-helper"></small>
    `;
    const advRow = document.querySelector('.event-advanced-row');
    advRow?.insertAdjacentElement('afterend', detail);
    const weekday = document.getElementById('event-repeat-weekday');
    WEEKDAY_OPTIONS_V4.forEach(([value, label]) => weekday.insertAdjacentHTML('beforeend', `<option value="${value}">${label}</option>`));
    const interval = document.getElementById('event-repeat-interval-weeks');
    for (let i = 1; i <= 12; i++) interval.insertAdjacentHTML('beforeend', `<option value="${i}">${i}주마다</option>`);
    const monthWeek = document.getElementById('event-repeat-monthweek');
    MONTH_WEEK_OPTIONS_V5.forEach(([value, label]) => monthWeek.insertAdjacentHTML('beforeend', `<option value="${value}">${label}</option>`));
    const monthDay = document.getElementById('event-repeat-monthday');
    for (let i = 1; i <= 31; i++) monthDay.insertAdjacentHTML('beforeend', `<option value="${i}">${i}일</option>`);
  } else if (!document.getElementById('event-repeat-interval-weeks')) {
    // Existing detail from older patch: add missing fields safely.
    const row = document.querySelector('#event-repeat-detail .form-row');
    const interval = document.createElement('div');
    interval.className = 'form-group repeat-interval-field hidden';
    interval.innerHTML = '<label for="event-repeat-interval-weeks">반복 간격</label><select id="event-repeat-interval-weeks"></select>';
    row?.insertAdjacentElement('beforeend', interval);
    for (let i = 1; i <= 12; i++) document.getElementById('event-repeat-interval-weeks').insertAdjacentHTML('beforeend', `<option value="${i}">${i}주마다</option>`);
    const monthWeek = document.createElement('div');
    monthWeek.className = 'form-group repeat-monthweek-field hidden';
    monthWeek.innerHTML = '<label for="event-repeat-monthweek">매월 반복 주차</label><select id="event-repeat-monthweek"></select>';
    row?.insertAdjacentElement('beforeend', monthWeek);
    MONTH_WEEK_OPTIONS_V5.forEach(([value, label]) => document.getElementById('event-repeat-monthweek').insertAdjacentHTML('beforeend', `<option value="${value}">${label}</option>`));
  }

  repeat.removeEventListener('change', updateRepeatDetailVisibilityV4);
  repeat.addEventListener('change', updateRepeatDetailVisibilityV4);
  ['event-repeat-weekday','event-repeat-monthday','event-repeat-interval-weeks','event-repeat-monthweek'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updateRepeatDetailVisibilityV4);
  });
  document.getElementById('event-start-date')?.removeEventListener('change', syncRepeatDefaultByStartDateV4);
  document.getElementById('event-start-date')?.addEventListener('change', syncRepeatDefaultByStartDateV4);
  syncRepeatDefaultByStartDateV4();
  updateRepeatDetailVisibilityV4();
}

function syncRepeatDefaultByStartDateV4() {
  const weekday = document.getElementById('event-repeat-weekday');
  const monthDay = document.getElementById('event-repeat-monthday');
  const monthWeek = document.getElementById('event-repeat-monthweek');
  const interval = document.getElementById('event-repeat-interval-weeks');
  const start = document.getElementById('event-start-date')?.value;
  if (weekday && !weekday.dataset.userTouched) weekday.value = getDefaultWeekdayFromStartDateV4();
  if (monthDay && start && !monthDay.dataset.userTouched) {
    const d = new Date(start);
    if (!Number.isNaN(d.getTime())) monthDay.value = String(d.getDate());
  }
  if (monthWeek && start && !monthWeek.dataset.userTouched) {
    const d = new Date(start);
    if (!Number.isNaN(d.getTime())) monthWeek.value = String(Math.ceil(d.getDate() / 7));
  }
  if (interval && !interval.value) interval.value = '3';
  weekday?.addEventListener('change', () => weekday.dataset.userTouched = '1', { once: true });
  monthDay?.addEventListener('change', () => monthDay.dataset.userTouched = '1', { once: true });
  monthWeek?.addEventListener('change', () => monthWeek.dataset.userTouched = '1', { once: true });
}

function updateRepeatDetailVisibilityV4() {
  const repeat = document.getElementById('event-repeat')?.value || 'none';
  const detail = document.getElementById('event-repeat-detail');
  const weekdayField = document.querySelector('.repeat-weekday-field');
  const monthdayField = document.querySelector('.repeat-monthday-field');
  const intervalField = document.querySelector('.repeat-interval-field');
  const monthWeekField = document.querySelector('.repeat-monthweek-field');
  const helper = document.getElementById('event-repeat-helper');
  if (!detail || !weekdayField || !monthdayField || !helper) return;

  const needsDetail = ['weekly','intervalWeeks','biweekly','monthlyDate','monthlyNthWeekday','monthlyLastWeekday'].includes(repeat);
  detail.classList.toggle('hidden', !needsDetail);
  weekdayField.classList.toggle('hidden', !['weekly','intervalWeeks','biweekly','monthlyNthWeekday','monthlyLastWeekday'].includes(repeat));
  monthdayField.classList.toggle('hidden', repeat !== 'monthlyDate');
  intervalField?.classList.toggle('hidden', repeat !== 'intervalWeeks');
  monthWeekField?.classList.toggle('hidden', repeat !== 'monthlyNthWeekday');

  const weekdayLabel = WEEKDAY_OPTIONS_V4.find(([v]) => v === (document.getElementById('event-repeat-weekday')?.value || ''))?.[1] || '선택 요일';
  const dayLabel = document.getElementById('event-repeat-monthday')?.value || '';
  const intervalLabel = document.getElementById('event-repeat-interval-weeks')?.value || '3';
  const monthWeekLabel = MONTH_WEEK_OPTIONS_V5.find(([v]) => v === (document.getElementById('event-repeat-monthweek')?.value || ''))?.[1] || '선택 주차';
  const messages = {
    none: '',
    daily: '매일 같은 시간에 반복됩니다.',
    weekly: `매주 ${weekdayLabel}에 반복됩니다.`,
    intervalWeeks: `${intervalLabel}주마다 ${weekdayLabel}에 반복됩니다.`,
    biweekly: `격주 ${weekdayLabel}에 반복됩니다.`,
    monthlyDate: `매월 ${dayLabel}일에 반복됩니다. 해당 날짜가 없는 달은 표시하지 않습니다.`,
    monthlyNthWeekday: `매월 ${monthWeekLabel} ${weekdayLabel}에 반복됩니다. 해당 주차/요일이 없는 달은 표시하지 않습니다.`,
    monthlyLastWeekday: `매월 마지막주 ${weekdayLabel}에 반복됩니다.`,
    monthlyLastBusinessDay: '매월 마지막 평일에 반복됩니다. 토요일/일요일은 제외합니다.',
    yearly: '매년 같은 월/일에 반복됩니다.'
  };
  helper.textContent = messages[repeat] || '';
}

function getRepeatValue(evt) {
  const r = evt.repeat || evt.repeatType || 'none';
  if (r === 'monthly') return 'monthlyDate';
  return r;
}

function isRecurringEventOnDate(evt, dateStr) {
  evt = migrateEventTimeFields(evt);
  const repeat = getRepeatValue(evt);
  if (!repeat || repeat === 'none') return isDateInRange(dateStr, evt.startDate, evt.endDate);
  if (!evt.startDate) return false;
  if (evt.exceptionDeletes && evt.exceptionDeletes[dateStr]) return false;
  if (isAfterRepeatUntilV5(evt, dateStr)) return false;

  const base = new Date(evt.startDate);
  const target = new Date(dateStr);
  if (Number.isNaN(base.getTime()) || Number.isNaN(target.getTime())) return false;
  if (target < new Date(getLocalDateString(base))) return false;

  const span = typeof getEventSpanDays === 'function' ? getEventSpanDays(evt) : 0;
  for (let offset = 0; offset <= span; offset++) {
    const check = new Date(target);
    check.setDate(check.getDate() - offset);
    if (check < base) continue;
    const checkStr = getLocalDateString(check);
    if (isAfterRepeatUntilV5(evt, checkStr)) continue;

    if (repeat === 'daily') return true;
    if (repeat === 'weekly') {
      const weekday = evt.repeatWeekday ?? String(base.getDay());
      if (check.getDay() === Number(weekday)) return true;
    }
    if (repeat === 'biweekly' || repeat === 'intervalWeeks') {
      const weekday = evt.repeatWeekday ?? String(base.getDay());
      if (check.getDay() !== Number(weekday)) continue;
      const first = firstSelectedWeekdayOnOrAfterV4(evt.startDate, weekday);
      if (!first || check < first) continue;
      const weekDiff = Math.floor((getDateWeekStartV4(check) - getDateWeekStartV4(first)) / (7 * 86400000));
      const interval = repeat === 'biweekly' ? 2 : getRepeatIntervalWeeksV5(evt);
      if (weekDiff >= 0 && weekDiff % interval === 0) return true;
    }
    if (repeat === 'monthlyDate') {
      const day = Number(evt.repeatMonthDay || base.getDate());
      if (check.getDate() === day && monthDiff(base, check) >= 0) return true;
    }
    if (repeat === 'monthlyNthWeekday') {
      const nth = evt.repeatMonthWeek || String(Math.ceil(base.getDate() / 7));
      const weekday = evt.repeatWeekday ?? String(base.getDay());
      if (checkStr === getNthWeekdayOfMonthV5(check.getFullYear(), check.getMonth(), nth, weekday)) return true;
    }
    if (repeat === 'monthlyLastWeekday') {
      const weekday = evt.repeatWeekday ?? String(base.getDay());
      if (checkStr === getLastWeekdayOfMonthV4(check.getFullYear(), check.getMonth(), weekday)) return true;
    }
    if (repeat === 'monthlyLastBusinessDay') {
      if (checkStr === getLastBusinessDayOfMonthV4(check.getFullYear(), check.getMonth())) return true;
    }
    if (repeat === 'yearly') {
      if (check.getMonth() === base.getMonth() && check.getDate() === base.getDate() && check.getFullYear() >= base.getFullYear()) return true;
    }
  }
  return false;
}

function getOccurrenceForDate(evt, dateStr) {
  const repeat = getRepeatValue(evt);
  const override = evt.occurrenceOverrides && evt.occurrenceOverrides[dateStr] ? evt.occurrenceOverrides[dateStr] : null;
  const completedMap = evt.completedOccurrences || {};
  const merged = override ? { ...evt, ...override } : evt;
  return {
    ...migrateEventTimeFields(merged),
    id: evt.id,
    sourceEventId: evt.id,
    occurrenceDate: dateStr,
    occurrenceKey: `${evt.id || 'evt'}__${dateStr}`,
    isRecurringOccurrence: repeat && repeat !== 'none',
    completed: repeat && repeat !== 'none' ? !!completedMap[dateStr] : !!merged.completed
  };
}

function ensureEditScopeFieldV5() {
  if (document.getElementById('event-edit-scope-wrap')) return;
  const completedWrap = document.getElementById('event-completed-wrap');
  const wrap = document.createElement('div');
  wrap.id = 'event-edit-scope-wrap';
  wrap.className = 'event-edit-scope-wrap hidden';
  wrap.innerHTML = `
    <label for="event-edit-scope">반복 일정 수정 범위</label>
    <select id="event-edit-scope">
      <option value="all">전체 반복 일정 수정</option>
      <option value="only">해당 일정만 수정</option>
      <option value="future">이 일정부터 향후 일정 모두 수정</option>
    </select>
    <small class="input-tip">반복 일정에서만 적용됩니다.</small>
  `;
  completedWrap?.insertAdjacentElement('afterend', wrap);
}
function showEditScopeIfNeededV5(eventObj) {
  ensureEditScopeFieldV5();
  const wrap = document.getElementById('event-edit-scope-wrap');
  const select = document.getElementById('event-edit-scope');
  const isRecurring = !!eventObj && !!eventObj.isRecurringOccurrence;
  wrap?.classList.toggle('hidden', !isRecurring);
  if (select) select.value = isRecurring ? 'only' : 'all';
}

function getEventDataFromFormV5(old = {}) {
  const id = document.getElementById('event-id').value;
  const title = document.getElementById('event-title').value.trim();
  const startDate = document.getElementById('event-start-date').value;
  const endDate = document.getElementById('event-end-date').value;
  const startTime = document.getElementById('event-start-time')?.value || '';
  const endTime = document.getElementById('event-end-time')?.value || '';
  const color = document.getElementById('event-color').value;
  const desc = document.getElementById('event-desc').value.trim();
  const repeat = document.getElementById('event-repeat')?.value || 'none';
  const reminder = document.getElementById('event-reminder')?.value || 'none';
  const repeatWeekday = document.getElementById('event-repeat-weekday')?.value || getDefaultWeekdayFromStartDateV4();
  const repeatMonthDay = document.getElementById('event-repeat-monthday')?.value || (startDate ? String(new Date(startDate).getDate()) : '1');
  const repeatMonthWeek = document.getElementById('event-repeat-monthweek')?.value || (startDate ? String(Math.ceil(new Date(startDate).getDate() / 7)) : '1');
  const repeatIntervalWeeks = document.getElementById('event-repeat-interval-weeks')?.value || '3';
  const completed = !!document.getElementById('event-completed')?.checked;
  return {
    ...old,
    id: id || 'evt_' + Date.now(),
    title, startDate, endDate, startTime, endTime, color, desc,
    repeat, reminder, completed,
    repeatWeekday: ['weekly','biweekly','intervalWeeks','monthlyNthWeekday','monthlyLastWeekday'].includes(repeat) ? repeatWeekday : '',
    repeatMonthDay: repeat === 'monthlyDate' ? repeatMonthDay : '',
    repeatMonthWeek: repeat === 'monthlyNthWeekday' ? repeatMonthWeek : '',
    repeatIntervalWeeks: repeat === 'intervalWeeks' ? repeatIntervalWeeks : '',
    updatedAt: new Date().toISOString()
  };
}

function validateEventFormV5(data) {
  if (!data.title) return '일정 제목을 입력해주세요.';
  if (data.startDate > data.endDate) return '종료일은 시작일보다 빠를 수 없습니다.';
  if (data.startDate === data.endDate && data.startTime && data.endTime && data.endTime < data.startTime) return '같은 날짜에서는 종료시간이 시작시간보다 빠를 수 없습니다.';
  if (data.reminder !== 'none' && !data.startTime) return '알림을 사용하려면 시작시간을 입력해주세요.';
  return '';
}

function createSingleOccurrenceEventV5(master, dateStr, formData) {
  const newEvent = {
    ...formData,
    id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    repeat: 'none',
    repeatWeekday: '',
    repeatMonthDay: '',
    repeatMonthWeek: '',
    repeatIntervalWeeks: '',
    completedOccurrences: undefined,
    occurrenceOverrides: undefined,
    exceptionDeletes: undefined,
    createdFromRecurringId: master.id,
    createdFromOccurrenceDate: dateStr,
    updatedAt: new Date().toISOString()
  };
  delete newEvent.completedOccurrences;
  delete newEvent.occurrenceOverrides;
  delete newEvent.exceptionDeletes;
  return newEvent;
}

function saveRecurringEditV5(formData) {
  const id = formData.id;
  const idx = state.events.findIndex(e => e.id === id);
  if (idx < 0) return;
  const master = state.events[idx];
  const occurrenceDate = currentEditingOccurrenceV5?.occurrenceDate || formData.startDate;
  const scope = document.getElementById('event-edit-scope')?.value || 'all';

  if (scope === 'only') {
    master.exceptionDeletes = master.exceptionDeletes || {};
    master.exceptionDeletes[occurrenceDate] = true;
    master.updatedAt = new Date().toISOString();
    state.events[idx] = master;
    state.events.push(createSingleOccurrenceEventV5(master, occurrenceDate, formData));
    return;
  }

  if (scope === 'future') {
    const until = dateAddDaysV5(occurrenceDate, -1);
    master.repeatUntil = until;
    master.updatedAt = new Date().toISOString();
    state.events[idx] = master;
    const newMaster = {
      ...formData,
      id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      startDate: formData.startDate || occurrenceDate,
      endDate: formData.endDate || formData.startDate || occurrenceDate,
      completed: false,
      completedOccurrences: {},
      occurrenceOverrides: {},
      exceptionDeletes: {},
      repeatUntil: '',
      splitFromRecurringId: master.id,
      splitFromOccurrenceDate: occurrenceDate,
      updatedAt: new Date().toISOString()
    };
    state.events.push(newMaster);
    return;
  }

  // all
  const keep = {
    completedOccurrences: master.completedOccurrences || {},
    occurrenceOverrides: master.occurrenceOverrides || {},
    exceptionDeletes: master.exceptionDeletes || {},
    repeatUntil: master.repeatUntil || ''
  };
  state.events[idx] = { ...formData, ...keep, id: master.id, updatedAt: new Date().toISOString() };
}

// Override initCalendar with edit scope handling
function initCalendar() {
  ensureEventTimeFields();
  ensureEventColorOptionsV2();
  ensureEventAdvancedFieldsV3();
  ensureAdvancedRepeatDetailFieldsV4();
  ensureEditScopeFieldV5();
  ensureCalendarSearchUI();
  loadHolidayCache();
  loadKoreanHolidays();
  startEventReminderTimerV3();

  document.getElementById('cal-prev-month')?.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() - 1);
    addFallbackFixedHolidaysForVisibleYear();
    renderCalendar();
    loadKoreanHolidays();
  });
  document.getElementById('cal-next-month')?.addEventListener('click', () => {
    state.currentDate.setMonth(state.currentDate.getMonth() + 1);
    addFallbackFixedHolidaysForVisibleYear();
    renderCalendar();
    loadKoreanHolidays();
  });
  document.getElementById('cal-today')?.addEventListener('click', () => { state.currentDate = new Date(); renderCalendar(); });
  document.getElementById('btn-add-event')?.addEventListener('click', () => openEventModal(null, getLocalDateString(new Date())));
  document.getElementById('event-start-date')?.addEventListener('change', () => {
    const s = document.getElementById('event-start-date');
    const e = document.getElementById('event-end-date');
    if (s && e && (!e.value || e.value < s.value)) e.value = s.value;
    syncRepeatDefaultByStartDateV4();
    updateRepeatDetailVisibilityV4();
  });

  document.getElementById('event-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('event-id').value;
    const old = state.events.find(x => x.id === id) || {};
    const formData = getEventDataFromFormV5(old);
    const err = validateEventFormV5(formData);
    if (err) return alert(err);

    if (currentEditingOccurrenceV5 && currentEditingOccurrenceV5.isRecurringOccurrence) {
      saveRecurringEditV5(formData);
    } else {
      if (formData.repeat === 'none') {
        delete formData.completedOccurrences;
        delete formData.occurrenceOverrides;
        delete formData.exceptionDeletes;
        delete formData.repeatUntil;
      }
      const idx = state.events.findIndex(x => x.id === id);
      if (idx >= 0) state.events[idx] = formData;
      else state.events.push(formData);
    }

    if (formData.reminder !== 'none') requestNotificationPermissionV3();
    currentEditingOccurrenceV5 = null;
    saveDataToStorage();
    renderDashboard();
    renderCalendar();
    renderCalendarSearchResults();
    closeModal(document.getElementById('modal-event'));
  });

  document.getElementById('btn-delete-event')?.addEventListener('click', () => {
    const id = document.getElementById('event-id').value;
    if (!id) return;
    if (currentEditingOccurrenceV5?.isRecurringOccurrence) {
      const scope = document.getElementById('event-edit-scope')?.value || 'only';
      const idx = state.events.findIndex(e => e.id === id);
      const master = state.events[idx];
      const date = currentEditingOccurrenceV5.occurrenceDate;
      if (scope === 'only') {
        if (!confirm('해당 반복 일정 1건만 삭제할까요?')) return;
        master.exceptionDeletes = master.exceptionDeletes || {};
        master.exceptionDeletes[date] = true;
        master.updatedAt = new Date().toISOString();
      } else if (scope === 'future') {
        if (!confirm('이 일정부터 향후 반복 일정을 모두 삭제할까요?')) return;
        master.repeatUntil = dateAddDaysV5(date, -1);
        master.updatedAt = new Date().toISOString();
      } else {
        if (!confirm('전체 반복 일정을 삭제할까요?')) return;
        state.events = state.events.filter(e => e.id !== id);
      }
    } else {
      if (!confirm('일정을 삭제하시겠습니까?')) return;
      state.events = state.events.filter(e => e.id !== id);
    }
    currentEditingOccurrenceV5 = null;
    saveDataToStorage();
    renderDashboard();
    renderCalendar();
    renderCalendarSearchResults();
    closeModal(document.getElementById('modal-event'));
  });
  document.getElementById('btn-cancel-event')?.addEventListener('click', () => { currentEditingOccurrenceV5 = null; closeModal(document.getElementById('modal-event')); });
}

// Override openEventModal to show scope and advanced repeat values
function openEventModal(eventObj = null, defaultDateStr = null) {
  ensureEventTimeFields();
  ensureEventColorOptionsV2();
  ensureEventAdvancedFieldsV3();
  ensureAdvancedRepeatDetailFieldsV4();
  ensureEditScopeFieldV5();
  const form = document.getElementById('event-form');
  const deleteBtn = document.getElementById('btn-delete-event');
  const titleHeader = document.getElementById('modal-event-title');
  if (form) form.reset();
  const selectedDate = defaultDateStr || getLocalDateString(new Date());
  currentEditingOccurrenceV5 = eventObj && eventObj.isRecurringOccurrence ? { ...eventObj } : null;
  showEditScopeIfNeededV5(eventObj);

  if (eventObj) {
    eventObj = migrateEventTimeFields(eventObj);
    if (titleHeader) titleHeader.textContent = eventObj.isRecurringOccurrence ? '반복 일정 수정' : '일정 수정';
    document.getElementById('event-id').value = eventObj.id;
    document.getElementById('event-title').value = eventObj.title || '';
    document.getElementById('event-start-date').value = eventObj.isRecurringOccurrence ? (eventObj.occurrenceDate || selectedDate) : (eventObj.startDate || selectedDate);
    document.getElementById('event-end-date').value = eventObj.isRecurringOccurrence ? (eventObj.occurrenceDate || selectedDate) : (eventObj.endDate || eventObj.startDate || selectedDate);
    document.getElementById('event-start-time').value = eventObj.startTime || '';
    document.getElementById('event-end-time').value = eventObj.endTime || '';
    const select = document.getElementById('event-color');
    if (select) select.value = EVENT_COLOR_OPTIONS_V2.some(([v]) => v === eventObj.color) ? eventObj.color : '#3498db';
    document.getElementById('event-repeat').value = getRepeatValue(eventObj);
    document.getElementById('event-reminder').value = eventObj.reminder || 'none';
    document.getElementById('event-repeat-weekday').value = String(eventObj.repeatWeekday || new Date(eventObj.startDate || selectedDate).getDay());
    document.getElementById('event-repeat-monthday').value = String(eventObj.repeatMonthDay || new Date(eventObj.startDate || selectedDate).getDate());
    document.getElementById('event-repeat-monthweek').value = String(eventObj.repeatMonthWeek || Math.ceil(new Date(eventObj.startDate || selectedDate).getDate() / 7));
    document.getElementById('event-repeat-interval-weeks').value = String(eventObj.repeatIntervalWeeks || (getRepeatValue(eventObj) === 'biweekly' ? 2 : 3));
    document.getElementById('event-completed').checked = !!eventObj.completed;
    document.getElementById('event-desc').value = eventObj.desc || '';
    deleteBtn?.classList.remove('hidden');
  } else {
    if (titleHeader) titleHeader.textContent = '새 일정 추가';
    currentEditingOccurrenceV5 = null;
    document.getElementById('event-id').value = '';
    document.getElementById('event-start-date').value = selectedDate;
    document.getElementById('event-end-date').value = selectedDate;
    document.getElementById('event-start-time').value = '';
    document.getElementById('event-end-time').value = '';
    const select = document.getElementById('event-color');
    if (select) select.value = '#3498db';
    document.getElementById('event-repeat').value = 'none';
    document.getElementById('event-reminder').value = 'none';
    document.getElementById('event-repeat-weekday').value = getDefaultWeekdayFromStartDateV4();
    document.getElementById('event-repeat-monthday').value = String(new Date(selectedDate).getDate());
    document.getElementById('event-repeat-monthweek').value = String(Math.ceil(new Date(selectedDate).getDate() / 7));
    document.getElementById('event-repeat-interval-weeks').value = '3';
    document.getElementById('event-completed').checked = false;
    document.getElementById('event-desc').value = '';
    deleteBtn?.classList.add('hidden');
  }
  updateRepeatDetailVisibilityV4();
  openModal(document.getElementById('modal-event'));
}


// =====================================================
// PATCH 20260730-5: Add event button inside selected-day schedule list
// =====================================================
function appendDayScheduleAddButtonV6(list, modal, dateStr) {
  if (!list) return;
  const addWrap = document.createElement('div');
  addWrap.className = 'day-schedule-add-row';
  addWrap.innerHTML = `
    <button type="button" class="btn btn-primary day-schedule-add-btn">
      <i class="fa-solid fa-plus"></i> 이 날짜에 일정 추가
    </button>
  `;
  addWrap.querySelector('.day-schedule-add-btn')?.addEventListener('click', () => {
    closeModal(modal);
    openEventModal(null, dateStr);
  });
  list.appendChild(addWrap);
}

// Override day schedule modal: show list + add button at the bottom
function openDayScheduleModal(dateStr) {
  const modal = ensureDayScheduleModal();
  const title = document.getElementById('day-schedule-title');
  const list = document.getElementById('day-schedule-list');
  const d = new Date(dateStr);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const displayDate = Number.isNaN(d.getTime()) ? dateStr : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`;
  if (title) title.textContent = `${displayDate} 일정`;
  if (!list) return;
  list.innerHTML = '';

  const holidays = typeof getHolidaysForDate === 'function' ? getHolidaysForDate(dateStr) : [];
  const events = typeof getEventsForDate === 'function' ? getEventsForDate(dateStr) : [];

  if (!holidays.length && !events.length) {
    list.innerHTML = '<div class="day-schedule-empty">등록된 일정이 없습니다.</div>';
    appendDayScheduleAddButtonV6(list, modal, dateStr);
    openModal(modal);
    return;
  }

  holidays.forEach(name => {
    const item = document.createElement('div');
    item.className = 'day-schedule-item holiday-detail-item';
    item.innerHTML = `<div class="day-schedule-color holiday-dot"></div><div class="day-schedule-body"><div class="day-schedule-name">${escapeHTML(name)}</div><div class="day-schedule-meta">공휴일</div></div>`;
    list.appendChild(item);
  });

  events.forEach(evt => {
    const item = document.createElement('div');
    item.className = 'day-schedule-item day-event-item' + (evt.completed ? ' day-event-completed' : '');
    item.innerHTML = `
      <button type="button" class="day-complete-toggle" title="완료 체크">${evt.completed ? '✓' : ''}</button>
      <span class="day-schedule-color" style="background:${evt.color || '#3498db'}"></span>
      <button type="button" class="day-schedule-open">
        <span class="day-schedule-body">
          <strong class="day-schedule-name">${escapeHTML(evt.title || '제목 없음')}</strong>
          <span class="day-schedule-meta">${evt.isRecurringOccurrence ? '↻ 반복 | ' : ''}${evt.reminder && evt.reminder !== 'none' ? '🔔 알림 | ' : ''}${escapeHTML(formatEventTime(evt))}${escapeHTML(evt.occurrenceDate || evt.startDate || '')}</span>
          ${evt.desc ? `<span class="day-schedule-desc">${escapeHTML(evt.desc)}</span>` : ''}
        </span>
      </button>
    `;
    item.querySelector('.day-complete-toggle')?.addEventListener('click', () => {
      if (typeof toggleEventCompleted === 'function') {
        toggleEventCompleted(evt, dateStr);
        openDayScheduleModal(dateStr);
      }
    });
    item.querySelector('.day-schedule-open')?.addEventListener('click', () => {
      closeModal(modal);
      openEventModal(evt);
    });
    list.appendChild(item);
  });

  appendDayScheduleAddButtonV6(list, modal, dateStr);
  openModal(modal);
}

// =====================================================
// PATCH 20260730-7: stable holiday rendering and Constitution Day override
// - Prevent fallback holidays from wiping fetched lunar/substitute holidays.
// - Reload holidays by visible year instead of one-time holidayLoadStarted flag.
// - Add Constitution Day from 2026 onward.
// =====================================================
(function () {
  const HOLIDAY_PATCH_VERSION = '20260730-7';
  const HOLIDAY_SOURCE_URL = 'https://holidays.hyunbin.page/basic.json';

  function normalizeHolidayValueV7(value) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (value === null || value === undefined || value === '') return [];
    return [String(value)];
  }

  function mergeHolidayMapV7(base, additions) {
    const target = base || {};
    Object.entries(additions || {}).forEach(([date, value]) => {
      const incoming = normalizeHolidayValueV7(value);
      if (!incoming.length) return;
      const existing = normalizeHolidayValueV7(target[date]);
      target[date] = Array.from(new Set([...existing, ...incoming]));
    });
    return target;
  }

  function addKoreanHolidayOverridesV7(year) {
    if (!year || Number.isNaN(Number(year))) return;
    const fixed = {};
    fixed[`${year}-01-01`] = ['신정'];
    fixed[`${year}-03-01`] = ['삼일절'];
    fixed[`${year}-05-05`] = ['어린이날'];
    fixed[`${year}-06-06`] = ['현충일'];
    fixed[`${year}-08-15`] = ['광복절'];
    fixed[`${year}-10-03`] = ['개천절'];
    fixed[`${year}-10-09`] = ['한글날'];
    fixed[`${year}-12-25`] = ['기독탄신일'];

    // 제헌절은 2026년부터 공휴일로 재지정된 경우를 보정 반영합니다.
    // 기존 공휴일 데이터 소스가 국경일을 제외하거나 캐시가 늦게 갱신되는 상황을 방지합니다.
    if (Number(year) >= 2026) fixed[`${year}-07-17`] = ['제헌절'];

    krHolidayMap = mergeHolidayMapV7(krHolidayMap || {}, fixed);
  }

  window.addFallbackFixedHolidaysForVisibleYear = function () {
    addKoreanHolidayOverridesV7(state.currentDate.getFullYear());
  };
  addFallbackFixedHolidaysForVisibleYear = window.addFallbackFixedHolidaysForVisibleYear;

  function hasHolidayForYearV7(year) {
    const prefix = String(year) + '-';
    return Object.keys(krHolidayMap || {}).some(date => date.startsWith(prefix));
  }

  window.loadKoreanHolidays = async function () {
    const visibleYear = state.currentDate.getFullYear();
    loadHolidayCache();
    addKoreanHolidayOverridesV7(visibleYear);

    // If fetched/cache data already contains the visible year, render immediately and keep data.
    // Do not use the old one-time holidayLoadStarted guard.
    const alreadyHasVisibleYear = hasHolidayForYearV7(visibleYear);

    try {
      if (!alreadyHasVisibleYear || !krHolidayMap.__loadedAllYears) {
        const res = await fetch(`${HOLIDAY_SOURCE_URL}?v=${HOLIDAY_PATCH_VERSION}-${new Date().getFullYear()}`, { cache: 'no-cache' });
        if (!res.ok) throw new Error('holiday fetch failed');
        const data = await res.json();
        const normalized = {};
        Object.entries(data || {}).forEach(([date, value]) => {
          const arr = normalizeHolidayValueV7(value);
          if (arr.length) normalized[date] = arr;
        });
        krHolidayMap = mergeHolidayMapV7(krHolidayMap || {}, normalized);
        krHolidayMap.__loadedAllYears = true;
      }
    } catch (err) {
      console.warn('공휴일 데이터를 불러오지 못했습니다. 보정 공휴일을 유지합니다.', err);
    }

    addKoreanHolidayOverridesV7(visibleYear);
    try {
      const cacheData = { updatedAt: new Date().toISOString(), version: HOLIDAY_PATCH_VERSION, data: krHolidayMap };
      localStorage.setItem(HOLIDAY_CACHE_KEY, JSON.stringify(cacheData));
    } catch {}
    renderCalendar();
  };
  loadKoreanHolidays = window.loadKoreanHolidays;

  window.getHolidaysForDate = function (dateStr) {
    return normalizeHolidayValueV7((krHolidayMap || {})[dateStr]);
  };
  getHolidaysForDate = window.getHolidaysForDate;

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      addKoreanHolidayOverridesV7(state.currentDate.getFullYear());
      if (typeof renderCalendar === 'function') renderCalendar();
      loadKoreanHolidays();
    }, 50);
  });
})();

// =====================================================
// PATCH 20260730-8: holiday label normalization + lunar holiday fallback
// - Rename 기독탄신일 to 크리스마스.
// - Add embedded Seollal/Chuseok holiday fallback for 2026-2035.
// - Ensure fetched data, fixed data, and embedded lunar data are merged, not overwritten.
// =====================================================
(function () {
  const HOLIDAY_PATCH_VERSION_V8 = '20260730-8';
const LUNAR_HOLIDAY_OVERRIDES_V8 = {
  '2026-02-16': ['설날'],
  '2026-02-17': ['설날'],
  '2026-02-18': ['설날'],
  '2026-09-24': ['추석'],
  '2026-09-25': ['추석'],
  '2026-09-26': ['추석'],
  '2026-09-28': ['대체공휴일 (추석)'],
  '2027-02-06': ['설날'],
  '2027-02-07': ['설날'],
  '2027-02-08': ['설날'],
  '2027-02-09': ['대체공휴일 (설날)'],
  '2027-09-14': ['추석'],
  '2027-09-15': ['추석'],
  '2027-09-16': ['추석'],
  '2028-01-26': ['설날'],
  '2028-01-27': ['설날'],
  '2028-01-28': ['설날'],
  '2028-10-02': ['추석'],
  '2028-10-03': ['추석'],
  '2028-10-04': ['추석'],
  '2029-02-12': ['설날'],
  '2029-02-13': ['설날'],
  '2029-02-14': ['설날'],
  '2029-09-21': ['추석'],
  '2029-09-22': ['추석'],
  '2029-09-23': ['추석'],
  '2029-09-24': ['대체공휴일 (추석)'],
  '2030-02-02': ['설날'],
  '2030-02-03': ['설날'],
  '2030-02-04': ['설날'],
  '2030-02-05': ['대체공휴일 (설날)'],
  '2030-09-11': ['추석'],
  '2030-09-12': ['추석'],
  '2030-09-13': ['추석'],
  '2031-01-22': ['설날'],
  '2031-01-23': ['설날'],
  '2031-01-24': ['설날'],
  '2031-09-30': ['추석'],
  '2031-10-01': ['추석'],
  '2031-10-02': ['추석'],
  '2032-02-10': ['설날'],
  '2032-02-11': ['설날'],
  '2032-02-12': ['설날'],
  '2032-09-18': ['추석'],
  '2032-09-19': ['추석'],
  '2032-09-20': ['추석'],
  '2032-09-21': ['대체공휴일 (추석)'],
  '2033-01-30': ['설날'],
  '2033-01-31': ['설날'],
  '2033-02-01': ['설날'],
  '2033-02-02': ['대체공휴일 (설날)'],
  '2033-09-07': ['추석'],
  '2033-09-08': ['추석'],
  '2033-09-09': ['추석'],
  '2034-02-18': ['설날'],
  '2034-02-19': ['설날'],
  '2034-02-20': ['설날'],
  '2034-02-21': ['대체공휴일 (설날)'],
  '2034-09-26': ['추석'],
  '2034-09-27': ['추석'],
  '2034-09-28': ['추석'],
  '2035-02-07': ['설날'],
  '2035-02-08': ['설날'],
  '2035-02-09': ['설날'],
  '2035-09-15': ['추석'],
  '2035-09-16': ['추석'],
  '2035-09-17': ['추석'],
  '2035-09-18': ['대체공휴일 (추석)'],
};

  const HOLIDAY_LABEL_ALIASES_V8 = {
    '기독탄신일': '크리스마스',
    '성탄절': '크리스마스',
    '크리스마스': '크리스마스'
  };

  function normalizeHolidayNameV8(name) {
    const text = String(name || '').trim();
    return HOLIDAY_LABEL_ALIASES_V8[text] || text;
  }

  function normalizeHolidayValueV8(value) {
    const arr = Array.isArray(value) ? value : (value ? [value] : []);
    return Array.from(new Set(arr.map(normalizeHolidayNameV8).filter(Boolean)));
  }

  function mergeHolidayMapV8(base, additions) {
    const target = base || {};
    Object.entries(additions || {}).forEach(([date, value]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const incoming = normalizeHolidayValueV8(value);
      if (!incoming.length) return;
      const existing = normalizeHolidayValueV8(target[date]);
      target[date] = Array.from(new Set([...existing, ...incoming]));
    });
    return target;
  }

  function normalizeEntireHolidayMapV8() {
    const normalized = {};
    Object.entries(krHolidayMap || {}).forEach(([date, value]) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) normalized[date] = normalizeHolidayValueV8(value);
    });
    krHolidayMap = normalized;
  }

  function applyFixedAndLunarOverridesV8(year) {
    if (!year || Number.isNaN(Number(year))) return;
    const fixed = {};
    fixed[`${year}-01-01`] = ['신정'];
    fixed[`${year}-03-01`] = ['삼일절'];
    fixed[`${year}-05-05`] = ['어린이날'];
    fixed[`${year}-06-06`] = ['현충일'];
    fixed[`${year}-08-15`] = ['광복절'];
    fixed[`${year}-10-03`] = ['개천절'];
    fixed[`${year}-10-09`] = ['한글날'];
    fixed[`${year}-12-25`] = ['크리스마스'];
    if (Number(year) >= 2026) fixed[`${year}-07-17`] = ['제헌절'];

    krHolidayMap = mergeHolidayMapV8(krHolidayMap || {}, fixed);
    krHolidayMap = mergeHolidayMapV8(krHolidayMap || {}, LUNAR_HOLIDAY_OVERRIDES_V8);
    normalizeEntireHolidayMapV8();
  }

  window.addFallbackFixedHolidaysForVisibleYear = function () {
    applyFixedAndLunarOverridesV8(state.currentDate.getFullYear());
  };
  addFallbackFixedHolidaysForVisibleYear = window.addFallbackFixedHolidaysForVisibleYear;

  const previousLoadKoreanHolidaysV8 = window.loadKoreanHolidays || loadKoreanHolidays;
  window.loadKoreanHolidays = async function () {
    const visibleYear = state.currentDate.getFullYear();
    loadHolidayCache();
    normalizeEntireHolidayMapV8();
    applyFixedAndLunarOverridesV8(visibleYear);

    try {
      await previousLoadKoreanHolidaysV8();
    } catch (err) {
      console.warn('기존 공휴일 로드 오류, 내장 보정값을 유지합니다.', err);
    }

    normalizeEntireHolidayMapV8();
    applyFixedAndLunarOverridesV8(visibleYear);
    try {
      localStorage.setItem(HOLIDAY_CACHE_KEY, JSON.stringify({
        updatedAt: new Date().toISOString(),
        version: HOLIDAY_PATCH_VERSION_V8,
        data: krHolidayMap
      }));
    } catch {}
    renderCalendar();
  };
  loadKoreanHolidays = window.loadKoreanHolidays;

  window.getHolidaysForDate = function (dateStr) {
    return normalizeHolidayValueV8((krHolidayMap || {})[dateStr]);
  };
  getHolidaysForDate = window.getHolidaysForDate;

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      loadHolidayCache();
      normalizeEntireHolidayMapV8();
      applyFixedAndLunarOverridesV8(state.currentDate.getFullYear());
      if (typeof renderCalendar === 'function') renderCalendar();
      loadKoreanHolidays();
    }, 80);
  });
})();

// =====================================================
// PATCH 20260730-manual-sync: disable automatic cloud sync
// - Keep data in localStorage only when edited.
// - Cloud upload/download/merge buttons remain manual.
// - Remove auto-sync enable flags left from older builds.
// =====================================================
(function () {
  const appId = window.GS_APP_ID || 'default';
  const possibleKeys = [
    'gs_auto_sync_enabled_v1',
    `${appId}__gs_auto_sync_enabled_v1`,
    'scheduler_hyunji__gs_auto_sync_enabled_v1'
  ];

  function clearAutoSyncFlags() {
    possibleKeys.forEach(key => {
      try { localStorage.removeItem(key); } catch {}
    });
  }

  clearAutoSyncFlags();

  window.scheduleAutoSyncV6 = function () {};
  if (typeof AutoSync !== 'undefined') {
    AutoSync.scheduleUpload = function () {};
  }

  // Re-override saveDataToStorage so local edits do not trigger cloud sync.
  window.saveDataToStorage = function () {
    saveDataToStorageOnly();
  };
  saveDataToStorage = window.saveDataToStorage;

  document.addEventListener('DOMContentLoaded', () => {
    clearAutoSyncFlags();
    const syncText = document.getElementById('sidebar-sync-text');
    if (syncText && typeof GithubSync !== 'undefined' && GithubSync.isConfigured()) {
      syncText.textContent = '수동 동기화';
    }
  });
})();

// =====================================================
// PATCH v.20260730-10-bulkdelete: bulk select and delete
// - Calendar selected-day schedule list bulk delete
// - Todo bulk delete
// - Notes bulk delete
// - D-Day bulk delete
// =====================================================
(function () {
  const BULK_DELETE_VERSION = 'v.20260730-10-bulkdelete';

  function makeBulkToolbarV10(title, countId, onSelectAll, onClear, onDelete) {
    const bar = document.createElement('div');
    bar.className = 'bulk-toolbar-v10';
    bar.innerHTML = `
      <div class="bulk-toolbar-title-v10">${title} <span id="${countId}">0개 선택</span></div>
      <div class="bulk-toolbar-actions-v10">
        <button type="button" class="btn btn-secondary btn-xs bulk-select-all-v10">전체 선택</button>
        <button type="button" class="btn btn-secondary btn-xs bulk-clear-v10">선택 해제</button>
        <button type="button" class="btn btn-danger btn-xs bulk-delete-v10">선택 삭제</button>
      </div>
    `;
    bar.querySelector('.bulk-select-all-v10')?.addEventListener('click', onSelectAll);
    bar.querySelector('.bulk-clear-v10')?.addEventListener('click', onClear);
    bar.querySelector('.bulk-delete-v10')?.addEventListener('click', onDelete);
    return bar;
  }

  function updateBulkCountV10(root, checkboxSelector, countId) {
    const count = root.querySelectorAll(`${checkboxSelector}:checked`).length;
    const countEl = document.getElementById(countId);
    if (countEl) countEl.textContent = `${count}개 선택`;
    return count;
  }

  function addBulkStylesV10() {
    if (document.getElementById('bulk-delete-styles-v10')) return;
    const style = document.createElement('style');
    style.id = 'bulk-delete-styles-v10';
    style.textContent = `
      .bulk-toolbar-v10 {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        padding:10px 12px;
        margin-bottom:12px;
        border:1px solid var(--panel-border);
        border-radius:12px;
        background:rgba(255,255,255,0.035);
        flex-wrap:wrap;
      }
      .bulk-toolbar-title-v10 {font-size:13px;font-weight:800;color:var(--text-secondary);}
      .bulk-toolbar-actions-v10 {display:flex;gap:8px;flex-wrap:wrap;}
      .bulk-check-v10 {width:18px;height:18px;min-width:18px;accent-color:var(--color-danger);margin-top:4px;cursor:pointer;}
      .todo-item.bulk-mode-v10,.note-item.bulk-mode-v10,.dday-item.bulk-mode-v10 {gap:10px;}
      .todo-item.bulk-mode-v10 .todo-item-left,.note-bulk-row-v10,.dday-bulk-row-v10 {display:flex;align-items:flex-start;gap:10px;min-width:0;flex:1;}
      .note-bulk-content-v10 {min-width:0;flex:1;}
      .bulk-hint-v10 {font-size:12px;color:var(--text-muted);margin-top:-6px;margin-bottom:8px;}
      @media (max-width:768px){.bulk-toolbar-v10{align-items:stretch}.bulk-toolbar-actions-v10 button{flex:1}.bulk-toolbar-actions-v10{width:100%}}
    `;
    document.head.appendChild(style);
  }

  // -----------------------------
  // D-DAY bulk delete
  // -----------------------------
  window.renderDdayList = function () {
    const el = document.getElementById('dashboard-dday-list');
    if (!el) return;
    el.innerHTML = '';
    if (!state.ddays.length) { el.innerHTML = '<div class="no-data">등록된 D-Day 일정이 없습니다.</div>'; return; }

    const countId = 'bulk-dday-count-v10';
    const toolbar = makeBulkToolbarV10(
      'D-Day 일괄 선택',
      countId,
      () => { el.querySelectorAll('.bulk-dday-check-v10').forEach(cb => cb.checked = true); updateBulkCountV10(el, '.bulk-dday-check-v10', countId); },
      () => { el.querySelectorAll('.bulk-dday-check-v10').forEach(cb => cb.checked = false); updateBulkCountV10(el, '.bulk-dday-check-v10', countId); },
      () => {
        const ids = Array.from(el.querySelectorAll('.bulk-dday-check-v10:checked')).map(cb => cb.dataset.id);
        if (!ids.length) return alert('삭제할 D-Day를 선택해주세요.');
        if (!confirm(`선택한 D-Day ${ids.length}개를 삭제할까요?`)) return;
        state.ddays = state.ddays.filter(d => !ids.includes(d.id));
        saveDataToStorage();
        renderDashboard();
      }
    );
    el.appendChild(toolbar);

    const today = new Date(getLocalDateString(new Date()));
    state.ddays.slice().sort((a,b) => a.date.localeCompare(b.date)).forEach(d => {
      const diff = Math.ceil((new Date(d.date) - today) / 86400000);
      const badgeText = diff === 0 ? 'D-Day' : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
      const item = document.createElement('div');
      item.className = 'dday-item bulk-mode-v10';
      item.innerHTML = `
        <input type="checkbox" class="bulk-check-v10 bulk-dday-check-v10" data-id="${d.id}">
        <div class="dday-bulk-row-v10">
          <div class="dday-info"><div class="dday-title">${escapeHTML(d.title)}</div><div class="dday-target-date">${escapeHTML(d.date)}</div></div>
          <div><span class="dday-badge ${diff < 0 ? 'dday-passed' : diff <= 7 ? 'dday-urgent' : ''}">${badgeText}</span><button class="btn-delete-dday" data-id="${d.id}"><i class="fa-solid fa-trash"></i></button></div>
        </div>`;
      item.querySelector('.bulk-dday-check-v10')?.addEventListener('change', () => updateBulkCountV10(el, '.bulk-dday-check-v10', countId));
      el.appendChild(item);
    });
    el.querySelectorAll('.btn-delete-dday').forEach(btn => btn.addEventListener('click', () => {
      state.ddays = state.ddays.filter(d => d.id !== btn.dataset.id);
      saveDataToStorage(); renderDashboard();
    }));
    updateBulkCountV10(el, '.bulk-dday-check-v10', countId);
  };
  renderDdayList = window.renderDdayList;

  // -----------------------------
  // Todo bulk delete
  // -----------------------------
  window.renderTodoList = function () {
    const el = document.getElementById('todo-items-list');
    if (!el) return;
    el.innerHTML = '';
    let list = state.todos;
    if (todoFilter === 'active') list = list.filter(t => !t.completed);
    if (todoFilter === 'completed') list = list.filter(t => t.completed);
    if (!list.length) { el.innerHTML = '<div class="no-data">할 일이 없습니다. 여유로운 하루를 보내세요!</div>'; return; }

    const countId = 'bulk-todo-count-v10';
    const toolbar = makeBulkToolbarV10(
      '업무 일괄 선택',
      countId,
      () => { el.querySelectorAll('.bulk-todo-check-v10').forEach(cb => cb.checked = true); updateBulkCountV10(el, '.bulk-todo-check-v10', countId); },
      () => { el.querySelectorAll('.bulk-todo-check-v10').forEach(cb => cb.checked = false); updateBulkCountV10(el, '.bulk-todo-check-v10', countId); },
      () => {
        const ids = Array.from(el.querySelectorAll('.bulk-todo-check-v10:checked')).map(cb => cb.dataset.id);
        if (!ids.length) return alert('삭제할 업무를 선택해주세요.');
        if (!confirm(`선택한 업무 ${ids.length}개를 삭제할까요?`)) return;
        state.todos = state.todos.filter(t => !ids.includes(t.id));
        if (editingTodoId && ids.includes(editingTodoId)) setTodoFormMode('add');
        saveDataToStorage();
        renderTodoList();
        renderDashboard();
      }
    );
    el.appendChild(toolbar);

    const labels = { high: '높음', medium: '보통', low: '낮음' };
    list.forEach(t => {
      const item = document.createElement('div');
      item.className = 'todo-item bulk-mode-v10' + (t.completed ? ' completed' : '');
      item.innerHTML = `<input type="checkbox" class="bulk-check-v10 bulk-todo-check-v10" data-id="${t.id}">
        <div class="todo-item-left"><label class="todo-checkbox-wrapper"><input type="checkbox" ${t.completed ? 'checked' : ''}><span class="todo-checkmark"></span></label><div class="todo-details"><div class="todo-text">${escapeHTML(t.text)}</div><div class="todo-meta"><span class="todo-priority-badge priority-${t.priority || 'medium'}">${labels[t.priority] || '보통'}</span>${t.duedate ? `<span class="todo-due-meta">${escapeHTML(t.duedate)}</span>` : ''}</div></div></div><div class="todo-actions"><button class="btn-todo-action btn-todo-edit" title="수정"><i class="fa-solid fa-pen"></i></button><button class="btn-todo-action btn-todo-delete" title="삭제"><i class="fa-solid fa-trash"></i></button></div>`;
      item.querySelector('.bulk-todo-check-v10')?.addEventListener('change', () => updateBulkCountV10(el, '.bulk-todo-check-v10', countId));
      item.querySelector('.todo-checkbox-wrapper input')?.addEventListener('change', e => { t.completed = e.target.checked; t.updatedAt = new Date().toISOString(); saveDataToStorage(); renderTodoList(); renderDashboard(); });
      item.querySelector('.btn-todo-edit')?.addEventListener('click', () => startEditTodo(t.id));
      item.querySelector('.btn-todo-delete')?.addEventListener('click', () => { state.todos = state.todos.filter(x => x.id !== t.id); if (editingTodoId === t.id) setTodoFormMode('add'); saveDataToStorage(); renderTodoList(); renderDashboard(); });
      el.appendChild(item);
    });
    updateBulkCountV10(el, '.bulk-todo-check-v10', countId);
  };
  renderTodoList = window.renderTodoList;

  // -----------------------------
  // Notes bulk delete
  // -----------------------------
  window.renderNotesList = function () {
    const el = document.getElementById('notes-list-items');
    if (!el) return;
    el.innerHTML = '';
    if (!state.notes.length) { el.innerHTML = '<div class="no-data">메모가 없습니다.</div>'; return; }

    const countId = 'bulk-note-count-v10';
    const toolbar = makeBulkToolbarV10(
      '메모 일괄 선택',
      countId,
      () => { el.querySelectorAll('.bulk-note-check-v10').forEach(cb => cb.checked = true); updateBulkCountV10(el, '.bulk-note-check-v10', countId); },
      () => { el.querySelectorAll('.bulk-note-check-v10').forEach(cb => cb.checked = false); updateBulkCountV10(el, '.bulk-note-check-v10', countId); },
      () => {
        const ids = Array.from(el.querySelectorAll('.bulk-note-check-v10:checked')).map(cb => cb.dataset.id);
        if (!ids.length) return alert('삭제할 메모를 선택해주세요.');
        if (!confirm(`선택한 메모 ${ids.length}개를 삭제할까요?`)) return;
        state.notes = state.notes.filter(n => !ids.includes(n.id));
        if (activeNoteId && ids.includes(activeNoteId)) {
          activeNoteId = null;
          document.getElementById('note-editor-form')?.classList.add('hidden');
          document.getElementById('note-editor-placeholder')?.classList.remove('hidden');
        }
        saveDataToStorage();
        renderNotesList();
        renderDashboard();
      }
    );
    el.appendChild(toolbar);

    state.notes.forEach(n => {
      const item = document.createElement('div');
      item.className = 'note-item bulk-mode-v10' + (n.id === activeNoteId ? ' active' : '');
      item.innerHTML = `<div class="note-bulk-row-v10"><input type="checkbox" class="bulk-check-v10 bulk-note-check-v10" data-id="${n.id}"><div class="note-bulk-content-v10"><div class="note-item-title">${escapeHTML(n.title || '제목 없는 메모')}${n.favorite ? '<span class="note-item-star"><i class="fa-solid fa-star"></i></span>' : ''}</div><div class="note-item-preview">${escapeHTML((n.content || '').slice(0, 60))}</div><div class="note-item-meta"><span class="note-item-category">${escapeHTML(n.category || '분류 없음')}</span><span>${n.updatedAt ? new Date(n.updatedAt).toLocaleDateString('ko-KR') : ''}</span></div></div></div>`;
      item.querySelector('.bulk-note-check-v10')?.addEventListener('click', ev => ev.stopPropagation());
      item.querySelector('.bulk-note-check-v10')?.addEventListener('change', () => updateBulkCountV10(el, '.bulk-note-check-v10', countId));
      item.addEventListener('click', ev => {
        if (ev.target && ev.target.classList.contains('bulk-note-check-v10')) return;
        selectNote(n.id);
      });
      el.appendChild(item);
    });
    updateBulkCountV10(el, '.bulk-note-check-v10', countId);
  };
  renderNotesList = window.renderNotesList;

  // -----------------------------
  // Calendar selected-day event bulk delete
  // -----------------------------
  window.openDayScheduleModal = function (dateStr) {
    const modal = ensureDayScheduleModal();
    const title = document.getElementById('day-schedule-title');
    const list = document.getElementById('day-schedule-list');
    const d = new Date(dateStr);
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const displayDate = Number.isNaN(d.getTime()) ? dateStr : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`;
    if (title) title.textContent = `${displayDate} 일정`;
    if (!list) return;
    list.innerHTML = '';

    const holidays = typeof getHolidaysForDate === 'function' ? getHolidaysForDate(dateStr) : [];
    const events = typeof getEventsForDate === 'function' ? getEventsForDate(dateStr) : [];

    const countId = 'bulk-day-event-count-v10';
    if (events.length) {
      const toolbar = makeBulkToolbarV10(
        '일정 일괄 선택',
        countId,
        () => { list.querySelectorAll('.bulk-day-event-check-v10').forEach(cb => cb.checked = true); updateBulkCountV10(list, '.bulk-day-event-check-v10', countId); },
        () => { list.querySelectorAll('.bulk-day-event-check-v10').forEach(cb => cb.checked = false); updateBulkCountV10(list, '.bulk-day-event-check-v10', countId); },
        () => {
          const selected = Array.from(list.querySelectorAll('.bulk-day-event-check-v10:checked')).map(cb => ({ id: cb.dataset.id, date: cb.dataset.date, recurring: cb.dataset.recurring === '1' }));
          if (!selected.length) return alert('삭제할 일정을 선택해주세요.');
          if (!confirm(`선택한 일정 ${selected.length}개를 삭제할까요?\n반복 일정은 선택한 날짜 1건만 제외 처리됩니다.`)) return;
          selected.forEach(sel => {
            const idx = state.events.findIndex(e => e.id === sel.id);
            if (idx < 0) return;
            const master = state.events[idx];
            const repeat = typeof getRepeatValue === 'function' ? getRepeatValue(master) : (master.repeat || 'none');
            if (sel.recurring || (repeat && repeat !== 'none')) {
              master.exceptionDeletes = master.exceptionDeletes || {};
              master.exceptionDeletes[sel.date] = true;
              master.updatedAt = new Date().toISOString();
              state.events[idx] = master;
            } else {
              state.events = state.events.filter(e => e.id !== sel.id);
            }
          });
          saveDataToStorage();
          renderDashboard();
          renderCalendar();
          openDayScheduleModal(dateStr);
        }
      );
      list.appendChild(toolbar);
    }

    if (!holidays.length && !events.length) {
      list.innerHTML += '<div class="day-schedule-empty">등록된 일정이 없습니다.</div>';
      if (typeof appendDayScheduleAddButtonV6 === 'function') appendDayScheduleAddButtonV6(list, modal, dateStr);
      openModal(modal);
      return;
    }

    holidays.forEach(name => {
      const item = document.createElement('div');
      item.className = 'day-schedule-item holiday-detail-item';
      item.innerHTML = `<div class="day-schedule-color holiday-dot"></div><div class="day-schedule-body"><div class="day-schedule-name">${escapeHTML(name)}</div><div class="day-schedule-meta">공휴일</div></div>`;
      list.appendChild(item);
    });

    events.forEach(evt => {
      const item = document.createElement('div');
      item.className = 'day-schedule-item day-event-item' + (evt.completed ? ' day-event-completed' : '');
      item.innerHTML = `<input type="checkbox" class="bulk-check-v10 bulk-day-event-check-v10" data-id="${evt.id}" data-date="${dateStr}" data-recurring="${evt.isRecurringOccurrence ? '1' : '0'}"><button type="button" class="day-complete-toggle" title="완료 체크">${evt.completed ? '✓' : ''}</button> <span class="day-schedule-color" style="background:${evt.color || '#3498db'}"></span> <button type="button" class="day-schedule-open"> <span class="day-schedule-body"> <strong class="day-schedule-name">${escapeHTML(evt.title || '제목 없음')}</strong> <span class="day-schedule-meta">${evt.isRecurringOccurrence ? '↻ 반복 | ' : ''}${evt.reminder && evt.reminder !== 'none' ? '🔔 알림 | ' : ''}${escapeHTML(formatEventTime(evt))}${escapeHTML(evt.occurrenceDate || evt.startDate || '')}</span> ${evt.desc ? `<span class="day-schedule-desc">${escapeHTML(evt.desc)}</span>` : ''} </span> </button>`;
      item.querySelector('.bulk-day-event-check-v10')?.addEventListener('change', () => updateBulkCountV10(list, '.bulk-day-event-check-v10', countId));
      item.querySelector('.day-complete-toggle')?.addEventListener('click', () => {
        if (typeof toggleEventCompleted === 'function') {
          toggleEventCompleted(evt, dateStr);
          openDayScheduleModal(dateStr);
        }
      });
      item.querySelector('.day-schedule-open')?.addEventListener('click', () => {
        closeModal(modal);
        openEventModal(evt);
      });
      list.appendChild(item);
    });

    if (events.length) updateBulkCountV10(list, '.bulk-day-event-check-v10', countId);
    if (typeof appendDayScheduleAddButtonV6 === 'function') appendDayScheduleAddButtonV6(list, modal, dateStr);
    openModal(modal);
  };
  openDayScheduleModal = window.openDayScheduleModal;

  document.addEventListener('DOMContentLoaded', () => {
    addBulkStylesV10();
    setTimeout(() => {
      renderDashboard();
      renderTodoList();
      renderNotesList();
    }, 100);
  });
})();
