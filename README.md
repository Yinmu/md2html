# md2html Skill

Turn long Markdown or plain-text learning materials into visual-first HTML learning pages with:

- a clean title and central thesis
- density tabs for minimal and refined summaries
- a study path
- core concept cards
- optional understanding-check questions
- colorful section cards
- collapsed full text with return links back to the visual guide

## Install

Copy the `md2html` folder into your Codex skills directory:

```bash
mkdir -p ~/.codex/skills
cp -R md2html ~/.codex/skills/md2html
```

Restart Codex if the skill list does not refresh automatically.

## Use

Ask Codex:

```text
Use $md2html to turn this long Markdown article into an HTML learning interface.
```

Or run the bundled renderer directly:

```bash
python3 ~/.codex/skills/md2html/scripts/render_md2html.py input.md output.html
```

Optional:

```bash
python3 ~/.codex/skills/md2html/scripts/render_md2html.py input.md output.html --title "Article Title" --accent "#d92d20"
```

The output is a self-contained `.html` file.
