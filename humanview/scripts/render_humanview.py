#!/usr/bin/env python3
"""Render Markdown or plain text into a self-contained HTML learning interface."""

from __future__ import annotations

import argparse
import html
import re
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Heading:
    level: int
    text: str
    slug: str


@dataclass
class VisualSection:
    title: str
    slug: str
    bullets: list[str]
    quote: str
    index: int


SUMMARY_KEYWORDS = (
    "不是",
    "而是",
    "因为",
    "所以",
    "关键",
    "真正",
    "价值",
    "机会",
    "门槛",
    "证明",
    "作品",
    "判断",
    "能力",
    "成本",
    "验证",
    "普通人",
    "未来",
    "本质",
    "核心",
    "名片",
    "做出来",
    "看见",
    "使用",
    "最",
    "才是",
    "不需要",
    "应该",
)


def slugify(text: str, used: set[str]) -> str:
    slug = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff]+", "-", text.strip().lower()).strip("-")
    slug = slug or "section"
    base = slug
    i = 2
    while slug in used:
        slug = f"{base}-{i}"
        i += 1
    used.add(slug)
    return slug


def inline_md(text: str) -> str:
    placeholders: list[str] = []

    def stash(match: re.Match[str]) -> str:
        placeholders.append(f"<code>{html.escape(match.group(1))}</code>")
        return f"\u0000{len(placeholders) - 1}\u0000"

    text = re.sub(r"`([^`]+)`", stash, text)
    text = html.escape(text)
    text = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", r'<a href="\2">\1</a>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", text)

    for i, value in enumerate(placeholders):
        text = text.replace(f"\u0000{i}\u0000", value)
    return text


def split_blocks(text: str) -> list[str]:
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return []

    blocks: list[str] = []
    current: list[str] = []
    in_code = False

    for line in text.split("\n"):
        if line.strip().startswith("```"):
            if current and not in_code:
                blocks.append("\n".join(current).strip())
                current = []
            current.append(line)
            if in_code:
                blocks.append("\n".join(current).strip())
                current = []
            in_code = not in_code
            continue

        if in_code:
            current.append(line)
            continue

        if not line.strip():
            if current:
                blocks.append("\n".join(current).strip())
                current = []
            continue

        current.append(line)

    if current:
        blocks.append("\n".join(current).strip())
    return blocks


def render_table(block: str) -> str | None:
    lines = [line.strip() for line in block.split("\n") if line.strip()]
    if len(lines) < 2 or "|" not in lines[0]:
        return None
    if not re.match(r"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$", lines[1]):
        return None

    rows = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        rows.append(cells)

    header = "".join(f"<th>{inline_md(cell)}</th>" for cell in rows[0])
    body = []
    for row in rows[2:]:
        body.append("<tr>" + "".join(f"<td>{inline_md(cell)}</td>" for cell in row) + "</tr>")
    return f"<div class=\"table-wrap\"><table><thead><tr>{header}</tr></thead><tbody>{''.join(body)}</tbody></table></div>"


def strip_unordered_marker(line: str) -> str:
    return re.sub(r"^\s*[-*+]\s+", "", line)


def strip_ordered_marker(line: str) -> str:
    return re.sub(r"^\s*\d+[.)]\s+", "", line)


def render_markdown(text: str, title_to_skip: str | None = None, back_links: bool = False) -> tuple[str, list[Heading], str]:
    headings: list[Heading] = []
    used_slugs: set[str] = set()
    html_blocks: list[str] = []
    title = ""
    last_numbered_h2_without_content = False

    for block in split_blocks(text):
        code = re.match(r"^```(\w+)?\n([\s\S]*?)\n```$", block)
        if code:
            lang = html.escape(code.group(1) or "text")
            body = html.escape(code.group(2))
            html_blocks.append(f'<pre><code data-lang="{lang}">{body}</code></pre>')
            last_numbered_h2_without_content = False
            continue

        heading = re.match(r"^(#{1,4})\s+(.+)$", block)
        if heading:
            level = len(heading.group(1))
            raw = re.sub(r"\s+#*$", "", heading.group(2)).strip()
            clean = re.sub(r"[*_`]", "", raw)
            if not title and level == 1:
                title = clean
            if level == 1 and title_to_skip and clean == title_to_skip:
                continue
            if level == 2 and last_numbered_h2_without_content and not is_numbered_heading(clean):
                html_blocks.append(f"<p>{inline_md(raw)}</p>")
                last_numbered_h2_without_content = False
                continue
            slug = slugify(clean, used_slugs)
            headings.append(Heading(level, clean, slug))
            back_link = ' <a class="back-to-visual" href="#visual-map">回到图文导读</a>' if back_links and level <= 3 else ""
            html_blocks.append(f'<h{level} id="{slug}">{inline_md(raw)}{back_link}</h{level}>')
            last_numbered_h2_without_content = level == 2 and is_numbered_heading(clean)
            continue

        table = render_table(block)
        if table:
            html_blocks.append(table)
            last_numbered_h2_without_content = False
            continue

        if re.match(r"^(-{3,}|\*{3,})$", block.strip()):
            html_blocks.append("<hr>")
            last_numbered_h2_without_content = False
            continue

        if all(line.lstrip().startswith(">") for line in block.split("\n")):
            quote = " ".join(line.lstrip()[1:].strip() for line in block.split("\n"))
            html_blocks.append(f"<blockquote>{inline_md(quote)}</blockquote>")
            last_numbered_h2_without_content = False
            continue

        lines = block.split("\n")
        if all(re.match(r"^\s*[-*+]\s+", line) for line in lines):
            items = "".join(f"<li>{inline_md(strip_unordered_marker(line))}</li>" for line in lines)
            html_blocks.append(f"<ul>{items}</ul>")
            last_numbered_h2_without_content = False
            continue

        if all(re.match(r"^\s*\d+[.)]\s+", line) for line in lines):
            items = "".join(f"<li>{inline_md(strip_ordered_marker(line))}</li>" for line in lines)
            html_blocks.append(f"<ol>{items}</ol>")
            last_numbered_h2_without_content = False
            continue

        paragraph = " ".join(line.strip() for line in lines)
        html_blocks.append(f"<p>{inline_md(paragraph)}</p>")
        last_numbered_h2_without_content = False

    if not title:
        title = infer_title(text)

    return "\n".join(html_blocks), headings, title


def infer_title(text: str) -> str:
    for line in text.splitlines():
        clean = line.strip().strip("#").strip()
        if clean:
            return clean[:80]
    return "HumanView Article"


def reading_stats(text: str) -> tuple[int, int]:
    cjk = re.findall(r"[\u4e00-\u9fff]", text)
    latin = re.findall(r"\b[A-Za-z0-9][A-Za-z0-9'-]*\b", text)
    units = len(cjk) + len(latin)
    minutes = max(1, round(units / 450))
    return units, minutes


def excerpt(text: str, max_len: int = 180) -> str:
    clean = re.sub(r"[#>*_`\[\]()-]+", "", text)
    clean = re.sub(r"\s+", " ", clean).strip()
    if len(clean) <= max_len:
        return clean
    return clean[: max_len - 1].rstrip() + "..."


def plain_text(text: str) -> str:
    text = re.sub(r"^\s*#{1,6}\s+", "", text)
    text = re.sub(r"^\s*>\s?", "", text)
    text = re.sub(r"^\s*[-*+]\s+", "", text)
    text = re.sub(r"^\s*\d+[.)]\s+", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[*_`#\[\]]+", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def heading_text(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[*_`#\[\]]+", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def short_text(text: str, max_len: int = 74) -> str:
    text = plain_text(text)
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "..."


def split_sentences(text: str) -> list[str]:
    text = plain_text(text)
    if not text:
        return []
    parts = re.split(r"(?<=[。！？!?；;])\s*", text)
    sentences = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if len(part) > 120:
            chunks = re.split(r"(?<=[，,])\s*", part)
            sentences.extend(chunk.strip() for chunk in chunks if len(chunk.strip()) > 8)
        else:
            sentences.append(part)
    return sentences


def score_sentence(sentence: str, title: str, position: int) -> int:
    score = 0
    for keyword in SUMMARY_KEYWORDS:
        if keyword in sentence:
            score += 3
    title_terms = [term for term in re.split(r"[\s，。、“”《》：:,.]+", title) if len(term) >= 2]
    score += sum(1 for term in title_terms if term in sentence)
    if 20 <= len(sentence) <= 90:
        score += 4
    elif len(sentence) < 14:
        score -= 5
    elif len(sentence) > 130:
        score -= 2
    if position <= 2:
        score += 1
    if sentence.startswith(("以前", "我以前", "这件事让我想到", "当然")):
        score -= 2
    if sentence.endswith(("：", ":")):
        score -= 8
    if "媒体占位" in sentence or "来源：" in sentence:
        score -= 20
    return score


def best_summary_points(title: str, paras: list[str], count: int = 3) -> list[str]:
    candidates: list[tuple[int, int, str]] = []
    seen: set[str] = set()
    position = 0
    for para in paras:
        for sentence in split_sentences(para):
            clean = sentence.strip()
            if clean in seen or len(clean) < 8:
                continue
            seen.add(clean)
            candidates.append((score_sentence(clean, title, position), position, clean))
            position += 1

    ranked = sorted(candidates, key=lambda item: (-item[0], item[1]))
    selected: list[str] = []
    for _, _, sentence in ranked:
        if any(sentence in existing or existing in sentence for existing in selected):
            continue
        selected.append(short_text(sentence, 86))
        if len(selected) >= count:
            break

    if len(selected) < count:
        for para in paras:
            fallback = short_text(para, 86)
            if fallback and fallback not in selected:
                selected.append(fallback)
            if len(selected) >= count:
                break
    return selected


def best_quote(title: str, paras: list[str]) -> str:
    points = best_summary_points(title, paras, 1)
    return points[0] if points else "这一节需要回到原文查看细节。"


def minimal_summary(title: str, bullets: list[str], quote: str) -> str:
    text = " ".join([title, quote, *bullets])
    rules = [
        (("最值钱", "简历", "作品"), "AI 时代，最值钱的名片不是简历，而是可被看见和验证的作品。"),
        (("名片", "简历", "作品"), "AI 时代，最值钱的名片不是简历，而是可被看见和验证的作品。"),
        (("过去", "证明"), "核心障碍：能力很难低成本变成可验证的作品。"),
        (("AI", "成本"), "AI 降低制作门槛，但真正稀缺的是判断和取舍。"),
        (("样片", "简历"), "作品比简历更有说服力，因为它能被直接验证。"),
        (("skill", "逻辑"), "可调用、可使用、可验证的工具，本身就是作品资产。"),
        (("个人品牌", "作品集"), "个人品牌会从人设转向可展示、可交付的作品集。"),
        (("出海", "中国故事"), "出海不必堆文化符号，关键是让全球观众看懂。"),
        (("AI", "判断"), "AI 放大的不是替代，而是人的需求判断、审美和取舍。"),
        (("普通人", "机会"), "从今天开始做一个能被看见、使用、验证的小作品。"),
    ]
    for keywords, summary in rules:
        if all(keyword.lower() in text.lower() for keyword in keywords):
            return summary

    if "不是" in quote and "而是" in quote:
        return short_text(quote, 64)
    if bullets:
        strong = next((item for item in bullets if any(k in item for k in ("关键", "真正", "价值", "验证", "作品", "判断"))), bullets[0])
        return short_text(strong, 64)
    return "这一节需要回到原文查看细节。"


def clean_title_for_learning(title: str) -> str:
    title = re.sub(r"^\s*\d+[\.\u3001]\s*", "", title).strip()
    return title or "核心概念"


def question_for_section(title: str) -> str:
    clean = clean_title_for_learning(title).rstrip("。.!！")
    if clean.endswith(("？", "?")):
        return clean
    if any(k in clean for k in ("怎么", "如何", "为什么", "什么")):
        return f"{clean}？"
    return f"这一节最需要记住的判断是什么：{clean}？"


def is_numbered_heading(text: str) -> bool:
    return bool(re.match(r"^\d+[\.\u3001]\s*", text.strip()))


def extract_visual_sections(source: str, title: str, headings: list[Heading]) -> list[VisualSection]:
    slug_by_title: dict[str, list[str]] = {}
    for heading in headings:
        slug_by_title.setdefault(heading.text, []).append(heading.slug)

    raw_sections: list[dict[str, object]] = []
    current: dict[str, object] | None = None

    def start_section(name: str) -> None:
        nonlocal current
        slug = slug_by_title.get(name, [slugify(name, set())]).pop(0)
        current = {"title": name, "slug": slug, "paras": []}
        raw_sections.append(current)

    for block in split_blocks(source):
        heading = re.match(r"^(#{1,4})\s+(.+)$", block)
        if heading:
            level = len(heading.group(1))
            name = heading_text(heading.group(2))
            if level == 1 and name == title:
                continue
            if level == 2 and not is_numbered_heading(name) and current is not None:
                current["paras"].append(name)
                continue
            if level <= 2:
                start_section(name)
            continue

        text = plain_text(block)
        if not text or text.startswith("来源：微信公众号文章"):
            continue
        if current is None:
            start_section("核心故事")
        current["paras"].append(text)

    sections: list[VisualSection] = []
    for i, item in enumerate(raw_sections[:10], start=1):
        paras = [p for p in item["paras"] if isinstance(p, str) and len(p) > 8]
        section_title = str(item["title"])
        bullets = best_summary_points(section_title, paras, 3)
        sections.append(
            VisualSection(
                title=section_title,
                slug=str(item["slug"]),
                bullets=bullets or ["这一节需要回到原文查看细节。"],
                quote=best_quote(section_title, paras),
                index=i,
            )
        )
    return sections


def visual_html(title: str, sections: list[VisualSection]) -> str:
    if not sections:
        return ""

    palette = ["coral", "blue", "green", "gold", "violet", "cyan", "rose", "slate"]
    core = sections[0]
    minimal_cards = []
    refined_cards = []

    for i, section in enumerate(sections):
        tone = palette[i % len(palette)]
        number = f"{i + 1:02d}"
        minimal = html.escape(minimal_summary(section.title, section.bullets, section.quote))
        minimal_cards.append(
            f'''<a class="minimal-card {tone}" href="#{section.slug}">
              <span>{number}</span>
              <strong>{html.escape(section.title)}</strong>
              <em>{minimal}</em>
            </a>'''
        )
        bullets = "".join(f"<li>{html.escape(bullet)}</li>" for bullet in section.bullets)
        refined_cards.append(
            f'''<a class="idea-card {tone}" href="#{section.slug}">
              <span class="idea-card__num">{number}</span>
              <h3>{html.escape(section.title)}</h3>
              <ul>{bullets}</ul>
              <p>{html.escape(section.quote)}</p>
            </a>'''
        )

    return f'''
      <section class="map-core-section" id="visual-map" aria-label="Central thesis">
        <div class="map-core">
          <span>中心命题</span>
          <strong>{html.escape(title)}</strong>
          <em>{html.escape(minimal_summary(core.title, core.bullets, core.quote))}</em>
        </div>
      </section>

      <section class="density-tabs" aria-label="Visual density tabs">
        <div class="tabbar" role="tablist" aria-label="选择信息密度">
          <button class="tab-button active" id="tab-minimal" type="button" role="tab" aria-selected="true" aria-controls="panel-minimal" data-tab="minimal">极简版</button>
          <button class="tab-button" id="tab-refined" type="button" role="tab" aria-selected="false" aria-controls="panel-refined" data-tab="refined">精炼版</button>
        </div>
        <div class="tab-panel active" id="panel-minimal" role="tabpanel" aria-labelledby="tab-minimal" data-panel="minimal">
          <div class="minimal-grid">{''.join(minimal_cards)}</div>
        </div>
        <div class="tab-panel" id="panel-refined" role="tabpanel" aria-labelledby="tab-refined" data-panel="refined">
          <div class="idea-grid">{''.join(refined_cards)}</div>
        </div>
      </section>
    '''


def learning_html(sections: list[VisualSection]) -> str:
    if not sections:
        return ""

    concept_sections = sections[1:7] if len(sections) > 1 else sections[:6]
    concept_cards = []
    for section in concept_sections:
        summary = minimal_summary(section.title, section.bullets, section.quote)
        concept_cards.append(
            f'''<article class="concept-card">
              <strong>{html.escape(clean_title_for_learning(section.title))}</strong>
              <p>{html.escape(summary)}</p>
            </article>'''
        )

    quiz_items = []
    for section in sections[:6]:
        answer = minimal_summary(section.title, section.bullets, section.quote)
        quiz_items.append(
            f'''<details class="quiz-item">
              <summary>{html.escape(question_for_section(section.title))}</summary>
              <p>{html.escape(answer)}</p>
            </details>'''
        )

    return f'''
      <section class="study-system" aria-label="Learning system">
        <div class="section-heading">
          <span>Study Mode</span>
          <h2>把 Markdown 变成学习界面</h2>
        </div>
        <div class="study-grid">
          <article class="study-card">
            <span>01</span>
            <h3>先扫地图</h3>
            <p>先看中心命题和极简版卡片，建立整篇材料的轮廓。</p>
          </article>
          <article class="study-card">
            <span>02</span>
            <h3>再抓概念</h3>
            <p>把章节压缩成可记忆的概念卡，避免陷进长段落。</p>
          </article>
          <article class="study-card">
            <span>03</span>
            <h3>最后回查</h3>
            <p>回到完整正文验证细节；需要时再做理解检查。</p>
          </article>
        </div>

        <section class="concepts" aria-label="Core concepts">
          <h3>核心概念</h3>
          <div class="concept-grid">{''.join(concept_cards)}</div>
        </section>
      </section>

      <details class="check-understanding">
        <summary>想确认自己是否理解？展开 5 个问题</summary>
        <div class="quiz-list">{''.join(quiz_items[:5])}</div>
      </details>
    '''


def toc_html(headings: list[Heading]) -> str:
    items = []
    for h in headings:
        if h.level > 3:
            continue
        indent = " sub" if h.level == 3 else ""
        items.append(f'<a class="toc-link{indent}" href="#{h.slug}">{html.escape(h.text)}</a>')
    if not items:
        return '<span class="toc-empty">No headings detected</span>'
    return "\n".join(items)


def build_html(source: str, title_override: str | None, accent: str) -> str:
    initial_title = title_override or infer_title(source)
    body, headings, inferred_title = render_markdown(source, initial_title, back_links=True)
    title = title_override or inferred_title
    units, minutes = reading_stats(source)
    dek = excerpt(source)
    sections = extract_visual_sections(source, title, headings)
    return HTML_TEMPLATE.format(
        title=html.escape(title),
        dek=html.escape(dek),
        body=body,
        visual=visual_html(title, sections),
        learning=learning_html(sections),
        toc=toc_html(headings),
        units=f"{units:,}",
        minutes=minutes,
        accent=html.escape(accent),
    )


HTML_TEMPLATE = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <style>
    :root {{
      --accent: {accent};
      --ink: #171717;
      --muted: #666f7a;
      --line: #e6e8eb;
      --paper: #ffffff;
      --wash: #f7f7f4;
      --soft: #fff4e8;
      --measure: 820px;
    }}
    * {{ box-sizing: border-box; }}
    html {{ scroll-behavior: smooth; }}
    body {{
      margin: 0;
      color: var(--ink);
      background: #fbfaf7;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      line-height: 1.75;
    }}
    .progress {{
      position: fixed;
      inset: 0 0 auto 0;
      height: 4px;
      background: linear-gradient(90deg, var(--accent), #111827);
      transform-origin: left;
      transform: scaleX(0);
      z-index: 10;
    }}
    .shell {{
      max-width: 1120px;
      margin: 0 auto;
      padding: 42px 28px 96px;
    }}
    article {{
      min-width: 0;
    }}
    header {{
      padding: 20px 0 10px;
      margin: 0 auto;
      max-width: 860px;
      text-align: center;
    }}
    h1, h2, h3, h4 {{
      line-height: 1.18;
      letter-spacing: 0;
      color: #111827;
    }}
    h1 {{
      margin: 0;
      font-size: clamp(34px, 5vw, 58px);
      max-width: 860px;
    }}
    .map-core-section {{
      margin: 18px auto 30px;
      max-width: 820px;
    }}
    .map-core {{
      display: grid;
      align-content: center;
      gap: 10px;
      min-height: 142px;
      margin: 0 auto;
      padding: 24px 28px;
      border: 1px solid #111827;
      border-radius: 8px;
      background: #fff;
      color: #111827;
      text-align: center;
      box-shadow: 5px 5px 0 #111827;
    }}
    .map-core span, .map-core em {{
      color: #5f6673;
      font-style: normal;
    }}
    .map-core span {{
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .1em;
      text-transform: uppercase;
    }}
    .map-core em {{
      font-size: 17px;
      line-height: 1.55;
    }}
    .map-core strong {{
      font-size: clamp(22px, 3vw, 30px);
      line-height: 1.2;
    }}
    .density-tabs {{
      margin: 24px 0 48px;
    }}
    .tabbar {{
      display: inline-flex;
      gap: 8px;
      padding: 6px;
      border: 1px solid #111827;
      border-radius: 999px;
      background: #fff;
      box-shadow: 4px 4px 0 #111827;
    }}
    .tab-button {{
      cursor: pointer;
      min-height: 38px;
      padding: 7px 18px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: #4b5563;
      font: inherit;
      font-size: 15px;
      font-weight: 900;
    }}
    .tab-button.active {{
      background: #111827;
      color: #fff;
    }}
    .tab-panel {{
      display: none;
      margin-top: 22px;
    }}
    .tab-panel.active {{
      display: block;
    }}
    .minimal-grid {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }}
    .minimal-card, .idea-card {{
      color: #111827;
      text-decoration: none;
    }}
    .minimal-card {{
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 8px 12px;
      align-content: start;
      min-height: 136px;
      padding: 16px;
      border: 1px solid #111827;
      border-radius: 8px;
      box-shadow: 4px 4px 0 rgba(17,24,39,.9);
    }}
    .minimal-card span {{
      grid-row: span 2;
      display: grid;
      place-items: center;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: rgba(255,255,255,.78);
      font-weight: 900;
    }}
    .minimal-card strong {{
      line-height: 1.25;
      font-size: 17px;
    }}
    .minimal-card em {{
      color: rgba(17,24,39,.72);
      font-size: 13px;
      font-style: normal;
      line-height: 1.45;
    }}
    .idea-grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }}
    .idea-card {{
      display: block;
      min-height: 260px;
      padding: 22px;
      border: 1px solid #111827;
      border-radius: 8px;
      box-shadow: 5px 5px 0 rgba(17,24,39,.86);
    }}
    .idea-card__num {{
      display: inline-grid;
      place-items: center;
      min-width: 42px;
      height: 30px;
      margin-bottom: 14px;
      border: 1px solid rgba(17,24,39,.35);
      border-radius: 999px;
      background: rgba(255,255,255,.7);
      font-size: 13px;
      font-weight: 900;
    }}
    .idea-card h3 {{
      margin: 0 0 12px;
      font-size: 22px;
    }}
    .idea-card ul {{
      margin: 0 0 16px;
      padding-left: 1.1em;
    }}
    .idea-card li {{
      font-size: 15px;
      line-height: 1.5;
    }}
    .idea-card p {{
      margin: 0;
      padding-top: 12px;
      border-top: 1px solid rgba(17,24,39,.18);
      color: rgba(17,24,39,.72);
      font-size: 15px;
      line-height: 1.55;
    }}
    .coral {{ background: #ffd6c9; }}
    .blue {{ background: #dbeafe; }}
    .green {{ background: #c9f7df; }}
    .gold {{ background: #fff0a8; }}
    .violet {{ background: #eadcff; }}
    .cyan {{ background: #c8f3ff; }}
    .rose {{ background: #ffd6e8; }}
    .slate {{ background: #e7ecf2; }}
    .study-system {{
      margin: 52px 0 44px;
      padding: 28px;
      border: 1px solid #111827;
      border-radius: 8px;
      background: #fff;
      box-shadow: 6px 6px 0 #111827;
    }}
    .section-heading {{
      display: grid;
      gap: 8px;
      margin-bottom: 22px;
    }}
    .section-heading span {{
      color: var(--accent);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .12em;
      text-transform: uppercase;
    }}
    .section-heading h2 {{
      margin: 0;
      padding: 0;
      font-size: clamp(28px, 3vw, 42px);
    }}
    .study-grid {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 28px;
    }}
    .study-card {{
      padding: 18px;
      border: 1px solid #111827;
      border-radius: 8px;
      background: #fbfaf7;
    }}
    .study-card span {{
      display: inline-grid;
      place-items: center;
      width: 38px;
      height: 28px;
      margin-bottom: 12px;
      border-radius: 999px;
      background: #111827;
      color: #fff;
      font-size: 13px;
      font-weight: 900;
    }}
    .study-card h3, .concepts h3 {{
      margin: 0 0 10px;
      font-size: 21px;
    }}
    .study-card p {{
      margin: 0;
      color: #4b5563;
      font-size: 15px;
      line-height: 1.55;
    }}
    .concept-grid {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }}
    .concept-card {{
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #f8fbff;
    }}
    .concept-card strong {{
      display: block;
      margin-bottom: 8px;
      font-size: 17px;
      line-height: 1.3;
    }}
    .concept-card p {{
      margin: 0;
      color: #4b5563;
      font-size: 14px;
      line-height: 1.55;
    }}
    .quiz-list {{
      display: grid;
      gap: 10px;
    }}
    .check-understanding {{
      max-width: var(--measure);
      margin: 22px auto 0;
      padding: 0;
    }}
    .check-understanding > summary {{
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      min-height: 42px;
      padding: 8px 14px;
      border: 1px solid #111827;
      border-radius: 999px;
      background: #fff8d8;
      box-shadow: 3px 3px 0 #111827;
      font-weight: 800;
      list-style: none;
    }}
    .check-understanding > summary::-webkit-details-marker {{ display: none; }}
    .check-understanding .quiz-list {{
      margin-top: 18px;
    }}
    .quiz-item {{
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff8d8;
    }}
    .quiz-item summary {{
      cursor: pointer;
      padding: 13px 14px;
      font-weight: 800;
      line-height: 1.4;
    }}
    .quiz-item p {{
      margin: 0;
      padding: 0 14px 14px;
      color: #4b5563;
      font-size: 14px;
      line-height: 1.55;
    }}
    details.fulltext {{
      max-width: var(--measure);
      margin: 26px auto 0;
      border-top: 1px solid var(--line);
      padding-top: 22px;
    }}
    details.fulltext > summary {{
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      min-height: 42px;
      padding: 8px 14px;
      border: 1px solid #111827;
      border-radius: 999px;
      background: #fff;
      box-shadow: 3px 3px 0 #111827;
      font-weight: 800;
      list-style: none;
    }}
    details.fulltext > summary::-webkit-details-marker {{ display: none; }}
    .fulltext-body {{
      margin-top: 34px;
    }}
    .back-to-visual {{
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      margin-left: 10px;
      padding: 4px 10px;
      border: 1px solid #111827;
      border-radius: 999px;
      background: #fff8d8;
      color: #111827;
      box-shadow: 2px 2px 0 #111827;
      font-size: 13px;
      font-weight: 800;
      line-height: 1.2;
      text-decoration: none;
      vertical-align: middle;
    }}
    .back-to-visual:hover {{
      background: #111827;
      color: #fff;
    }}
    h2 {{
      margin: 58px 0 18px;
      padding-top: 10px;
      font-size: clamp(28px, 3vw, 40px);
    }}
    h3 {{
      margin: 38px 0 12px;
      font-size: 24px;
    }}
    h4 {{
      margin: 30px 0 10px;
      font-size: 19px;
    }}
    p, li {{
      font-size: 18px;
    }}
    p {{
      margin: 0 0 22px;
    }}
    a {{
      color: var(--accent);
      text-underline-offset: 3px;
    }}
    ul, ol {{
      margin: 0 0 26px;
      padding-left: 1.4em;
    }}
    li + li {{ margin-top: 8px; }}
    blockquote {{
      margin: 34px 0;
      padding: 22px 26px;
      border-left: 4px solid var(--accent);
      background: var(--soft);
      color: #1f2937;
      font-size: 22px;
      line-height: 1.65;
    }}
    pre {{
      overflow: auto;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #111827;
      color: #f9fafb;
      line-height: 1.55;
    }}
    code {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: .92em;
    }}
    p code, li code {{
      padding: 2px 5px;
      border-radius: 5px;
      background: #eef0f3;
      color: #111827;
    }}
    hr {{
      border: 0;
      border-top: 1px solid var(--line);
      margin: 44px 0;
    }}
    .table-wrap {{
      overflow-x: auto;
      margin: 30px 0;
      border: 1px solid var(--line);
      border-radius: 8px;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 15px;
    }}
    th, td {{
      padding: 11px 13px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }}
    th {{
      background: var(--wash);
      color: #111827;
    }}
    @media (max-width: 920px) {{
      .shell {{
        padding: 28px 20px 72px;
      }}
      .idea-grid, .minimal-grid, .study-grid, .concept-grid {{ grid-template-columns: 1fr; }}
      .map-core {{ min-height: auto; text-align: left; }}
      .tabbar {{ width: 100%; display: grid; grid-template-columns: 1fr 1fr; }}
      header {{ padding-top: 22px; }}
      p, li {{ font-size: 17px; }}
      blockquote {{ font-size: 19px; padding: 18px 20px; }}
    }}
  </style>
</head>
<body>
  <div class="progress" id="progress"></div>
  <main class="shell">
    <article>
      <header>
        <h1>{title}</h1>
      </header>
      {visual}
      {learning}
      <details class="fulltext">
        <summary>展开完整正文</summary>
        <div class="fulltext-body">
          {body}
        </div>
      </details>
    </article>
  </main>
  <script>
    const progress = document.getElementById('progress');
    const fulltext = document.querySelector('.fulltext');

    function updateProgress() {{
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? window.scrollY / max : 0;
      progress.style.transform = `scaleX(${{Math.max(0, Math.min(1, ratio))}})`;
    }}

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {{
      anchor.addEventListener('click', () => {{
        const target = document.querySelector(anchor.getAttribute('href'));
        if (fulltext && target && fulltext.contains(target)) {{
          fulltext.open = true;
        }}
      }});
    }});

    if (fulltext && location.hash) {{
      const target = document.querySelector(location.hash);
      if (target && fulltext.contains(target)) fulltext.open = true;
    }}

    document.querySelectorAll('.tab-button').forEach(button => {{
      button.addEventListener('click', () => {{
        const tab = button.dataset.tab;
        document.querySelectorAll('.tab-button').forEach(item => {{
          const active = item === button;
          item.classList.toggle('active', active);
          item.setAttribute('aria-selected', active ? 'true' : 'false');
        }});
        document.querySelectorAll('.tab-panel').forEach(panel => {{
          panel.classList.toggle('active', panel.dataset.panel === tab);
        }});
      }});
    }});

    window.addEventListener('scroll', updateProgress, {{ passive: true }});
    updateProgress();
  </script>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Render long Markdown/plain text as a readable single-file HTML page.")
    parser.add_argument("input", type=Path, help="Input Markdown or plain text file")
    parser.add_argument("output", type=Path, help="Output HTML file")
    parser.add_argument("--title", help="Override inferred page title")
    parser.add_argument("--accent", default="#2563eb", help="Accent color, e.g. #2563eb")
    args = parser.parse_args()

    if not args.input.exists():
        print(f"Input file not found: {args.input}", file=sys.stderr)
        return 1

    source = args.input.read_text(encoding="utf-8")
    output = build_html(source, args.title, args.accent)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output, encoding="utf-8")
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
