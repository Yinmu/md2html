"use strict";

const {
  headingText,
  isNumberedHeading,
  plainText,
  slugify,
  splitBlocks
} = require("./parser");

const SUMMARY_KEYWORDS = [
  "不是", "而是", "因为", "所以", "关键", "真正", "价值", "机会",
  "门槛", "证明", "作品", "判断", "能力", "成本", "验证", "普通人",
  "未来", "本质", "核心", "名片", "做出来", "看见", "使用", "最",
  "才是", "不需要", "应该"
];

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
    [["ai", "成本"], "AI 降低制作门槛，但真正稀缺的是判断和取舍。"],
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
    const quote = bestQuote(section.title, paras);
    return {
      title: section.title,
      slug: section.slug,
      bullets: bullets.length ? bullets : ["这一节需要回到原文查看细节。"],
      quote,
      minimal: minimalSummary(section.title, bullets, quote),
      cleanTitle: cleanTitleForLearning(section.title),
      question: questionForSection(section.title),
      index: index + 1
    };
  });
}

module.exports = {
  cleanTitleForLearning,
  extractVisualSections,
  minimalSummary,
  questionForSection
};
