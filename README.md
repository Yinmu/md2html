# Longform HTML Skill

Turn long Markdown or plain-text articles into visual-first HTML pages with:

- a clean title and central thesis
- density tabs for minimal and refined summaries
- colorful section cards
- collapsed full text with return links back to the visual guide

## Install

Copy the `longform-html` folder into your Codex skills directory:

```bash
mkdir -p ~/.codex/skills
cp -R longform-html ~/.codex/skills/longform-html
```

Restart Codex if the skill list does not refresh automatically.

## Use

Ask Codex:

```text
Use $longform-html to turn this long Markdown article into a visual HTML page.
```

Or run the bundled renderer directly:

```bash
python3 ~/.codex/skills/longform-html/scripts/render_longform_html.py input.md output.html
```

Optional:

```bash
python3 ~/.codex/skills/longform-html/scripts/render_longform_html.py input.md output.html --title "Article Title" --accent "#d92d20"
```

The output is a self-contained `.html` file.
