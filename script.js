/* ==========================
   Drag & Drop Kanban Script
   - Uses your #task-template
   - IDs: todo-column, progress-column, done-column
   - Counts: todo-count, progress-count, done-count
   ========================== */

const cols = {
    todo: document.getElementById("todo-column"),
    inprogress: document.getElementById("progress-column"),
    done: document.getElementById("done-column")
};
const counts = {
    todo: document.getElementById("todo-count"),
    inprogress: document.getElementById("progress-count"),
    done: document.getElementById("done-count")
};

const newTaskBtn = document.getElementById("new-task-btn");
const template = document.getElementById("task-template");

let draggingEl = null;
let placeholder = null;

/* --------------------------
   Helpers
   -------------------------- */
function updateCounts() {
    counts.todo.textContent = cols.todo.children.length;
    counts.inprogress.textContent = cols.inprogress.children.length;
    counts.done.textContent = cols.done.children.length;
}

function createTask({ title = "Untitled", desc = "" } = {}) {
    const clone = template.content.cloneNode(true);
    const el = clone.querySelector(".task");
    el.querySelector(".task-title").textContent = title;
    el.querySelector(".task-content").textContent = desc;

    // actions
    const del = el.querySelector(".delete-btn");
    const edit = el.querySelector(".edit-btn");

    del.addEventListener("click", () => {
        el.remove();
        updateCounts();
    });

    edit.addEventListener("click", () => {
        const t = prompt("Edit title:", el.querySelector(".task-title").textContent);
        const d = prompt("Edit description:", el.querySelector(".task-content").textContent);
        if (t != null) el.querySelector(".task-title").textContent = t;
        if (d != null) el.querySelector(".task-content").textContent = d;
    });

    // make draggable
    el.setAttribute("draggable", "true");
    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("dragend", onDragEnd);

    return el;
}

/* --------------------------
   Drag logic
   -------------------------- */
function createPlaceholder(height = 64) {
    const p = document.createElement("div");
    p.className = "task-placeholder";
    p.style.height = `${height}px`;
    return p;
}

function getAfterElement(container, y) {
    // returns element after which dropped (or null to append at end)
    const draggableElements = [...container.querySelectorAll(".task:not(.dragging)")];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > (closest.offset || -Infinity)) {
            return { offset, element: child };
        } else {
            return closest;
        }
    }, { offset: -Infinity }).element || null;
}

/* Drag handlers */
function onDragStart(e) {
    draggingEl = e.currentTarget;
    draggingEl.classList.add("dragging");

    // create placeholder sized like the dragged element
    const rect = draggingEl.getBoundingClientRect();
    placeholder = createPlaceholder(rect.height);
    // use dataTransfer for Firefox compatibility
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", ""); } catch (err) { /* noop */ }
    // slightly delay add to allow CSS to apply
    requestAnimationFrame(() => {
        draggingEl.style.display = "none";
    });
}

function onDragEnd() {
    if (draggingEl) {
        draggingEl.style.display = "";
        draggingEl.classList.remove("dragging");
        draggingEl = null;
    }
    // remove any placeholders
    document.querySelectorAll(".task-placeholder").forEach(p => p.remove());
    // remove drop hover
    document.querySelectorAll(".column-content.drop-hover").forEach(c => c.classList.remove("drop-hover"));
    updateCounts();
}

/* Column dragover/drop */
Object.values(cols).forEach(col => {
    col.addEventListener("dragenter", e => {
        e.preventDefault();
        col.classList.add("drop-hover");
    });

    col.addEventListener("dragover", e => {
        e.preventDefault();
        const y = e.clientY;
        const afterEl = getAfterElement(col, y);

        // ensure placeholder exists in right place
        if (!placeholder.parentElement || placeholder.parentElement !== col) {
            // remove from other places
            document.querySelectorAll(".task-placeholder").forEach(p => p.remove());
            col.appendChild(placeholder);
        }

        if (afterEl == null) {
            col.appendChild(placeholder);
        } else {
            col.insertBefore(placeholder, afterEl);
        }
    });

    col.addEventListener("dragleave", e => {
        // if leaving to outside the column (not into a child), remove hover
        const rect = col.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            col.classList.remove("drop-hover");
            // remove placeholder if moving out
            // but leave placeholder if still dragging inside other column
        }
    });

    col.addEventListener("drop", e => {
        e.preventDefault();
        if (!draggingEl) return;
        // place dragging element where placeholder is (or append)
        if (placeholder && placeholder.parentElement === col) {
            col.insertBefore(draggingEl, placeholder);
            placeholder.remove();
        } else {
            col.appendChild(draggingEl);
        }
        col.classList.remove("drop-hover");
        draggingEl.style.display = "";
        draggingEl.classList.remove("dragging");
        draggingEl = null;
        updateCounts();
    });
});

/* ===========================
   New Task button
   =========================== */
newTaskBtn.addEventListener("click", () => {
    const title = prompt("Task title:");
    if (!title || title.trim() === "") return;
    const desc = prompt("Description (optional):") || "";
    const el = createTask({ title: title.trim(), desc: desc.trim() });
    cols.todo.appendChild(el);
    updateCounts();
});

/* ===========================
   Initialize: attach listeners to existing tasks (if any) + counts
   =========================== */
function initExistingTasks() {
    // if tasks are present at load (not from template), attach handlers
    document.querySelectorAll(".task").forEach(t => {
        if (!t.hasAttribute("draggable")) {
            t.setAttribute("draggable", "true");
            t.addEventListener("dragstart", onDragStart);
            t.addEventListener("dragend", onDragEnd);
            const del = t.querySelector(".delete-btn");
            if (del) del.addEventListener("click", () => { t.remove(); updateCounts(); });
            const edit = t.querySelector(".edit-btn");
            if (edit) edit.addEventListener("click", () => {
                const newT = prompt("Edit title:", t.querySelector(".task-title").textContent);
                const newD = prompt("Edit desc:", t.querySelector(".task-content").textContent);
                if (newT != null) t.querySelector(".task-title").textContent = newT;
                if (newD != null) t.querySelector(".task-content").textContent = newD;
            });
        }
    });
    updateCounts();
}

initExistingTasks();
