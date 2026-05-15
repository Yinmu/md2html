# md2html Skill

Turn long Markdown or plain-text learning materials into visual-first HTML learning pages with:

- a clean title and central thesis
- density tabs for minimal and refined summaries
- a study path
- core concept cards
- optional understanding-check questions
- colorful section cards
- collapsed full text with return links back to the visual guide

## Simplest Use

For friends who do not use Codex or do not have Python installed:

1. Download this repository as a ZIP.
2. Open `md2html/tool.html` in a browser.
3. Paste a Markdown article.
4. Click **生成预览**.
5. Download the generated `.html` learning page.

This browser tool is a single local HTML file. It does not need Python, pip, npm, a server, or an internet connection.

## Use Inside Codex

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

## Optional Command Line

The command-line renderer is useful for automation. It requires Python 3, but uses only the standard library and has no pip dependencies:

```bash
python3 ~/.codex/skills/md2html/scripts/render_md2html.py input.md output.html
```

Optional:

```bash
python3 ~/.codex/skills/md2html/scripts/render_md2html.py input.md output.html --title "Article Title" --accent "#d92d20"
```

The output is a self-contained `.html` file.
