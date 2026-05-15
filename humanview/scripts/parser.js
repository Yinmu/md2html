"use strict";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function headingText(text) {
  return String(text)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#\[\]]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function inferTitle(text) {
  for (const line of String(text).split(/\r?\n/)) {
    const clean = line.trim().replace(/^#+\s*/, "").replace(/\s*#+$/, "").trim();
    if (clean) return clean.slice(0, 80);
  }
  return "Markdown Article";
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

function readingStats(text) {
  const cjk = String(text).match(/[\u4e00-\u9fff]/g) || [];
  const latin = String(text).match(/\b[A-Za-z0-9][A-Za-z0-9'-]*\b/g) || [];
  const units = cjk.length + latin.length;
  return { units, minutes: Math.max(1, Math.round(units / 450)) };
}

module.exports = {
  escapeHtml,
  headingText,
  inferTitle,
  isNumberedHeading,
  plainText,
  readingStats,
  renderMarkdown,
  slugify,
  splitBlocks
};
