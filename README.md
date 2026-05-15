# md2html Skill

Turn long Markdown or plain-text learning materials into visual-first HTML learning pages with:

- a clean title and central thesis
- density tabs for minimal and refined summaries
- a study path
- core concept cards
- optional understanding-check questions
- colorful section cards
- collapsed full text with return links back to the visual guide

## Install In Codex / Claude Code

Copy the `md2html` folder into your Codex skills directory:

```bash
mkdir -p ~/.codex/skills
cp -R md2html ~/.codex/skills/md2html
```

Restart Codex if the skill list does not refresh automatically.

Ask Codex:

```text
Use $md2html to turn this long Markdown article into an HTML learning interface.
```

## Renderer

The default renderer is JavaScript and only requires Node.js. It has no npm dependencies:

```bash
node ~/.codex/skills/md2html/scripts/render_md2html.js input.md output.html
```

Optional:

```bash
node ~/.codex/skills/md2html/scripts/render_md2html.js input.md output.html --title "Article Title" --accent "#d92d20"
```

The output is a self-contained `.html` file.

## Architecture

`md2html` is a fixed learning-interface template fed by different article content:

- `scripts/parser.js` parses Markdown into headings and full-text HTML.
- `scripts/summarize.js` turns the article structure into learning data: central thesis, cards, concept summaries, and questions.
- `scripts/template.js` renders the fixed visual HTML shell.
- `scripts/render_md2html.js` is the thin command-line entry.

That means different inputs change the content model, while the HTML learning interface remains consistent.

## Optional Browser Tool

`md2html/tool.html` is a local visual tester. Open it in a browser, paste Markdown, generate a preview, and download the result. It is useful for quick manual experiments, but the skill itself should prefer the Node.js renderer in agent workflows.

## Legacy Python Renderer

`md2html/scripts/render_md2html.py` is kept for compatibility. New usage should prefer the JavaScript renderer.
