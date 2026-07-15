/**
 * G-Scheduler & Notes - Final app.js
 * Fixes: initSettings recursion, calendar time fields, 5-minute time step, mobile sync status
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
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(state.events.map(migrateEventTimeFields)));
  localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(state.todos));
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state.notes));
  localStorage.setItem(STORAGE_KEYS.DDAYS, JSON.stringify(state.ddays));

  if (typeof AutoSync !== 'undefined' && typeof AutoSync.scheduleUpload === 'function') {
    AutoSync.scheduleUpload(getFullAppState());
  }
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

function countAppData(data) {
  if (!data) return 0;
  return (Array.isArray(data.events) ? data.events.length : 0)
    + (Array.isArray(data.todos) ? data.todos.length : 0)
    + (Array.isArray(data.notes) ? data.notes.length : 0)
    + (Array.isArray(data.ddays) ? data.ddays.length : 0);
}

function restoreFullAppState(data) {
  if (!data) return;
  if (Array.isArray(data.events)) state.events = data.events.map(migrateEventTimeFields);
  if (Array.isArray(data.todos)) state.todos = data.todos;
  if (Array.isArray(data.notes)) state.notes = data.notes;
  if (Array.isArray(data.ddays)) state.ddays = data.ddays;
  saveDataToStorageOnly();
  renderAll();
}

function saveDataToStorageOnly() {
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(state.events.map(migrateEventTimeFields)));
  localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(state.todos));
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state.notes));
  localStorage.setItem(STORAGE_KEYS.DDAYS, JSON.stringify(state.ddays));
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

document.addEventListener('DOMContentLoaded', initApp);

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
  const navButtons = document.querySelectorAll('.nav-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const pageTitle = document.getElementById('page-title');
  const titles = { dashboard: '대시보드', calendar: '달력 일정', todos: '업무 리스트', notes: '정보 메모', settings: '설정 및 동기화' };
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      navButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`)?.classList.add('active');
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

function initDashboard() {
  document.getElementById('btn-add-dday')?.addEventListener('click', openDdayModal);
  document.getElementById('dday-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const id = document.getElementById('dday-id').value || 'dday_' + Date.now();
    const title = document.getElementById('dday-title').value.trim();
    const date = document.getElementById('dday-date').value;
    if (!title || !date) return;
    const idx = state.ddays.findIndex(d => d.id === id);
    const item = { id, title, date };
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
    saveDataToStorage(); renderDdayList();
  }));
}

function renderTodayEvents() {
  const el = document.getElementById('dashboard-today-events');
  if (!el) return;
  el.innerHTML = '';
  const today = getLocalDateString(new Date());
  const items = state.events.map(migrateEventTimeFields).filter(e => isDateInRange(today, e.startDate, e.endDate)).sort((a,b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
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
    a.addEventListener('click', () => {
      document.querySelector('.nav-btn[data-tab="notes"]')?.click();
      selectNote(n.id);
    });
    el.appendChild(a);
  });
}

function openDdayModal() {
  document.getElementById('dday-id').value = '';
  document.getElementById('dday-form')?.reset();
  document.getElementById('dday-date').value = getLocalDateString(new Date());
  openModal(document.getElementById('modal-dday'));
}

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
    const eventData = { id: id || 'evt_' + Date.now(), title, startDate, endDate, startTime, endTime, color, desc };
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
    cellEl.innerHTML = `<span class="cell-num">${cell.day}</span><div class="cell-events"></div>`;
    const eventsContainer = cellEl.querySelector('.cell-events');
    state.events.filter(e => isDateInRange(cell.dateStr, e.startDate, e.endDate)).sort((a,b) => (a.startTime || '99:99').localeCompare(b.startTime || '99:99')).forEach(evt => {
      const badge = document.createElement('div');
      badge.className = 'event-badge';
      badge.style.backgroundColor = evt.color || '#3498db';
      badge.textContent = `${formatEventTime(evt)}${evt.title}`;
      badge.title = badge.textContent;
      badge.addEventListener('click', ev => { ev.stopPropagation(); openEventModal(evt); });
      eventsContainer.appendChild(badge);
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

function initTodos() {
  const form = document.getElementById('todo-form');
  form?.addEventListener('submit', e => {
    e.preventDefault();
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    if (!text) return;
    state.todos.push({ id: 'todo_' + Date.now(), text, priority: document.getElementById('todo-priority').value, duedate: document.getElementById('todo-duedate').value, completed: false });
    input.value = ''; document.getElementById('todo-duedate').value = '';
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
    item.innerHTML = `<div class="todo-item-left"><label class="todo-checkbox-wrapper"><input type="checkbox" ${t.completed ? 'checked' : ''}><span class="todo-checkmark"></span></label><div class="todo-details"><div class="todo-text">${escapeHTML(t.text)}</div><div class="todo-meta"><span class="todo-priority-badge priority-${t.priority || 'medium'}">${labels[t.priority] || '보통'}</span>${t.duedate ? `<span class="todo-due-meta"><i class="fa-regular fa-calendar"></i>${escapeHTML(t.duedate)}</span>` : ''}</div></div></div><div class="todo-actions"><button class="btn-todo-action btn-todo-delete"><i class="fa-solid fa-trash"></i></button></div>`;
    item.querySelector('input').addEventListener('change', e => { t.completed = e.target.checked; saveDataToStorage(); renderTodoList(); renderDashboard(); });
    item.querySelector('.btn-todo-delete').addEventListener('click', () => { state.todos = state.todos.filter(x => x.id !== t.id); saveDataToStorage(); renderTodoList(); renderDashboard(); });
    el.appendChild(item);
  });
}

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

function ensureMobileSyncStatusBox() {
  let box = document.getElementById('mobile-sync-status-box');
  if (box) return box;
  box = document.createElement('div');
  box.id = 'mobile-sync-status-box';
  box.className = 'sync-status offline';
  box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;border-radius:0;padding:10px 14px;background:rgba(15,12,32,.95);border-top:1px solid rgba(255,255,255,.12);font-size:12px;display:flex;gap:8px;align-items:center;';
  box.innerHTML = '<i class="fa-solid fa-circle"></i><span id="mobile-sync-status-text">로컬 모드 | 설정에서 PAT/Gist ID 입력 필요</span><button id="mobile-sync-status-close" style="margin-left:auto;background:transparent;border:0;color:inherit;font-size:16px;cursor:pointer">×</button>';
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
  if (autoHide && mode === 'online') setTimeout(() => { box.style.display = 'none'; }, 4000);
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
    syncForm.addEventListener('submit', e => {
      e.preventDefault();
      const patVal = patInput ? patInput.value.trim() : '';
      const gistIdVal = gistIdInput ? gistIdInput.value.trim() : '';
      if (!patVal) return alert('GitHub PAT를 입력해주세요.');
      if (typeof GithubSync === 'undefined') return alert('github-sync.js가 로드되지 않았습니다.');
      GithubSync.saveSettings(patVal, gistIdVal);
      if (syncNowBtn) syncNowBtn.classList.remove('hidden');
      updateSyncIndicator(); renderSyncLogBox();
      setMobileSyncStatus('설정 저장 완료 | 동기화 버튼을 눌러주세요', 'online');
      alert('동기화 설정이 저장되었습니다. 이제 지금 동기화를 눌러주세요.');
    }, true);
  }

  syncNowBtn?.addEventListener('click', executeGitHubSync);
  updateSyncIndicator();
  renderSyncLogBox();
}

async function executeGitHubSync() {
  const syncNowBtn = document.getElementById('btn-sync-now');
  try {
    if (typeof GithubSync === 'undefined') throw new Error('github-sync.js가 로드되지 않았습니다.');
    if (!GithubSync.isConfigured()) throw new Error('PAT가 저장되지 않았습니다. 설정 및 동기화에서 PAT를 입력한 뒤 설정 저장 및 연결을 눌러주세요.');
    syncNowBtn && (syncNowBtn.disabled = true);
    setMobileSyncStatus('동기화 중...', 'syncing', false);
    updateSyncIndicator('syncing');
    const localData = getFullAppState();
    const remoteData = await GithubSync.downloadData();
    let finalData = localData;
    if (remoteData && countAppData(remoteData) > countAppData(localData)) finalData = remoteData;
    restoreFullAppState(finalData);
    await GithubSync.uploadData(getFullAppState());
    localStorage.setItem(GithubSync.KEYS.LAST_SYNC, new Date().toISOString());
    updateSyncIndicator('online'); renderSyncLogBox();
    setMobileSyncStatus('동기화 완료', 'online');
    alert('동기화가 완료되었습니다.');
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
