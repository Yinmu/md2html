#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const SUMMARY_KEYWORDS = [
  "不是", "而是", "因为", "所以", "关键", "真正", "价值", "机会",
  "门槛", "证明", "作品", "判断", "能力", "成本", "验证", "普通人",
  "未来", "本质", "核心", "名片", "做出来", "看见", "使用", "最",
  "才是", "不需要", "应该"
];

const PALETTE = ["coral", "blue", "green", "gold", "violet", "cyan", "rose", "slate"];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function slugify(text, used) {
  const base = headingText(text)
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
  let slug = base;
  let index = 2;
  while (used.has(slug)) slug = `${base}-${index++}`;
  used.add(slug);
  return slug;
}

function inlineMd(text) {
  const codes = [];
  let rendered = String(text).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  rendered = escapeHtml(rendered);
  rendered = rendered.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  rendered = rendered.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  codes.forEach((code, index) => {
    rendered = rendered.replace(`\u0000${index}\u0000`, code);
  });
  return rendered;
}

function splitBlocks(text) {
  const blocks = [];
  let current = [];
  let inCode = false;
  for (const line of String(text).replace(/\r\n?/g, "\n").trim().split("\n")) {
    if (line.trim().startsWith("```")) {
      if (current.length && !inCode) {
        blocks.push(current.join("\n").trim());
        current = [];
      }
      current.push(line);
      if (inCode) {
        blocks.push(current.join("\n").trim());
        current = [];
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      current.push(line);
      continue;
    }
    if (!line.trim()) {
      if (current.length) {
        blocks.push(current.join("\n").trim());
        current = [];
      }
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current.join("\n").trim());
  return blocks.filter(Boolean);
}

function plainText(text) {
  return String(text)
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#\[\]]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headingText(text) {
  return String(text)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#\[\]]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferTitle(text) {
  for (const line of String(text).split(/\r?\n/)) {
    const clean = line.trim().replace(/^#+\s*/, "").replace(/\s*#+$/, "").trim();
    if (clean) return clean.slice(0, 80);
  }
  return "Markdown Article";
}

function shortText(text, max = 74) {
  const clean = plainText(text);
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}...`;
}

function splitSentences(text) {
  const clean = plainText(text);
  if (!clean) return [];
  const parts = clean.split(/(?<=[。！？!?；;])\s*/);
  const sentences = [];
  for (const part of parts) {
    const item = part.trim();
    if (!item) continue;
    if (item.length > 120) {
      sentences.push(...item.split(/(?<=[，,])\s*/).map((x) => x.trim()).filter((x) => x.length > 8));
    } else {
      sentences.push(item);
    }
  }
  return sentences;
}

function scoreSentence(sentence, title, position) {
  let score = 0;
  for (const keyword of SUMMARY_KEYWORDS) if (sentence.includes(keyword)) score += 3;
  const titleTerms = headingText(title).split(/[\s，。、“”《》：:,.]+/).filter((term) => term.length >= 2);
  for (const term of titleTerms) if (sentence.includes(term)) score += 1;
  if (sentence.length >= 20 && sentence.length <= 90) score += 4;
  else if (sentence.length < 14) score -= 5;
  else if (sentence.length > 130) score -= 2;
  if (position <= 2) score += 1;
  if (/^(以前|我以前|这件事让我想到|当然)/.test(sentence)) score -= 2;
  if (/[：:]$/.test(sentence)) score -= 8;
  if (sentence.includes("媒体占位") || sentence.includes("来源：")) score -= 20;
  return score;
}

function bestSummaryPoints(title, paras, count = 3) {
  const candidates = [];
  const seen = new Set();
  let position = 0;
  for (const para of paras) {
    for (const sentence of splitSentences(para)) {
      if (sentence.length < 8 || seen.has(sentence)) continue;
      seen.add(sentence);
      candidates.push({ sentence, score: scoreSentence(sentence, title, position), position });
      position += 1;
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.position - b.position);
  const selected = [];
  for (const item of candidates) {
    if (selected.some((existing) => existing.includes(item.sentence) || item.sentence.includes(existing))) continue;
    selected.push(shortText(item.sentence, 86));
    if (selected.length >= count) break;
  }
  for (const para of paras) {
    if (selected.length >= count) break;
    const fallback = shortText(para, 86);
    if (fallback && !selected.includes(fallback)) selected.push(fallback);
  }
  return selected;
}

function bestQuote(title, paras) {
  return bestSummaryPoints(title, paras, 1)[0] || "这一节需要回到原文查看细节。";
}

function minimalSummary(title, bullets, quote) {
  const text = [title, quote, ...bullets].join(" ").toLowerCase();
  const rules = [
    [["最值钱", "简历", "作品"], "AI 时代，最值钱的名片不是简历，而是可被看见和验证的作品。"],
    [["名片", "简历", "作品"], "AI 时代，最值钱的名片不是简历，而是可被看见和验证的作品。"],
    [["过去", "证明"], "核心障碍：能力很难低成本变成可验证的作品。"],
    [["AI".toLowerCase(), "成本"], "AI 降低制作门槛，但真正稀缺的是判断和取舍。"],
    [["样片", "简历"], "作品比简历更有说服力，因为它能被直接验证。"],
    [["skill", "逻辑"], "可调用、可使用、可验证的工具，本身就是作品资产。"],
    [["个人品牌", "作品集"], "个人品牌会从人设转向可展示、可交付的作品集。"],
    [["出海", "中国故事"], "出海不必堆文化符号，关键是让全球观众看懂。"],
    [["ai", "判断"], "AI 放大的不是替代，而是人的需求判断、审美和取舍。"],
    [["普通人", "机会"], "从今天开始做一个能被看见、使用、验证的小作品。"]
  ];
  for (const [keywords, summary] of rules) {
    if (keywords.every((keyword) => text.includes(keyword.toLowerCase()))) return summary;
  }
  if (quote.includes("不是") && quote.includes("而是")) return shortText(quote, 64);
  const strong = bullets.find((item) => /关键|真正|价值|验证|作品|判断/.test(item)) || bullets[0];
  return strong ? shortText(strong, 64) : "这一节需要回到原文查看细节。";
}

function cleanTitleForLearning(title) {
  return headingText(title).replace(/^\s*\d+[.、]\s*/, "").trim() || "核心概念";
}

function questionForSection(title) {
  const clean = cleanTitleForLearning(title).replace(/[。.!！]+$/, "");
  if (/[？?]$/.test(clean)) return clean;
  if (/怎么|如何|为什么|什么/.test(clean)) return `${clean}？`;
  return `这一节最需要记住的判断是什么：${clean}？`;
}

function isNumberedHeading(text) {
  return /^\d+[.、]\s*/.test(String(text).trim());
}

function renderTable(block) {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2 || !lines[0].includes("|")) return null;
  if (!/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[1])) return null;
  const rows = lines.map((line) => line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
  const header = rows[0].map((cell) => `<th>${inlineMd(cell)}</th>`).join("");
  const body = rows.slice(2).map((row) => `<tr>${row.map((cell) => `<td>${inlineMd(cell)}</td>`).join("")}</tr>`).join("");
  return `<div class="table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderMarkdown(source, titleToSkip, backLinks = false) {
  const headings = [];
  const used = new Set();
  const htmlBlocks = [];
  let title = "";
  let lastNumberedH2WithoutContent = false;

  for (const block of splitBlocks(source)) {
    const code = block.match(/^```(\w+)?\n([\s\S]*?)\n```$/);
    if (code) {
      htmlBlocks.push(`<pre><code data-lang="${escapeHtml(code[1] || "text")}">${escapeHtml(code[2])}</code></pre>`);
      lastNumberedH2WithoutContent = false;
      continue;
    }

    const heading = block.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const raw = heading[2].replace(/\s+#*$/, "").trim();
      const clean = headingText(raw);
      if (!title && level === 1) title = clean;
      if (level === 1 && titleToSkip && clean === titleToSkip) continue;
      if (level === 2 && lastNumberedH2WithoutContent && !isNumberedHeading(clean)) {
        htmlBlocks.push(`<p>${inlineMd(raw)}</p>`);
        lastNumberedH2WithoutContent = false;
        continue;
      }
      const slug = slugify(clean, used);
      headings.push({ level, text: clean, slug });
      const back = backLinks && level <= 3 ? ' <a class="back-to-visual" href="#visual-map">回到图文导读</a>' : "";
      htmlBlocks.push(`<h${level} id="${slug}">${inlineMd(raw)}${back}</h${level}>`);
      lastNumberedH2WithoutContent = level === 2 && isNumberedHeading(clean);
      continue;
    }

    const table = renderTable(block);
    if (table) {
      htmlBlocks.push(table);
      lastNumberedH2WithoutContent = false;
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(block.trim())) {
      htmlBlocks.push("<hr>");
      lastNumberedH2WithoutContent = false;
      continue;
    }

    const lines = block.split("\n");
    if (lines.every((line) => line.trim().startsWith(">"))) {
      const quote = lines.map((line) => line.trim().replace(/^>\s?/, "")).join(" ");
      htmlBlocks.push(`<blockquote>${inlineMd(quote)}</blockquote>`);
      lastNumberedH2WithoutContent = false;
      continue;
    }

    if (lines.every((line) => /^\s*[-*+]\s+/.test(line))) {
      const items = lines.map((line) => `<li>${inlineMd(line.replace(/^\s*[-*+]\s+/, ""))}</li>`).join("");
      htmlBlocks.push(`<ul>${items}</ul>`);
      lastNumberedH2WithoutContent = false;
      continue;
    }

    if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
      const items = lines.map((line) => `<li>${inlineMd(line.replace(/^\s*\d+[.)]\s+/, ""))}</li>`).join("");
      htmlBlocks.push(`<ol>${items}</ol>`);
      lastNumberedH2WithoutContent = false;
      continue;
    }

    htmlBlocks.push(`<p>${inlineMd(lines.map((line) => line.trim()).join(" "))}</p>`);
    lastNumberedH2WithoutContent = false;
  }

  return {
    body: htmlBlocks.join("\n"),
    headings,
    title: title || inferTitle(source)
  };
}

function extractVisualSections(source, title, headings) {
  const slugByTitle = new Map();
  for (const heading of headings) {
    if (!slugByTitle.has(heading.text)) slugByTitle.set(heading.text, []);
    slugByTitle.get(heading.text).push(heading.slug);
  }

  const rawSections = [];
  let current = null;
  const fallbackUsed = new Set();
  const startSection = (name) => {
    const existing = slugByTitle.get(name);
    const slug = existing && existing.length ? existing.shift() : slugify(name, fallbackUsed);
    current = { title: name, slug, paras: [] };
    rawSections.push(current);
  };

  for (const block of splitBlocks(source)) {
    const heading = block.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const name = headingText(heading[2]);
      if (level === 1 && name === title) continue;
      if (level === 2 && !isNumberedHeading(name) && current) {
        current.paras.push(name);
        continue;
      }
      if (level <= 2) startSection(name);
      continue;
    }
    const text = plainText(block);
    if (!text || text.startsWith("来源：微信公众号文章")) continue;
    if (!current) startSection("核心故事");
    current.paras.push(text);
  }

  return rawSections.slice(0, 10).map((section, index) => {
    const paras = section.paras.filter((para) => para.length > 8);
    const bullets = bestSummaryPoints(section.title, paras, 3);
    return {
      title: section.title,
      slug: section.slug,
      bullets: bullets.length ? bullets : ["这一节需要回到原文查看细节。"],
      quote: bestQuote(section.title, paras),
      index: index + 1
    };
  });
}

function readingStats(text) {
  const cjk = String(text).match(/[\u4e00-\u9fff]/g) || [];
  const latin = String(text).match(/\b[A-Za-z0-9][A-Za-z0-9'-]*\b/g) || [];
  const units = cjk.length + latin.length;
  return { units, minutes: Math.max(1, Math.round(units / 450)) };
}

function visualHtml(title, sections) {
  if (!sections.length) return "";
  const core = sections[0];
  const minimalCards = [];
  const refinedCards = [];
  sections.forEach((section, index) => {
    const tone = PALETTE[index % PALETTE.length];
    const number = String(index + 1).padStart(2, "0");
    const minimal = escapeHtml(minimalSummary(section.title, section.bullets, section.quote));
    minimalCards.push(`<a class="minimal-card ${tone}" href="#${section.slug}"><span>${number}</span><strong>${escapeHtml(section.title)}</strong><em>${minimal}</em></a>`);
    refinedCards.push(`<a class="idea-card ${tone}" href="#${section.slug}"><span class="idea-card__num">${number}</span><h3>${escapeHtml(section.title)}</h3><ul>${section.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul><p>${escapeHtml(section.quote)}</p></a>`);
  });

  return `
      <section class="map-core-section" id="visual-map" aria-label="Central thesis">
        <div class="map-core">
          <span>中心命题</span>
          <strong>${escapeHtml(title)}</strong>
          <em>${escapeHtml(minimalSummary(core.title, core.bullets, core.quote))}</em>
        </div>
      </section>
      <section class="density-tabs" aria-label="Visual density tabs">
        <div class="tabbar" role="tablist" aria-label="选择信息密度">
          <button class="tab-button active" id="tab-minimal" type="button" role="tab" aria-selected="true" aria-controls="panel-minimal" data-tab="minimal">极简版</button>
          <button class="tab-button" id="tab-refined" type="button" role="tab" aria-selected="false" aria-controls="panel-refined" data-tab="refined">精炼版</button>
        </div>
        <div class="tab-panel active" id="panel-minimal" role="tabpanel" aria-labelledby="tab-minimal" data-panel="minimal">
          <div class="minimal-grid">${minimalCards.join("")}</div>
        </div>
        <div class="tab-panel" id="panel-refined" role="tabpanel" aria-labelledby="tab-refined" data-panel="refined">
          <div class="idea-grid">${refinedCards.join("")}</div>
        </div>
      </section>`;
}

function learningHtml(sections) {
  if (!sections.length) return "";
  const conceptSections = sections.length > 1 ? sections.slice(1, 7) : sections.slice(0, 6);
  const concepts = conceptSections.map((section) => `<article class="concept-card"><strong>${escapeHtml(cleanTitleForLearning(section.title))}</strong><p>${escapeHtml(minimalSummary(section.title, section.bullets, section.quote))}</p></article>`).join("");
  const questions = sections.slice(0, 5).map((section) => `<details class="quiz-item"><summary>${escapeHtml(questionForSection(section.title))}</summary><p>${escapeHtml(minimalSummary(section.title, section.bullets, section.quote))}</p></details>`).join("");
  return `
      <section class="study-system" aria-label="Learning system">
        <div class="section-heading"><span>Study Mode</span><h2>把 Markdown 变成学习界面</h2></div>
        <div class="study-grid">
          <article class="study-card"><span>01</span><h3>先扫地图</h3><p>先看中心命题和极简版卡片，建立整篇材料的轮廓。</p></article>
          <article class="study-card"><span>02</span><h3>再抓概念</h3><p>把章节压缩成可记忆的概念卡，避免陷进长段落。</p></article>
          <article class="study-card"><span>03</span><h3>最后回查</h3><p>回到完整正文验证细节；需要时再做理解检查。</p></article>
        </div>
        <section class="concepts" aria-label="Core concepts">
          <h3>核心概念</h3>
          <div class="concept-grid">${concepts}</div>
        </section>
      </section>
      <details class="check-understanding">
        <summary>想确认自己是否理解？展开 5 个问题</summary>
        <div class="quiz-list">${questions}</div>
      </details>`;
}

function buildHtml(source, titleOverride, accent = "#2563eb") {
  const initialTitle = titleOverride || inferTitle(source);
  const rendered = renderMarkdown(source, initialTitle, true);
  const title = titleOverride || rendered.title;
  const sections = extractVisualSections(source, title, rendered.headings);
  const stats = readingStats(source);
  return htmlTemplate({
    title,
    body: rendered.body,
    visual: visualHtml(title, sections),
    learning: learningHtml(sections),
    units: stats.units.toLocaleString("en-US"),
    minutes: stats.minutes,
    accent
  });
}

function htmlTemplate({ title, body, visual, learning, accent }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root{--accent:${escapeHtml(accent)};--ink:#171717;--muted:#666f7a;--line:#e6e8eb;--paper:#fff;--soft:#fff4e8;--measure:820px}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:#fbfaf7;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.75}.progress{position:fixed;inset:0 0 auto 0;height:4px;background:linear-gradient(90deg,var(--accent),#111827);transform-origin:left;transform:scaleX(0);z-index:10}.shell{max-width:1120px;margin:0 auto;padding:42px 28px 96px}header{padding:20px 0 10px;margin:0 auto;max-width:860px;text-align:center}h1,h2,h3,h4{line-height:1.18;letter-spacing:0;color:#111827}h1{margin:0;font-size:clamp(34px,5vw,58px)}.map-core-section{margin:18px auto 30px;max-width:820px}.map-core{display:grid;align-content:center;gap:10px;min-height:142px;margin:0 auto;padding:24px 28px;border:1px solid #111827;border-radius:8px;background:#fff;text-align:center;box-shadow:5px 5px 0 #111827}.map-core span,.map-core em{color:#5f6673;font-style:normal}.map-core span{font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.map-core em{font-size:17px;line-height:1.55}.map-core strong{font-size:clamp(22px,3vw,30px);line-height:1.2}.density-tabs{margin:24px 0 48px}.tabbar{display:inline-flex;gap:8px;padding:6px;border:1px solid #111827;border-radius:999px;background:#fff;box-shadow:4px 4px 0 #111827}.tab-button{cursor:pointer;min-height:38px;padding:7px 18px;border:0;border-radius:999px;background:transparent;color:#4b5563;font:inherit;font-size:15px;font-weight:900}.tab-button.active{background:#111827;color:#fff}.tab-panel{display:none;margin-top:22px}.tab-panel.active{display:block}.minimal-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.minimal-card,.idea-card{color:#111827;text-decoration:none}.minimal-card{display:grid;grid-template-columns:42px minmax(0,1fr);gap:8px 12px;align-content:start;min-height:136px;padding:16px;border:1px solid #111827;border-radius:8px;box-shadow:4px 4px 0 rgba(17,24,39,.9)}.minimal-card span{grid-row:span 2;display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.78);font-weight:900}.minimal-card strong{line-height:1.25;font-size:17px}.minimal-card em{color:rgba(17,24,39,.72);font-size:13px;font-style:normal;line-height:1.45}.idea-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.idea-card{display:block;min-height:260px;padding:22px;border:1px solid #111827;border-radius:8px;box-shadow:5px 5px 0 rgba(17,24,39,.86)}.idea-card__num{display:inline-grid;place-items:center;min-width:42px;height:30px;margin-bottom:14px;border:1px solid rgba(17,24,39,.35);border-radius:999px;background:rgba(255,255,255,.7);font-size:13px;font-weight:900}.idea-card h3{margin:0 0 12px;font-size:22px}.idea-card ul{margin:0 0 16px;padding-left:1.1em}.idea-card li{font-size:15px;line-height:1.5}.idea-card p{margin:0;padding-top:12px;border-top:1px solid rgba(17,24,39,.18);color:rgba(17,24,39,.72);font-size:15px;line-height:1.55}.coral{background:#ffd6c9}.blue{background:#dbeafe}.green{background:#c9f7df}.gold{background:#fff0a8}.violet{background:#eadcff}.cyan{background:#c8f3ff}.rose{background:#ffd6e8}.slate{background:#e7ecf2}.study-system{margin:52px 0 44px;padding:28px;border:1px solid #111827;border-radius:8px;background:#fff;box-shadow:6px 6px 0 #111827}.section-heading{display:grid;gap:8px;margin-bottom:22px}.section-heading span{color:var(--accent);font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.section-heading h2{margin:0;padding:0;font-size:clamp(28px,3vw,42px)}.study-grid,.concept-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.study-card{padding:18px;border:1px solid #111827;border-radius:8px;background:#fbfaf7}.study-card span{display:inline-grid;place-items:center;width:38px;height:28px;margin-bottom:12px;border-radius:999px;background:#111827;color:#fff;font-size:13px;font-weight:900}.study-card h3,.concepts h3{margin:0 0 10px;font-size:21px}.study-card p,.concept-card p{margin:0;color:#4b5563;font-size:15px;line-height:1.55}.concept-card{padding:16px;border:1px solid var(--line);border-radius:8px;background:#f8fbff}.concept-card strong{display:block;margin-bottom:8px;font-size:17px;line-height:1.3}.check-understanding,details.fulltext{max-width:var(--measure);margin:22px auto 0}.check-understanding>summary,details.fulltext>summary{cursor:pointer;display:inline-flex;align-items:center;min-height:42px;padding:8px 14px;border:1px solid #111827;border-radius:999px;background:#fff8d8;box-shadow:3px 3px 0 #111827;font-weight:800;list-style:none}.quiz-list{display:grid;gap:10px;margin-top:18px}.quiz-item{border:1px solid var(--line);border-radius:8px;background:#fff8d8}.quiz-item summary{cursor:pointer;padding:13px 14px;font-weight:800;line-height:1.4}.quiz-item p{margin:0;padding:0 14px 14px;color:#4b5563;font-size:14px}.fulltext-body{margin-top:34px}.back-to-visual{display:inline-flex;align-items:center;min-height:30px;margin-left:10px;padding:4px 10px;border:1px solid #111827;border-radius:999px;background:#fff8d8;color:#111827;box-shadow:2px 2px 0 #111827;font-size:13px;font-weight:800;line-height:1.2;text-decoration:none;vertical-align:middle}.back-to-visual:hover{background:#111827;color:#fff}h2{margin:58px 0 18px;padding-top:10px;font-size:clamp(28px,3vw,40px)}h3{margin:38px 0 12px;font-size:24px}h4{margin:30px 0 10px;font-size:19px}p,li{font-size:18px}p{margin:0 0 22px}a{color:var(--accent);text-underline-offset:3px}ul,ol{margin:0 0 26px;padding-left:1.4em}li+li{margin-top:8px}blockquote{margin:34px 0;padding:22px 26px;border-left:4px solid var(--accent);background:var(--soft);color:#1f2937;font-size:22px;line-height:1.65}pre{overflow:auto;padding:18px;border:1px solid var(--line);border-radius:8px;background:#111827;color:#f9fafb;line-height:1.55}code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:.92em}p code,li code{padding:2px 5px;border-radius:5px;background:#eef0f3;color:#111827}hr{border:0;border-top:1px solid var(--line);margin:44px 0}.table-wrap{overflow-x:auto;margin:30px 0;border:1px solid var(--line);border-radius:8px}table{width:100%;border-collapse:collapse;font-size:15px}th,td{padding:11px 13px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:#f7f7f4;color:#111827}@media(max-width:920px){.shell{padding:28px 20px 72px}.idea-grid,.minimal-grid,.study-grid,.concept-grid{grid-template-columns:1fr}.map-core{min-height:auto;text-align:left}.tabbar{width:100%;display:grid;grid-template-columns:1fr 1fr}header{padding-top:22px}p,li{font-size:17px}blockquote{font-size:19px;padding:18px 20px}}
  </style>
</head>
<body>
  <div class="progress" id="progress"></div>
  <main class="shell">
    <article>
      <header><h1>${escapeHtml(title)}</h1></header>
      ${visual}
      ${learning}
      <details class="fulltext">
        <summary>展开完整正文</summary>
        <div class="fulltext-body">${body}</div>
      </details>
    </article>
  </main>
  <script>
    const progress = document.getElementById('progress');
    const fulltext = document.querySelector('.fulltext');
    function updateProgress(){const max=document.documentElement.scrollHeight-window.innerHeight;const ratio=max>0?window.scrollY/max:0;progress.style.transform='scaleX('+Math.max(0,Math.min(1,ratio))+')'}
    document.querySelectorAll('a[href^="#"]').forEach(anchor=>anchor.addEventListener('click',()=>{const target=document.querySelector(anchor.getAttribute('href'));if(fulltext&&target&&fulltext.contains(target))fulltext.open=true}));
    if(fulltext&&location.hash){const target=document.querySelector(location.hash);if(target&&fulltext.contains(target))fulltext.open=true}
    document.querySelectorAll('.tab-button').forEach(button=>button.addEventListener('click',()=>{const tab=button.dataset.tab;document.querySelectorAll('.tab-button').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-selected',active?'true':'false')});document.querySelectorAll('.tab-panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===tab))}));
    window.addEventListener('scroll',updateProgress,{passive:true});updateProgress();
  </script>
</body>
</html>`;
}

function parseArgs(argv) {
  const args = { input: null, output: null, title: null, accent: "#2563eb" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--title") args.title = argv[++index];
    else if (value === "--accent") args.accent = argv[++index];
    else if (!args.input) args.input = value;
    else if (!args.output) args.output = value;
    else throw new Error(`Unexpected argument: ${value}`);
  }
  if (!args.input || !args.output) throw new Error("Usage: node scripts/render_md2html.js input.md output.html [--title \"Title\"] [--accent \"#2563eb\"]");
  return args;
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(args.input)) throw new Error(`Input file not found: ${args.input}`);
    const source = fs.readFileSync(args.input, "utf8");
    const output = buildHtml(source, args.title, args.accent);
    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    fs.writeFileSync(args.output, output, "utf8");
    console.log(args.output);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { buildHtml, renderMarkdown, extractVisualSections };
