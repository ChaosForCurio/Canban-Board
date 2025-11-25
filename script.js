/* Kanban Drag & Drop + Modal Add/Edit + Counters + localStorage
   Clean, well-commented, production-friendly
*/

(() => {
    /* ---------- Selectors ---------- */
    const newTaskBtn = document.getElementById('new-task-btn');
    const taskTemplate = document.getElementById('task-template');
    const columns = {
        todo: document.getElementById('todo-column'),
        inprogress: document.getElementById('progress-column'),
        done: document.getElementById('done-column'),
    };
    const counts = {
        todo: document.getElementById('todo-count'),
        inprogress: document.getElementById('progress-count'),
        done: document.getElementById('done-count'),
    };

    /* Modal */
    const modal = document.getElementById('task-modal');
    const modalBackdrop = modal.querySelector('.modal-backdrop');
    const modalClose = document.getElementById('modal-close');
    const modalCancel = document.getElementById('modal-cancel');
    const taskForm = document.getElementById('task-form');
    const titleInput = document.getElementById('task-title');
    const descInput = document.getElementById('task-desc');
    const statusSelect = document.getElementById('task-status');

    /* drag state */
    let dragged = null;
    let placeholder = null;
    let editingId = null;

    /* storage key */
    const STORAGE_KEY = 'kanban.tasks.v1';

    /* ---------- Utilities ---------- */
    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function saveTasksToStorage() {
        const all = [];
        Object.keys(columns).forEach(key => {
            const col = columns[key];
            Array.from(col.children).forEach(el => {
                all.push({
                    id: el.dataset.id,
                    title: el.querySelector('.title').textContent,
                    description: el.querySelector('.desc').textContent,
                    status: key,
                });
            });
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    }

    function loadTasksFromStorage() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        try {
            const arr = JSON.parse(raw);
            arr.forEach(obj => {
                const el = buildTaskElement(obj);
                columns[obj.status]?.appendChild(el);
            });
            updateCounts();
        } catch (e) {
            console.warn('Failed to parse stored tasks', e);
        }
    }

    /* create element from template and populate */
    function buildTaskElement({ id = null, title = 'Untitled', description = '', status = 'todo' } = {}) {
        const clone = taskTemplate.content.cloneNode(true);
        const taskEl = clone.querySelector('.task');
        const titleEl = clone.querySelector('.title');
        const descEl = clone.querySelector('.desc');
        const editBtn = clone.querySelector('.edit-btn');
        const deleteBtn = clone.querySelector('.delete-btn');

        taskEl.dataset.id = id || uid();
        titleEl.textContent = title;
        descEl.textContent = description;

        // attach handlers
        taskEl.addEventListener('dragstart', onDragStart);
        taskEl.addEventListener('dragend', onDragEnd);

        editBtn.addEventListener('click', () => openEditModal(taskEl));
        deleteBtn.addEventListener('click', () => {
            taskEl.remove();
            updateCounts();
            saveTasksToStorage();
        });

        return taskEl;
    }

    /* ---------- Modal logic (add/edit) ---------- */
    function openModal() {
        editingId = null;
        taskForm.reset();
        modal.setAttribute('aria-hidden', 'false');
        titleInput.focus();
    }

    function openEditModal(taskEl) {
        editingId = taskEl.dataset.id;
        titleInput.value = taskEl.querySelector('.title').textContent;
        descInput.value = taskEl.querySelector('.desc').textContent;
        statusSelect.value = findStatusForTask(taskEl);
        modal.querySelector('#modal-title').textContent = 'Edit Task';
        modal.setAttribute('aria-hidden', 'false');
        titleInput.focus();
    }

    function closeModal() {
        editingId = null;
        modal.querySelector('#modal-title').textContent = 'New Task';
        modal.setAttribute('aria-hidden', 'true');
    }

    function findStatusForTask(el) {
        if (!el) return 'todo';
        const parent = el.closest('.column-content');
        return parent?.dataset.status || 'todo';
    }

    /* submit handler */
    taskForm.addEventListener('submit', e => {
        e.preventDefault();
        const title = titleInput.value.trim();
        const desc = descInput.value.trim();
        const status = statusSelect.value;

        if (!title) {
            titleInput.focus();
            return;
        }

        if (editingId) {
            // find existing
            const existing = document.querySelector(`.task[data-id="${editingId}"]`);
            if (existing) {
                existing.querySelector('.title').textContent = title;
                existing.querySelector('.desc').textContent = desc;
                // move column if status changed
                if (findStatusForTask(existing) !== status) {
                    columns[status].appendChild(existing);
                }
            }
        } else {
            const el = buildTaskElement({ title, description: desc, status });
            columns[status].appendChild(el);
        }

        updateCounts();
        saveTasksToStorage();
        closeModal();
    });

    /* modal close handlers */
    newTaskBtn.addEventListener('click', () => {
        openModal();
    });
    modalClose.addEventListener('click', closeModal);
    modalCancel?.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal();
    });

    /* ---------- Counters ---------- */
    function updateCounts() {
        counts.todo.textContent = columns.todo.children.length;
        counts.inprogress.textContent = columns.inprogress.children.length;
        counts.done.textContent = columns.done.children.length;
    }

    /* ---------- Drag & Drop ---------- */
    function createPlaceholder(height = 68) {
        const ph = document.createElement('div');
        ph.className = 'task-placeholder';
        ph.style.height = `${height}px`;
        return ph;
    }

    function onDragStart(e) {
        dragged = this;
        this.classList.add('dragging');

        // create placeholder to show where the card will land
        placeholder = createPlaceholder(this.offsetHeight);
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', this.dataset.id); } catch (err) { /* IE */ }
        // small timeout to ensure styles apply
        setTimeout(() => this.style.display = 'none', 0);
    }

    function onDragEnd() {
        if (dragged) {
            dragged.style.display = '';
            dragged.classList.remove('dragging');
        }
        removePlaceholders();
        dragged = null;
        placeholder = null;
        // cleanup hover classes
        Object.values(columns).forEach(col => col.classList.remove('drop-hover'));
        updateCounts();
        saveTasksToStorage();
    }

    function removePlaceholders() {
        document.querySelectorAll('.task-placeholder').forEach(p => p.remove());
    }

    function handleDragOver(e) {
        e.preventDefault(); // allow drop
        const column = this;
        column.classList.add('drop-hover');

        // find child to insert before
        const afterEl = getDragAfterElement(column, e.clientY);
        removePlaceholders();
        if (afterEl == null) {
            column.appendChild(placeholder);
        } else {
            column.insertBefore(placeholder, afterEl);
        }
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDragLeave(e) {
        const column = this;
        // when leaving to a child element, don't remove yet — use enter/over to manage
        // if leaving completely remove hover and placeholders
        const rect = column.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            column.classList.remove('drop-hover');
            removePlaceholders();
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        const column = this;
        column.classList.remove('drop-hover');

        // If placeholder present, insert before placeholder, else append
        if (placeholder && placeholder.parentElement === column) {
            column.insertBefore(dragged, placeholder);
            placeholder.remove();
        } else {
            column.appendChild(dragged);
        }

        dragged.style.display = '';
        dragged.classList.remove('dragging');

        updateCounts();
        saveTasksToStorage();
    }

    /* Utility: find element after pointer */
    function getDragAfterElement(container, y) {
        const elements = [...container.querySelectorAll('.task:not(.dragging)')];

        return elements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            // offset negative means above midpoint -> closer
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element || null;
    }

    /* attach drag listeners to columns */
    Object.values(columns).forEach(col => {
        col.addEventListener('dragover', handleDragOver);
        col.addEventListener('dragenter', (e) => { e.preventDefault(); col.classList.add('drop-hover'); });
        col.addEventListener('dragleave', handleDragLeave);
        col.addEventListener('drop', handleDrop);
    });

    /* ---------- Initialization ---------- */
    // If no saved tasks, seed with a friendly sample
    function seedIfEmpty() {
        if (!localStorage.getItem(STORAGE_KEY)) {
            const sample = [
                { id: uid(), title: 'Plan homepage', description: 'Sketch layout & gather assets', status: 'todo' },
                { id: uid(), title: 'Integrate auth', description: 'Add sign-in API', status: 'inprogress' },
                { id: uid(), title: 'Ship v1', description: 'Prepare release notes', status: 'done' },
            ];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sample));
        }
    }

    // Load tasks
    seedIfEmpty();
    loadTasksFromStorage();

    // When new task button clicked, prepare modal for new
    newTaskBtn.addEventListener('click', () => {
        modal.querySelector('#modal-title').textContent = 'New Task';
        taskForm.reset();
        statusSelect.value = 'todo';
        modal.setAttribute('aria-hidden', 'false');
        titleInput.focus();
    });

    // update counts on page load
    updateCounts();

    // tidy up on unload
    window.addEventListener('beforeunload', saveTasksToStorage);
})();
