# humanview Skill

Turn local Markdown, notes, reports, collected copy, or long plain-text materials into visual-first HTML views for humans, with:

- a clean title and central thesis
- density tabs for minimal and refined summaries
- a study path
- core concept cards
- optional understanding-check questions
- colorful section cards
- collapsed full text with return links back to the visual guide

## Install In Codex / Claude Code

Copy the `humanview` folder into your Codex skills directory:

```bash
mkdir -p ~/.codex/skills
cp -R humanview ~/.codex/skills/humanview
```

Restart Codex if the skill list does not refresh automatically.

Ask Codex:

```text
Use $humanview to turn this long article into a human-friendly HTML view.
```

## Renderer

The default renderer is JavaScript and only requires Node.js. It has no npm dependencies:

```bash
node ~/.codex/skills/humanview/scripts/render_humanview.js input.md output.html
```

Optional:

```bash
node ~/.codex/skills/humanview/scripts/render_humanview.js input.md output.html --title "Article Title" --accent "#d92d20"
```

The output is a self-contained `.html` file.

## Architecture

`humanview` is a fixed human-view template fed by different content:

- `scripts/parser.js` parses Markdown into headings and full-text HTML.
- `scripts/summarize.js` turns the article structure into learning data: central thesis, cards, concept summaries, and questions.
- `scripts/template.js` renders the fixed visual HTML shell.
- `scripts/render_humanview.js` is the thin command-line entry.

That means different inputs change the content model, while the HTML viewing interface remains consistent.

## Optional Browser Tool

`humanview/tool.html` is a local visual tester. Open it in a browser, paste Markdown, generate a preview, and download the result. It is useful for quick manual experiments, but the skill itself should prefer the Node.js renderer in agent workflows.

## Legacy Python Renderer

`humanview/scripts/render_humanview.py` is kept for compatibility. New usage should prefer the JavaScript renderer.
