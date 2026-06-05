import csv
import html
from pathlib import Path
from urllib.parse import quote_plus


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tasks-sheet.csv"
WORKSHEET_DIR = ROOT / "worksheets"
UPDATES = ROOT / "task-resource-updates.csv"

NO_YOUTUBE = {"housework", "admin", "side quest", "snow family work log"}
NO_WORKSHEET = {"housework", "admin", "side quest", "snow family work log", "school plan"}


def clean(value):
    return (value or "").strip()


def category(row):
    return clean(row.get("Category")).lower()


def task_id(row, index):
    return clean(row.get("ID")) or f"row-{index + 2}"


def youtube_query(row):
    cat = category(row)
    title = clean(row.get("Task Name EN"))
    desc = clean(row.get("Description EN"))

    if cat in NO_YOUTUBE or not title:
        return ""

    if cat == "ncso study":
        query = f"NCSO construction safety {title}"
    elif cat in {"fla"}:
        query = f"French lesson for kids {title} {desc[:80]}"
    elif cat in {"ela"}:
        query = f"language arts lesson for kids {title} {desc[:80]}"
    elif cat.startswith("math"):
        query = f"math lesson for kids {title} {desc[:80]}"
    elif cat.startswith("science"):
        query = f"science lesson for kids {title} {desc[:80]}"
    elif cat.startswith("social"):
        query = f"social studies lesson for kids {title} {desc[:80]}"
    elif cat == "brain activation":
        query = f"brain break activity for kids {title}"
    elif cat in {"recovery", "wellbeing", "wellness"}:
        query = f"kid friendly coping skills feelings activity {title}"
    elif cat == "sacred text study":
        query = f"comparative religion study basics {title}"
    else:
        query = f"kids learning activity {title} {desc[:80]}"

    return "https://www.youtube.com/results?search_query=" + quote_plus(query)


def worksheet_kind(row):
    cat = category(row)
    if cat in NO_WORKSHEET:
        return ""
    if not clean(row.get("Task Name EN")):
        return ""
    return cat


def prompt_blocks(row):
    cat = category(row)
    title = clean(row.get("Task Name EN"))
    desc = clean(row.get("Description EN"))

    if cat.startswith("math"):
        return [
            ("Show Your Work", "Write each step clearly. Circle the final answer."),
            ("Check", "Use a second method, estimate, or explain why the answer makes sense."),
        ]
    if cat.startswith("science"):
        return [
            ("Observe / Define", "Record the important facts, definitions, labels, or observations."),
            ("Explain", "Use a labeled drawing, chart, or short paragraph to show what you learned."),
        ]
    if cat in {"ela", "fla"}:
        return [
            ("Plan", "List key words, ideas, or sentence starters before writing."),
            ("Write", "Complete the writing task. Read it once and improve one sentence."),
        ]
    if cat.startswith("social") or cat == "sacred text study":
        return [
            ("Key Ideas", "Write the main facts, people, places, or traditions you need to remember."),
            ("Response", "Answer the task in complete thoughts and add one question you still have."),
        ]
    if cat == "ncso study":
        return [
            ("Recall", "Write the safest answer from memory before checking notes."),
            ("Jobsite Example", "Apply the idea to one real or realistic construction situation."),
        ]
    if cat in {"recovery", "wellbeing", "wellness"}:
        return [
            ("Check In", "Draw, circle, or write what feels true today. Sharing is optional."),
            ("One Safe Step", "Choose one small helpful action, person, phrase, or plan."),
        ]
    if cat == "brain activation":
        return [
            ("Do It", "Complete the activity. Mark what helped: focus, calm, energy, or connection."),
            ("Notice", "Write or draw what changed in your body, thoughts, or mood."),
        ]
    if cat in {"art", "music"}:
        return [
            ("Create", "Try the activity and make quick notes about choices you made."),
            ("Reflect", "Write or draw what you noticed, liked, or would change next time."),
        ]
    return [
        ("Work Space", desc or f"Complete: {title}"),
        ("Reflection", "What did you finish, notice, or learn?"),
    ]


def worksheet_html(row, index):
    tid = task_id(row, index)
    title = clean(row.get("Task Name EN"))
    person = clean(row.get("Responsible")) or "Unassigned"
    cat = clean(row.get("Category")) or "General"
    est = clean(row.get("Est Time"))
    desc = clean(row.get("Description EN"))
    points = clean(row.get("Points"))
    blocks = prompt_blocks(row)

    block_html = "\n".join(
        f"""
        <section class="box">
          <h2>{html.escape(label)}</h2>
          <p>{html.escape(text)}</p>
          <div class="lines"></div>
        </section>
        """
        for label, text in blocks
    )

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(tid)} | Worksheet</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    background: #f4f7fb;
    color: #1f2933;
    font-family: Arial, sans-serif;
  }}
  main {{
    width: min(8.5in, 100%);
    min-height: 11in;
    margin: 0 auto;
    padding: 0.55in;
    background: white;
  }}
  header {{
    border-bottom: 3px solid #2f80ed;
    padding-bottom: 14px;
    margin-bottom: 16px;
  }}
  h1 {{
    margin: 0 0 8px;
    font-size: 25px;
    line-height: 1.15;
  }}
  .meta {{
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    color: #52606d;
    font-size: 12px;
    font-weight: 700;
  }}
  .pill {{
    border: 1px solid #d8dee6;
    border-radius: 999px;
    padding: 4px 9px;
  }}
  .prompt {{
    font-size: 14px;
    line-height: 1.45;
    margin: 0 0 14px;
  }}
  .box {{
    border: 1.5px solid #cbd5df;
    border-radius: 8px;
    padding: 12px;
    margin: 12px 0;
    break-inside: avoid;
  }}
  h2 {{
    margin: 0 0 6px;
    font-size: 15px;
  }}
  .box p {{
    margin: 0 0 8px;
    color: #52606d;
    font-size: 12px;
    line-height: 1.35;
  }}
  .lines {{
    height: 1.45in;
    background: repeating-linear-gradient(to bottom, transparent 0, transparent 25px, #d8dee6 26px);
  }}
  footer {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 14px;
    font-size: 12px;
  }}
  .small-line {{
    border-bottom: 1.5px solid #9aa5b1;
    min-height: 24px;
  }}
  @media print {{
    body {{ background: white; }}
    main {{ width: 8.5in; min-height: 11in; margin: 0; box-shadow: none; }}
  }}
</style>
</head>
<body>
<main>
  <header>
    <h1>{html.escape(title)}</h1>
    <div class="meta">
      <span class="pill">Task ID: {html.escape(tid)}</span>
      <span class="pill">{html.escape(person)}</span>
      <span class="pill">{html.escape(cat)}</span>
      {f'<span class="pill">{html.escape(est)} min</span>' if est else ''}
      {f'<span class="pill">{html.escape(points)} pts</span>' if points else ''}
    </div>
  </header>
  <p class="prompt"><strong>Task:</strong> {html.escape(desc or title)}</p>
  {block_html}
  <footer>
    <label>Name<div class="small-line"></div></label>
    <label>Date<div class="small-line"></div></label>
  </footer>
</main>
</body>
</html>
"""


def main():
    rows = list(csv.DictReader(SOURCE.open(newline="", encoding="utf-8-sig")))
    WORKSHEET_DIR.mkdir(exist_ok=True)

    updates = []
    for index, row in enumerate(rows):
        tid = task_id(row, index)
        y_link = clean(row.get("YouTube Link")) or youtube_query(row)
        w_link = clean(row.get("Worksheet"))

        if not w_link and worksheet_kind(row):
            filename = f"{tid}.html"
            (WORKSHEET_DIR / filename).write_text(worksheet_html(row, index), encoding="utf-8")
            w_link = f"worksheets/{filename}"

        updates.append(
            {
                "rowNumber": index + 2,
                "ID": tid,
                "YouTube Link": y_link,
                "Worksheet": w_link,
            }
        )

    with UPDATES.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["rowNumber", "ID", "YouTube Link", "Worksheet"])
        writer.writeheader()
        writer.writerows(updates)

    print(f"Generated {len(list(WORKSHEET_DIR.glob('*.html')))} worksheets")
    print(f"Wrote {UPDATES.name}")


if __name__ == "__main__":
    main()
