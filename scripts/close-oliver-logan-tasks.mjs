import fs from "fs";

// Marks every open Oliver/Logan task done, except Wellness and Side Quest topics
// (those stay open on purpose — they're not meant to be bulk-closed).

const TASKS_FILE = "tasks_kids.json";
const EXCLUDED_TOPICS = new Set(["Wellness", "Side Quest"]);
const TODAY = new Date().toISOString().slice(0, 10);

const tasks = JSON.parse(fs.readFileSync(TASKS_FILE, "utf8"));

let closed = 0;
for (const t of tasks) {
  if (t.person !== "Oliver" && t.person !== "Logan") continue;
  if (EXCLUDED_TOPICS.has(t.topic)) continue;
  if (t.isDone) continue;

  t.isDone = true;
  t.completedDate = TODAY;
  closed++;
}

fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
console.log(`Closed ${closed} task(s) in ${TASKS_FILE}`);
