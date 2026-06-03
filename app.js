const storageKey = "snowflake-family-dashboard";
const sheetConfig = window.SNOWFLAKE_CONFIG || {};
const POINTS_PER_TASK = 1;
const fallbackSheetTasks = [
  { rowNumber: 2, dateAdded: "2026-05-28", responsible: "Mom", topic: "Household", title: "Renew library cards", description: "Check expiration on all library cards and renew online at the library website", completedDate: "" },
  { rowNumber: 3, dateAdded: "2026-05-30", responsible: "Oliver", topic: "School", title: "Book report draft", description: "Write first draft of your book report on Charlotte's Web - at least 3 paragraphs", completedDate: "" },
  { rowNumber: 4, dateAdded: "2026-06-01", responsible: "Logan", topic: "School", title: "Spelling practice", description: "Practice all 10 spelling words out loud and in writing - test is Friday", completedDate: "" },
  { rowNumber: 5, dateAdded: "2026-06-02", responsible: "Mom", topic: "Admin", title: "Dentist appointments", description: "Book annual checkup appointments for Oliver and Logan before school ends June 27", completedDate: "" },
  { rowNumber: 6, dateAdded: "2026-06-03", responsible: "Family", topic: "Home", title: "Weekend clean-up", description: "Everyone picks one room to tidy before Sunday dinner - 20 minutes each", completedDate: "" }
];

const defaultState = {
  focus: "",
  mood: "Calm",
  water: 0,
  outside: "",
  dinner: "",
  morning: "",
  afternoon: "",
  evening: "",
  momRecovery: "",
  momLearning: "",
  momChecklist: [
    { label: "Do the 9-minute routine", done: false },
    { label: "Review kid tasks", done: false },
    { label: "Write one recovery anchor", done: false },
    { label: "Pick one tiny learning adventure", done: false }
  ],
  checklist: [
    { label: "Make beds", done: false },
    { label: "Pack bags", done: false },
    { label: "Read for 20 minutes", done: false },
    { label: "Move bodies", done: false },
    { label: "Clear one surface", done: false }
  ],
  oliver: [
    { id: "oliver-reading-log", title: "Reading log", subject: "Language Arts", due: "2026-06-05", done: false },
    { id: "oliver-math-practice", title: "Math practice", subject: "Math", due: "2026-06-06", done: false },
    { id: "oliver-movement-cross-body", title: "Movement & Cross-Body", subject: "Brain Activation", due: "", done: false },
    { id: "oliver-breathing-calm", title: "Breathing & Calm", subject: "Brain Activation", due: "", done: false },
    { id: "oliver-music-rhythm", title: "Music & Rhythm", subject: "Brain Activation", due: "", done: false },
    { id: "oliver-creative-expression", title: "Creative Expression", subject: "Brain Activation", due: "", done: false },
    { id: "oliver-logic-problem-solving", title: "Logic & Problem Solving", subject: "Brain Activation", due: "", done: false },
    { id: "oliver-mindfulness-grounding", title: "Mindfulness & Grounding", subject: "Brain Activation", due: "", done: false },
    { id: "oliver-connection-play", title: "Connection & Play", subject: "Brain Activation", due: "", done: false },
    { id: "oliver-addiction-workbook-start-here", title: "Start Here: What You Might Be Feeling Right Now", subject: "Addiction Workbook", due: "", done: false },
    { id: "oliver-addiction-workbook-what-is-addiction", title: "Session 1: What Is Addiction?", subject: "Addiction Workbook", due: "", done: false },
    { id: "oliver-addiction-workbook-three-cs", title: "Session 2: The Three Cs", subject: "Addiction Workbook", due: "", done: false },
    { id: "oliver-addiction-workbook-how-it-affects-you", title: "Session 3: How It Affects You", subject: "Addiction Workbook", due: "", done: false },
    { id: "oliver-addiction-workbook-keeping-safe", title: "Session 4: Keeping Yourself Safe", subject: "Addiction Workbook", due: "", done: false },
    { id: "oliver-addiction-workbook-talking-about-it", title: "Session 5: Talking About It", subject: "Addiction Workbook", due: "", done: false },
    { id: "oliver-addiction-workbook-your-future", title: "Session 6: Your Future Belongs to You", subject: "Addiction Workbook", due: "", done: false },
    { id: "oliver-addiction-workbook-resource-guide", title: "Full Resource Guide", subject: "Addiction Workbook", due: "", done: false }
  ],
  logan: [
    { id: "logan-spelling-words", title: "Spelling words", subject: "Language Arts", due: "2026-06-05", done: false },
    { id: "logan-science-drawing", title: "Science drawing", subject: "Science", due: "2026-06-07", done: false },
    { id: "logan-movement-cross-body", title: "Movement & Cross-Body", subject: "Brain Activation", due: "", done: false },
    { id: "logan-breathing-calm", title: "Breathing & Calm", subject: "Brain Activation", due: "", done: false },
    { id: "logan-music-rhythm", title: "Music & Rhythm", subject: "Brain Activation", due: "", done: false },
    { id: "logan-creative-expression", title: "Creative Expression", subject: "Brain Activation", due: "", done: false },
    { id: "logan-logic-problem-solving", title: "Logic & Problem Solving", subject: "Brain Activation", due: "", done: false },
    { id: "logan-mindfulness-grounding", title: "Mindfulness & Grounding", subject: "Brain Activation", due: "", done: false },
    { id: "logan-connection-play", title: "Connection & Play", subject: "Brain Activation", due: "", done: false },
    { id: "logan-addiction-workbook-start-here", title: "Start Here: What You Might Be Feeling Right Now", subject: "Addiction Workbook", due: "", done: false },
    { id: "logan-addiction-workbook-what-is-addiction", title: "Session 1: What Is Addiction?", subject: "Addiction Workbook", due: "", done: false },
    { id: "logan-addiction-workbook-three-cs", title: "Session 2: The Three Cs", subject: "Addiction Workbook", due: "", done: false },
    { id: "logan-addiction-workbook-how-it-affects-you", title: "Session 3: How It Affects You", subject: "Addiction Workbook", due: "", done: false },
    { id: "logan-addiction-workbook-keeping-safe", title: "Session 4: Keeping Yourself Safe", subject: "Addiction Workbook", due: "", done: false },
    { id: "logan-addiction-workbook-talking-about-it", title: "Session 5: Talking About It", subject: "Addiction Workbook", due: "", done: false },
    { id: "logan-addiction-workbook-your-future", title: "Session 6: Your Future Belongs to You", subject: "Addiction Workbook", due: "", done: false },
    { id: "logan-addiction-workbook-resource-guide", title: "Full Resource Guide", subject: "Addiction Workbook", due: "", done: false }
  ],
  sheetCompletions: {},
  photos: []
};

const quotes = [
  ["Start where you are. Use what you have. Do what you can.", "Arthur Ashe"],
  ["The secret of getting ahead is getting started.", "Mark Twain"],
  ["You do not have to see the whole staircase, just take the first step.", "Martin Luther King Jr."],
  ["A good day is built in small, brave choices.", "Snowflake"],
  ["What we practice grows stronger.", "Shauna Shapiro"],
  ["Little by little, a little becomes a lot.", "Tanzanian proverb"]
];

let state = loadState();

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return normalizeState(structuredClone(defaultState));

  try {
    const restored = { ...structuredClone(defaultState), ...JSON.parse(saved) };
    return normalizeState(restored);
  } catch {
    return normalizeState(structuredClone(defaultState));
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function normalizeState(nextState) {
  let changed = false;

  if (!Array.isArray(nextState.momChecklist)) {
    nextState.momChecklist = structuredClone(defaultState.momChecklist);
    changed = true;
  }

  if (!nextState.sheetCompletions || typeof nextState.sheetCompletions !== "object") {
    nextState.sheetCompletions = {};
    changed = true;
  }

  ["oliver", "logan"].forEach((name) => {
    const seededIds = new Set(nextState[name].map((item) => item.id).filter(Boolean));
    defaultState[name].forEach((item) => {
      if (seededIds.has(item.id)) return;
      nextState[name].push(structuredClone(item));
      changed = true;
    });

    nextState[name] = nextState[name].map((item) => {
      if (item.id) return item;
      changed = true;
      return { ...item, id: createTaskId(name, item.title) };
    });
  });

  if (changed) {
    localStorage.setItem(storageKey, JSON.stringify(nextState));
  }

  return nextState;
}

function createTaskId(name, title) {
  const slug = String(title || "task")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "task";

  return `${name}-${slug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function setDateLabel() {
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
  document.getElementById("today-label").textContent = formatter.format(new Date());
}

function bindDashboard() {
  const fields = {
    focus: document.getElementById("focus-note"),
    mood: document.getElementById("mood-select"),
    outside: document.getElementById("outside-plan"),
    dinner: document.getElementById("dinner-plan"),
    morning: document.getElementById("morning-plan"),
    afternoon: document.getElementById("afternoon-plan"),
    evening: document.getElementById("evening-plan")
  };

  Object.entries(fields).forEach(([key, input]) => {
    input.value = state[key];
    input.addEventListener("input", () => {
      state[key] = input.value;
      saveState();
      updateFocusStatus();
    });
  });

  document.querySelectorAll("[data-step='water']").forEach((button) => {
    button.addEventListener("click", () => {
      const delta = Number(button.dataset.delta);
      state.water = Math.max(0, Math.min(12, state.water + delta));
      saveState();
      renderWater();
    });
  });

  document.getElementById("reset-day").addEventListener("click", () => {
    state = { ...state, ...structuredClone(defaultState), oliver: state.oliver, logan: state.logan, photos: state.photos };
    saveState();
    window.location.reload();
  });

  renderWater();
  renderChecklist();
  updateFocusStatus();
}

function updateFocusStatus() {
  const status = document.getElementById("focus-status");
  status.textContent = state.focus.trim() ? "Set" : "Ready";
}

function renderWater() {
  document.getElementById("water-count").textContent = state.water;
}

function renderChecklist() {
  const checklist = document.getElementById("daily-checklist");
  checklist.innerHTML = "";

  state.checklist.forEach((item, index) => {
    const label = document.createElement("label");
    label.className = "check-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.done;
    checkbox.addEventListener("change", () => {
      state.checklist[index].done = checkbox.checked;
      saveState();
      renderChecklist();
    });

    const text = document.createElement("span");
    text.textContent = item.label;
    text.className = item.done ? "done" : "";

    label.append(checkbox, text);
    checklist.append(label);
  });

  const done = state.checklist.filter((item) => item.done).length;
  document.getElementById("checklist-count").textContent = `${done}/${state.checklist.length}`;
}

function bindQuotes() {
  document.getElementById("new-quote").addEventListener("click", renderQuote);
  renderQuote();
}

function renderQuote() {
  const daySeed = Math.floor(Date.now() / 86400000);
  const quote = quotes[(daySeed + Math.floor(Math.random() * quotes.length)) % quotes.length];
  document.getElementById("quote-text").textContent = quote[0];
  document.getElementById("quote-author").textContent = `- ${quote[1]}`;
}

function bindWork(name) {
  const form = document.querySelector(`[data-work-form="${name}"]`);
  const addButton = document.querySelector(`[data-add-work="${name}"]`);

  addButton.addEventListener("click", () => {
    form.classList.toggle("open");
    if (form.classList.contains("open")) {
      form.querySelector("input[name='title']").focus();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    state[name].push({
      id: createTaskId(name, data.get("title")),
      title: data.get("title").trim(),
      subject: data.get("subject").trim() || "General",
      due: data.get("due"),
      done: false
    });
    form.reset();
    form.classList.remove("open");
    saveState();
    renderWork(name);
  });

  renderWork(name);
}

function renderWork(name) {
  const target = document.getElementById(`${name}-work`);
  target.innerHTML = "";

  if (!state[name].length) {
    target.append(emptyState("No work added yet."));
    if (document.getElementById("outstanding-tasks")) renderOutstandingTasks();
    return;
  }

  state[name].forEach((item, index) => {
    const card = document.createElement("article");
    card.className = `work-card${item.done ? " done" : ""}`;
    card.tabIndex = 0;
    card.role = "link";
    card.ariaLabel = `Open ${item.title} details`;
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input")) return;
      window.location.href = getTaskUrl(name, item.id);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      window.location.href = getTaskUrl(name, item.id);
    });

    const badge = document.createElement("span");
    badge.className = "work-badge";
    badge.textContent = item.done ? "Done" : "Open";

    const title = document.createElement("h3");
    title.textContent = item.title;

    const details = document.createElement("p");
    details.textContent = `${item.subject || "General"}${item.due ? ` - due ${formatDate(item.due)}` : ""}`;

    const openHint = document.createElement("span");
    openHint.className = "open-hint";
    openHint.textContent = "Open details";

    const actions = document.createElement("div");
    actions.className = "work-actions";

    const doneButton = document.createElement("button");
    doneButton.className = "small-button";
    doneButton.type = "button";
    doneButton.textContent = item.done ? "Reopen" : "Done";
    doneButton.addEventListener("click", () => {
      state[name][index].done = !state[name][index].done;
      saveState();
      renderWork(name);
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "small-button danger-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      state[name].splice(index, 1);
      saveState();
      renderWork(name);
    });

    actions.append(doneButton, deleteButton);
    card.append(badge, title, details, openHint, actions);
    target.append(card);
  });

  if (document.getElementById("outstanding-tasks")) renderOutstandingTasks();
}

function bindMomSection() {
  const recoveryNote = document.getElementById("recovery-note");
  const learningNote = document.getElementById("learning-note");

  recoveryNote.value = state.momRecovery || "";
  learningNote.value = state.momLearning || "";

  recoveryNote.addEventListener("input", () => {
    state.momRecovery = recoveryNote.value;
    saveState();
  });

  learningNote.addEventListener("input", () => {
    state.momLearning = learningNote.value;
    saveState();
  });

  renderMomChecklist();
  renderOutstandingTasks();
}

function renderMomChecklist() {
  const checklist = document.getElementById("mom-checklist");
  checklist.innerHTML = "";

  state.momChecklist.forEach((item, index) => {
    const label = document.createElement("label");
    label.className = "check-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.done;
    checkbox.addEventListener("change", () => {
      state.momChecklist[index].done = checkbox.checked;
      saveState();
      renderMomChecklist();
    });

    const text = document.createElement("span");
    text.textContent = item.label;
    text.className = item.done ? "done" : "";

    label.append(checkbox, text);
    checklist.append(label);
  });

  const done = state.momChecklist.filter((item) => item.done).length;
  document.getElementById("mom-count").textContent = `${done}/${state.momChecklist.length}`;
}

function renderOutstandingTasks() {
  const target = document.getElementById("outstanding-tasks");
  target.innerHTML = "";

  const tasks = ["oliver", "logan"].flatMap((name) =>
    state[name]
      .filter((item) => !item.done)
      .map((item) => ({ ...item, name, displayName: name === "oliver" ? "Oliver" : "Logan" }))
  );

  if (!tasks.length) {
    target.append(emptyState("No outstanding kid tasks right now."));
    return;
  }

  tasks.forEach((item) => {
    const link = document.createElement("a");
    link.className = "outstanding-task";
    link.href = getTaskUrl(item.name, item.id);

    const owner = document.createElement("span");
    owner.textContent = item.displayName;

    const title = document.createElement("strong");
    title.textContent = item.title;

    const details = document.createElement("small");
    details.textContent = `${item.subject || "General"}${item.due ? ` - due ${formatDate(item.due)}` : ""}`;

    link.append(owner, title, details);
    target.append(link);
  });
}

function getTaskUrl(name, id) {
  return `task.html?person=${encodeURIComponent(name)}&id=${encodeURIComponent(id)}`;
}

function bindTaskDetail() {
  const target = document.getElementById("task-detail");
  if (!target) return;

  const params = new URLSearchParams(window.location.search);
  const name = params.get("person");
  const id = params.get("id");
  const people = {
    oliver: "Oliver",
    logan: "Logan"
  };

  if (!people[name]) {
    renderMissingTask(target);
    return;
  }

  const item = state[name].find((task) => task.id === id);

  if (!item) {
    renderMissingTask(target, name);
    return;
  }

  renderTaskDetail(target, name, people[name], item);
}

function renderTaskDetail(target, name, displayName, item) {
  document.title = `${item.title} | Snowflake`;
  document.getElementById("task-owner").textContent = `${displayName}'s Work`;
  document.getElementById("task-title").textContent = item.title;
  document.getElementById("back-to-work").href = `index.html#${name}`;

  target.innerHTML = "";

  const summary = document.createElement("article");
  summary.className = "task-summary";

  const status = document.createElement("span");
  status.className = "work-badge";
  status.textContent = item.done ? "Done" : "Open";

  const subject = document.createElement("p");
  subject.append(createStrongLabel("Subject:"), ` ${item.subject || "General"}`);

  const due = document.createElement("p");
  due.append(createStrongLabel("Due:"), ` ${item.due ? formatLongDate(item.due) : "No due date set"}`);

  const explanation = document.createElement("p");
  explanation.className = "task-explanation";
  explanation.textContent = getTaskExplanation(item);

  const completeButton = document.createElement("button");
  completeButton.className = item.done ? "secondary-button" : "primary-button";
  completeButton.type = "button";
  completeButton.textContent = item.done ? "Mark Open" : "Mark Completed";
  completeButton.addEventListener("click", () => {
    item.done = !item.done;
    saveState();
    renderTaskDetail(target, name, displayName, item);
  });

  summary.append(status, subject, due, explanation, completeButton);
  target.append(summary);
}

function renderMissingTask(target, name) {
  const backTarget = name === "logan" ? "logan" : "oliver";
  document.getElementById("task-owner").textContent = "Task";
  document.getElementById("task-title").textContent = "Task Not Found";
  document.getElementById("back-to-work").href = `index.html#${backTarget}`;
  target.innerHTML = "";
  target.append(emptyState("This task is no longer available. It may have been deleted."));
}

function createStrongLabel(text) {
  const label = document.createElement("strong");
  label.textContent = text;
  return label;
}

function getTaskExplanation(item) {
  const subject = item.subject || "General";
  const dueText = item.due ? ` before ${formatLongDate(item.due)}` : "";
  return `This ${subject} task is ready to work on${dueText}. Read what needs to be done, gather any supplies, finish the assignment, then mark it completed here.`;
}

function getSheetEndpoint() {
  return String(sheetConfig.appsScriptUrl || "").trim();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

async function loadSheetPayload() {
  const endpoint = getSheetEndpoint();

  if (!endpoint) {
    return getFallbackSheetPayload();
  }

  const response = await fetch(`${endpoint}?t=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Sheet endpoint returned ${response.status}.`);
  }

  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(payload.error || "Sheet endpoint returned an error.");
  }

  return payload;
}

function getFallbackSheetPayload() {
  const tasks = fallbackSheetTasks.map((task) => {
    const completedDate = state.sheetCompletions[task.rowNumber] || task.completedDate || "";
    return { ...task, completedDate };
  });

  return {
    ok: true,
    offline: true,
    tasks,
    points: buildPoints(tasks),
    pointValue: POINTS_PER_TASK,
    updatedAt: new Date().toISOString()
  };
}

function buildPoints(tasks) {
  return tasks.reduce((points, task) => {
    if (!task.completedDate) return points;
    points[task.responsible] = (points[task.responsible] || 0) + POINTS_PER_TASK;
    return points;
  }, {});
}

function firstOpenTaskByPersonAndTopic(tasks) {
  const grouped = new Map();

  tasks
    .filter((task) => !task.completedDate)
    .forEach((task) => {
      const person = task.responsible || "Unassigned";
      const topic = task.topic || "General";
      const key = `${person}\u0000${topic}`;

      if (!grouped.has(key)) {
        grouped.set(key, { person, topic, task });
      }
    });

  return [...grouped.values()];
}

async function bindSheetTaskBoard() {
  const board = document.getElementById("sheet-task-board");
  const status = document.getElementById("sheet-status");
  if (!board) return;

  try {
    const payload = await loadSheetPayload();
    renderSheetTaskBoard(board, status, payload);
  } catch (error) {
    status.textContent = `Could not load the Google Sheet yet: ${error.message}`;
    board.innerHTML = "";
    board.append(emptyState("Check the Apps Script deployment URL in snowflake-config.js."));
  }
}

function renderSheetTaskBoard(board, status, payload) {
  const firstTasks = firstOpenTaskByPersonAndTopic(payload.tasks || []);
  board.innerHTML = "";

  status.textContent = payload.offline
    ? "Using sample sheet rows until the Apps Script URL is added."
    : `Live from Google Sheet. ${payload.tasks.length} total tasks.`;

  if (!firstTasks.length) {
    board.append(emptyState("All sheet tasks are complete."));
    return;
  }

  firstTasks.forEach(({ person, topic, task }) => {
    const card = document.createElement("article");
    card.className = "sheet-task-card";

    const meta = document.createElement("span");
    meta.className = "sheet-task-meta";
    meta.textContent = `${person} / ${topic}`;

    const title = document.createElement("h3");
    title.textContent = task.title;

    const description = document.createElement("p");
    description.textContent = task.description || "No description added.";

    const label = document.createElement("label");
    label.className = "task-complete-toggle";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", () => completeSheetTask(task, card, status));

    const text = document.createElement("span");
    text.textContent = `Complete for ${POINTS_PER_TASK} point`;

    label.append(checkbox, text);
    card.append(meta, title, description, label);
    board.append(card);
  });
}

async function completeSheetTask(task, card, status) {
  const completedDate = todayIsoDate();
  card.classList.add("saving");
  status.textContent = `Marking "${task.title}" complete...`;

  try {
    const endpoint = getSheetEndpoint();

    if (endpoint) {
      const response = await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ rowNumber: task.rowNumber, completedDate })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Sheet endpoint returned ${response.status}.`);
      }
    } else {
      state.sheetCompletions[task.rowNumber] = completedDate;
      saveState();
    }

    await bindSheetTaskBoard();
    await bindHousePoints();
  } catch (error) {
    card.classList.remove("saving");
    const checkbox = card.querySelector("input[type='checkbox']");
    if (checkbox) checkbox.checked = false;
    status.textContent = `Could not mark complete: ${error.message}`;
  }
}

async function bindHousePoints() {
  const target = document.getElementById("house-points");
  const status = document.getElementById("house-points-status");
  const count = document.getElementById("sheet-task-count");
  if (!target) return;

  try {
    const payload = await loadSheetPayload();
    renderHousePoints(target, status, payload);
    if (count) {
      const openCount = (payload.tasks || []).filter((task) => !task.completedDate).length;
      count.textContent = `${openCount} Open`;
    }
  } catch (error) {
    status.textContent = "Offline";
    target.innerHTML = "";
    target.append(emptyState("House points will load after the sheet endpoint is configured."));
  }
}

function renderHousePoints(target, status, payload) {
  const points = payload.points || buildPoints(payload.tasks || []);
  const people = [...new Set((payload.tasks || []).map((task) => task.responsible || "Unassigned"))];
  const maxPoints = Math.max(1, ...people.map((person) => points[person] || 0));

  target.innerHTML = "";
  status.textContent = payload.offline ? "Preview" : "Live";

  if (!people.length) {
    target.append(emptyState("No people found in the sheet."));
    return;
  }

  people.forEach((person) => {
    const total = points[person] || 0;
    const row = document.createElement("div");
    row.className = "house-point-row";

    const label = document.createElement("span");
    label.className = "house-point-name";
    label.textContent = person;

    const track = document.createElement("div");
    track.className = "house-point-track";

    const fill = document.createElement("div");
    fill.className = "house-point-fill";
    fill.style.width = `${Math.max(8, (total / maxPoints) * 100)}%`;

    const value = document.createElement("strong");
    value.textContent = total;

    track.append(fill);
    row.append(label, track, value);
    target.append(row);
  });
}

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function formatLongDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(date);
}

function bindPhotos() {
  document.getElementById("photo-input").addEventListener("change", (event) => {
    const files = [...event.target.files].slice(0, 8);

    files.forEach((file) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        state.photos.unshift({
          src: reader.result,
          caption: file.name.replace(/\.[^.]+$/, "")
        });
        state.photos = state.photos.slice(0, 24);
        saveState();
        renderPhotos();
      });
      reader.readAsDataURL(file);
    });

    event.target.value = "";
  });

  renderPhotos();
}

function renderPhotos() {
  const target = document.getElementById("photo-book");
  target.innerHTML = "";

  if (!state.photos.length) {
    target.append(emptyState("Add photos to start the family photo book."));
    return;
  }

  state.photos.forEach((photo, index) => {
    const card = document.createElement("article");
    card.className = "photo-card";

    const image = document.createElement("img");
    image.src = photo.src;
    image.alt = photo.caption || "Family photo";

    const caption = document.createElement("input");
    caption.className = "caption";
    caption.value = photo.caption;
    caption.ariaLabel = "Photo caption";
    caption.addEventListener("input", () => {
      state.photos[index].caption = caption.value;
      saveState();
    });

    card.append(image, caption);
    target.append(card);
  });
}

function emptyState(message) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = message;
  return empty;
}

function bindNavigation() {
  const links = [...document.querySelectorAll(".nav-list a[href^='#']")];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`);
      });
    });
  }, { rootMargin: "-35% 0px -55% 0px" });

  sections.forEach((section) => observer.observe(section));
}

if (document.getElementById("today-label")) setDateLabel();
if (document.getElementById("focus-note")) bindDashboard();
if (document.getElementById("mom-checklist")) bindMomSection();
if (document.getElementById("new-quote")) bindQuotes();
if (document.querySelector("[data-work-form='oliver']")) bindWork("oliver");
if (document.querySelector("[data-work-form='logan']")) bindWork("logan");
if (document.getElementById("photo-input")) bindPhotos();
if (document.getElementById("sheet-task-board")) bindSheetTaskBoard();
if (document.getElementById("house-points")) bindHousePoints();
bindTaskDetail();
bindNavigation();
