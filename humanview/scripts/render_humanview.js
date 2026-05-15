#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const { inferTitle, readingStats, renderMarkdown } = require("./parser");
const { extractVisualSections } = require("./summarize");
const { renderTemplate } = require("./template");

function buildLearningModel(source, titleOverride, accent = "#2563eb") {
  const initialTitle = titleOverride || inferTitle(source);
  const rendered = renderMarkdown(source, initialTitle, true);
  const title = titleOverride || rendered.title;
  const sections = extractVisualSections(source, title, rendered.headings);
  const stats = readingStats(source);
  return {
    title,
    body: rendered.body,
    headings: rendered.headings,
    sections,
    stats,
    accent
  };
}

function buildHtml(source, titleOverride, accent = "#2563eb") {
  return renderTemplate(buildLearningModel(source, titleOverride, accent));
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
  if (!args.input || !args.output) {
    throw new Error("Usage: node scripts/render_humanview.js input.md output.html [--title \"Title\"] [--accent \"#2563eb\"]");
  }
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

module.exports = { buildHtml, buildLearningModel };
