const storageKey = "snowflake-family-dashboard";

const defaultState = {
  focus: "",
  mood: "Calm",
  water: 0,
  outside: "",
  dinner: "",
  morning: "",
  afternoon: "",
  evening: "",
  checklist: [
    { label: "Make beds", done: false },
    { label: "Pack bags", done: false },
    { label: "Read for 20 minutes", done: false },
    { label: "Move bodies", done: false },
    { label: "Clear one surface", done: false }
  ],
  oliver: [
    { title: "Reading log", subject: "Language Arts", due: "2026-06-05", done: false },
    { title: "Math practice", subject: "Math", due: "2026-06-06", done: false }
  ],
  logan: [
    { title: "Spelling words", subject: "Language Arts", due: "2026-06-05", done: false },
    { title: "Science drawing", subject: "Science", due: "2026-06-07", done: false }
  ],
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
  if (!saved) return structuredClone(defaultState);

  try {
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
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
    return;
  }

  state[name].forEach((item, index) => {
    const card = document.createElement("article");
    card.className = `work-card${item.done ? " done" : ""}`;

    const badge = document.createElement("span");
    badge.className = "work-badge";
    badge.textContent = item.done ? "Done" : "Open";

    const title = document.createElement("h3");
    title.textContent = item.title;

    const details = document.createElement("p");
    details.textContent = `${item.subject || "General"}${item.due ? ` - due ${formatDate(item.due)}` : ""}`;

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
    card.append(badge, title, details, actions);
    target.append(card);
  });
}

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
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
  const links = [...document.querySelectorAll(".nav-list a")];
  const sections = links.map((link) => document.querySelector(link.getAttribute("href")));

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

setDateLabel();
bindDashboard();
bindQuotes();
bindWork("oliver");
bindWork("logan");
bindPhotos();
bindNavigation();
