---
name: md2html
description: Use when the user wants to turn a long Markdown article, learning note, draft, essay, report, transcript, or plain-text document into a human-friendly HTML learning interface with a central thesis, density tabs, concept cards, study path, self-test questions, summaries, navigation, and responsive layout. Trigger for requests like "make this long doc easier to learn", "convert this article to a learning HTML", "HTML is better for humans than long Markdown", "make a concept map", "make this into study cards", "present this copy as an HTML page", or "create a readable web version of this long text".
metadata:
  short-description: Turn Markdown into a learning UI
---

# md2html

Transform Markdown from a linear source document into a visual HTML learning interface for humans, not a mechanical Markdown export.

## Core Intent

The output should help a real reader:

- Understand the article's shape quickly.
- Navigate long sections without getting lost.
- Grasp the argument through a central thesis, density tabs, concept cards, study path, self-test questions, and summaries before reading full prose.
- Treat Markdown as the durable source and HTML as the human learning surface.
- Read comfortably on desktop and mobile.

Default to a single self-contained `.html` file with visual-first study sections and a collapsed full-text archive unless the user asks for assets or a full app.

## Workflow

1. Read the source article or accept pasted text.
2. Identify the title, subtitle, section hierarchy, repeated motifs, and 3-7 key ideas.
3. If the source is Markdown or plain text, render it with `scripts/render_md2html.py`.
4. Improve the generated HTML when needed:
   - Add a useful visual summary if the article lacks one.
   - Add a learning path: skim map, learn concepts, self-test, then verify in the original text.
   - Extract core concepts and make them easier to review.
   - Add self-test questions that point back to the source meaning.
   - Split very long sections with subheads.
   - Promote memorable lines into cards, nodes, or pull quotes.
   - Collapse or de-emphasize full paragraphs when the user wants scanning over reading.
   - Preserve the author's meaning and order.
5. Verify the result:
   - Open the HTML locally when browser tools are available.
   - Check desktop and mobile widths.
   - Ensure text does not overlap and navigation works.

## Rendering

Use the bundled script for the first pass:

```bash
python3 scripts/render_md2html.py input.md output.html
```

Optional flags:

```bash
python3 scripts/render_md2html.py input.md output.html --title "Readable Title" --accent "#2563eb"
```

The script is intentionally dependency-free and creates a complete HTML document with embedded CSS and JavaScript. It automatically builds a central thesis, density tabs, concept cards, a learning path, self-test questions, and a collapsed full-text section.

## Design Rules

- Favor learning, comprehension, and scannability over article-like elegance.
- Make the default experience visual: colorful nodes, section cards, short bullets, and a clear central thesis.
- Make the learning flow explicit: overview first, concepts second, self-test third, source verification last.
- Summaries should capture thesis, causality, contrast, and action implications. Prefer sentences with signals like "not X but Y", "because", "therefore", "the key is", "the real value is", and avoid merely taking the first paragraphs.
- Use density tabs when a document is long: an ultra-minimal tab for one key point per section, and a refined tab for several bullets plus a quote or implication.
- Use multiple purposeful colors so the page does not feel like one long text column.
- Keep the complete original text available but secondary, usually collapsed.
- When visual cards link to full-text details, provide an obvious way back to the visual map.
- Put table of contents and reading progress in the interface for long documents.
- Use semantic HTML: `article`, `section`, `nav`, headings, lists, blockquotes, code blocks.
- Do not invent facts or add claims not present in the source.
- Keep any generated summaries clearly derived from the article.
- For operational/business reports, use denser layouts and clearer scannability.
- For essays, use a calmer reading layout with fewer interface elements.

## When To Customize

Customize after generation when:

- The article has no useful headings.
- Sections exceed about 800 words.
- The source contains repeated "AI-ish" structure that would feel monotonous in HTML.
- The user needs a branded page, public article page, or shareable artifact.

For branded pages, match the brand voice and visual identity the user provides. If none is provided, keep the page neutral and editorial.

## Deliverable

Return the path to the generated HTML and briefly describe what changed. If you created or edited files, keep the explanation short and mention verification performed.
