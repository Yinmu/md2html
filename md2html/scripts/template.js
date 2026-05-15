"use strict";

const { escapeHtml } = require("./parser");

const PALETTE = ["coral", "blue", "green", "gold", "violet", "cyan", "rose", "slate"];

function visualHtml(title, sections) {
  if (!sections.length) return "";
  const core = sections[0];
  const minimalCards = [];
  const refinedCards = [];
  sections.forEach((section, index) => {
    const tone = PALETTE[index % PALETTE.length];
    const number = String(index + 1).padStart(2, "0");
    minimalCards.push(`<a class="minimal-card ${tone}" href="#${section.slug}"><span>${number}</span><strong>${escapeHtml(section.title)}</strong><em>${escapeHtml(section.minimal)}</em></a>`);
    refinedCards.push(`<a class="idea-card ${tone}" href="#${section.slug}"><span class="idea-card__num">${number}</span><h3>${escapeHtml(section.title)}</h3><ul>${section.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul><p>${escapeHtml(section.quote)}</p></a>`);
  });

  return `
      <section class="map-core-section" id="visual-map" aria-label="Central thesis">
        <div class="map-core">
          <span>中心命题</span>
          <strong>${escapeHtml(title)}</strong>
          <em>${escapeHtml(core.minimal)}</em>
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
  const concepts = conceptSections.map((section) => `<article class="concept-card"><strong>${escapeHtml(section.cleanTitle)}</strong><p>${escapeHtml(section.minimal)}</p></article>`).join("");
  const questions = sections.slice(0, 5).map((section) => `<details class="quiz-item"><summary>${escapeHtml(section.question)}</summary><p>${escapeHtml(section.minimal)}</p></details>`).join("");
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

function renderTemplate({ title, body, sections, accent }) {
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
      ${visualHtml(title, sections)}
      ${learningHtml(sections)}
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

module.exports = { renderTemplate };
