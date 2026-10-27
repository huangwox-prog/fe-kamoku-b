'use strict';
// HTMLテンプレート。各関数がページ1枚分のHTML文字列を返す。

const fs = require('fs');
const path = require('path');

const PARTIALS_DIR = path.join(__dirname, 'partials');
const DIFFICULTY_LABELS = { 1: '易しい', 2: '普通', 3: '難しい' };

// ---- ユーティリティ ----

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 問題文・解説用のごく簡単な装飾: `コード` と **太字** だけを解釈する
function inline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// 文字列または文字列の配列を段落にする（文字列の場合は空行で区切る）
function paragraphs(value) {
  const list = Array.isArray(value) ? value : String(value).split(/\n\s*\n/);
  return list.map((p) => `<p>${inline(p.trim()).replace(/\n/g, '<br>')}</p>`).join('\n');
}

function plainText(value) {
  const text = Array.isArray(value) ? value.join(' ') : String(value);
  return text.replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// partials/*.html を読み込み、{{name}} を値で置き換える（先頭の説明コメントは除く）
const partialCache = {};
function partial(name, vars) {
  if (!(name in partialCache)) {
    partialCache[name] = fs.readFileSync(path.join(PARTIALS_DIR, `${name}.html`), 'utf8').replace(/^<!--[\s\S]*?-->\s*/, '');
  }
  return partialCache[name].replace(/\{\{(\w+)\}\}/g, (_, key) => esc(vars[key] ?? ''));
}

function stars(difficulty) {
  return `<span class="difficulty" title="難易度: ${DIFFICULTY_LABELS[difficulty]}" aria-label="難易度 ${difficulty}（${DIFFICULTY_LABELS[difficulty]}）">${'★'.repeat(difficulty)}<span class="difficulty-off">${'★'.repeat(3 - difficulty)}</span></span>`;
}

// ---- コンテキスト ----

function createContext({ config, categories, questions, assetVersions }) {
  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));
  return {
    config,
    categories,
    categoryById,
    questions,
    assetVersions,
    // サイト内リンク（ベースパス付き）
    url: (p = '') => config.basePath + p.replace(/^\//, ''),
    // 絶対URL（canonical / OGP / sitemap 用）
    absUrl: (p = '') => new URL(p.replace(/^\//, ''), config.baseUrl).toString(),
    asset: (name) => `${config.basePath}assets/${name}?v=${assetVersions[name]}`,
  };
}

// 広告枠。ads.enabled が false、または枠IDが未設定なら何も出力しない。
function adSlot(ctx, name) {
  const ads = ctx.config.ads;
  const slot = ads.enabled && ads.slots[name];
  return slot ? partial('ad-slot', { name, client: ads.client, slot }) : '';
}

// ---- 共通レイアウト ----

function layout(ctx, { title, description, path: pagePath, type = 'website', body, breadcrumbs = [], noindex = false }) {
  const { config } = ctx;
  const canonical = ctx.absUrl(pagePath);
  const ogImage = config.ogImage ? ctx.absUrl(config.ogImage) : '';
  const crumbs = breadcrumbs.length
    ? `<nav class="breadcrumbs" aria-label="パンくずリスト"><ol>${breadcrumbs
        .map((b) => (b.href ? `<li><a href="${esc(b.href)}">${esc(b.label)}</a></li>` : `<li aria-current="page">${esc(b.label)}</li>`))
        .join('')}</ol></nav>`
    : '';

  return `<!doctype html>
<html lang="${esc(config.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${esc(config.siteName)}">
<meta property="og:locale" content="ja_JP">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">\n` : ''}<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f7f6f2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16181d" media="(prefers-color-scheme: dark)">
<link rel="stylesheet" href="${ctx.asset('style.css')}">
${config.ads.enabled ? partial('ad-head', { client: config.ads.client }) : ''}</head>
<body>
<header class="site-header">
  <div class="container">
    <a class="site-title" href="${ctx.url()}">${esc(config.siteName)}</a>
  </div>
</header>
<main class="container">
${crumbs}
${body}
</main>
<footer class="site-footer">
  <div class="container">
    <p>掲載問題はすべてオリジナルです。実際の試験問題ではありません。</p>
    <p>&copy; ${new Date().getFullYear()} ${esc(config.siteName)}</p>
  </div>
</footer>
<script src="${ctx.asset('app.js')}" defer></script>
</body>
</html>
`;
}

// 問題一覧（トップ・分野ページ共通）。data-qid を目印に app.js が解答済みの印を付ける。
function questionList(ctx, questions, { showCategory = false } = {}) {
  if (!questions.length) return '<p class="empty">この分野の問題は準備中です。</p>';
  return `<ul class="q-list">
${questions
  .map((q) => {
    const cat = ctx.categoryById[q.category];
    return `<li class="q-item" data-qid="${esc(q.id)}">
  <a href="${ctx.url(`q/${q.id}/`)}">
    <span class="q-item-main">
      <span class="q-item-id">${esc(q.id)}</span>
      <span class="q-item-title">${esc(q.title)}</span>
    </span>
    <span class="q-item-meta">${showCategory ? `<span class="tag">${esc(cat.name)}</span>` : ''}${stars(q.difficulty)}<span class="solved-mark" data-solved-mark></span></span>
  </a>
</li>`;
  })
  .join('\n')}
</ul>`;
}

// ---- 各ページ ----

function homePage(ctx) {
  const { config, categories, questions } = ctx;
  const latest = [...questions]
    .sort((a, b) => (b.createdAt + b.id).localeCompare(a.createdAt + a.id))
    .slice(0, config.latestCount);
  const countByCat = (id) => questions.filter((q) => q.category === id).length;

  const body = `
<section class="hero">
  <h1>${esc(config.siteName)}</h1>
  <p>${esc(config.siteDescription)}</p>
  <p class="progress" data-progress data-total="${questions.length}" hidden></p>
</section>

<section>
  <h2>分野から選ぶ</h2>
  <ul class="cat-grid">
${categories
  .map(
    (c) => `    <li><a class="cat-card" href="${ctx.url(`c/${c.id}/`)}"><span class="cat-name">${esc(c.name)}</span><span class="cat-count">${countByCat(c.id)}問</span></a></li>`
  )
  .join('\n')}
  </ul>
</section>

<section>
  <h2>最新の問題</h2>
  ${questionList(ctx, latest, { showCategory: true })}
</section>
${adSlot(ctx, 'list-bottom')}`;

  return layout(ctx, {
    title: `${config.siteName}｜基本情報技術者試験 科目B オリジナル問題`,
    description: config.siteDescription,
    path: '',
    body,
  });
}

function categoryPage(ctx, cat) {
  const list = ctx.questions.filter((q) => q.category === cat.id);
  const body = `
<h1>${esc(cat.name)}</h1>
<p class="lead">${esc(cat.description)}</p>
<p class="muted">${list.length}問</p>
${questionList(ctx, list)}
${adSlot(ctx, 'list-bottom')}`;

  return layout(ctx, {
    title: `${cat.name}の問題一覧｜${ctx.config.siteName}`,
    description: `基本情報技術者試験 科目B「${cat.name}」のオリジナル問題一覧。${cat.description}`,
    path: `c/${cat.id}/`,
    noindex: list.length === 0,
    breadcrumbs: [{ label: 'トップ', href: ctx.url() }, { label: cat.name }],
    body,
  });
}

function traceTable(trace) {
  if (!trace) return '';
  return `<h3>トレース表</h3>
<div class="table-scroll" tabindex="0" role="region" aria-label="トレース表">
<table class="trace">
<thead><tr>${trace.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
<tbody>
${trace.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>
</div>`;
}

function questionPage(ctx, q, prev, next) {
  const cat = ctx.categoryById[q.category];
  const related = ctx.questions.filter((o) => o.category === q.category && o.id !== q.id).slice(0, 5);
  const description = truncate(q.description || plainText(q.statement), 120);

  const body = `
<article class="question" data-question-id="${esc(q.id)}" data-answer="${esc(q.answer)}">
  <header class="question-header">
    <p class="question-meta"><span class="q-item-id">${esc(q.id)}</span><a class="tag" href="${ctx.url(`c/${cat.id}/`)}">${esc(cat.name)}</a>${stars(q.difficulty)}</p>
    <h1>${esc(q.title)}</h1>
  </header>
  ${adSlot(ctx, 'question-top')}

  <section class="statement">
    ${paragraphs(q.statement)}
  </section>

  ${q.code ? `<div class="code-scroll" tabindex="0" role="region" aria-label="擬似言語のプログラム"><pre class="code"><code>${esc(q.code)}</code></pre></div>` : ''}

  <section class="choices-section">
    <h2 class="choices-heading">解答群</h2>
    <ol class="choices">
${q.choices
  .map(
    (c) => `      <li><button type="button" class="choice" data-label="${esc(c.label)}"><span class="choice-label">${esc(c.label)}</span><span class="choice-text">${inline(c.text)}</span></button></li>`
  )
  .join('\n')}
    </ol>
    <p class="result" data-result role="status" aria-live="polite"></p>
  </section>

  <section class="explanation" data-explanation hidden>
    <h2>解説</h2>
    <p class="answer-line">正解: <strong>${esc(q.answer)}</strong></p>
    ${paragraphs(q.explanation)}
    ${traceTable(q.trace)}
    <p><button type="button" class="reset-button" data-reset>もう一度解く</button></p>
  </section>
  <noscript><p class="muted">JavaScriptを有効にすると、選択肢を押して答え合わせができます。</p></noscript>
  ${adSlot(ctx, 'question-bottom')}
</article>

<nav class="pager" aria-label="前後の問題">
  ${prev ? `<a class="pager-link pager-prev" href="${ctx.url(`q/${prev.id}/`)}"><span class="pager-dir">← 前の問題</span><span class="pager-title">${esc(prev.title)}</span></a>` : '<span></span>'}
  ${next ? `<a class="pager-link pager-next" href="${ctx.url(`q/${next.id}/`)}"><span class="pager-dir">次の問題 →</span><span class="pager-title">${esc(next.title)}</span></a>` : '<span></span>'}
</nav>

<section class="related">
  <h2>同じ分野の問題（${esc(cat.name)}）</h2>
  ${related.length ? questionList(ctx, related) : '<p class="empty">この分野の他の問題は準備中です。</p>'}
  <p><a href="${ctx.url(`c/${cat.id}/`)}">「${esc(cat.name)}」の問題一覧へ →</a></p>
</section>`;

  return layout(ctx, {
    title: `${q.title}｜基本情報 科目B 演習`,
    description,
    path: `q/${q.id}/`,
    type: 'article',
    breadcrumbs: [{ label: 'トップ', href: ctx.url() }, { label: cat.name, href: ctx.url(`c/${cat.id}/`) }, { label: q.id }],
    body,
  });
}

function notFoundPage(ctx) {
  return layout(ctx, {
    title: `ページが見つかりません｜${ctx.config.siteName}`,
    description: 'お探しのページは見つかりませんでした。',
    path: '404.html',
    noindex: true,
    body: `<h1>ページが見つかりません</h1><p>URLが間違っているか、問題が削除された可能性があります。</p><p><a href="${ctx.url()}">トップページへ戻る</a></p>`,
  });
}

// ---- sitemap.xml / robots.txt / ads.txt ----

function sitemap(ctx) {
  const today = new Date().toISOString().slice(0, 10);
  const latest = ctx.questions.reduce((d, q) => ((q.updatedAt || q.createdAt) > d ? q.updatedAt || q.createdAt : d), '');
  const entries = [{ loc: ctx.absUrl(''), lastmod: latest || today }];
  for (const cat of ctx.categories) {
    const list = ctx.questions.filter((q) => q.category === cat.id);
    if (!list.length) continue;
    entries.push({ loc: ctx.absUrl(`c/${cat.id}/`), lastmod: list.reduce((d, q) => ((q.updatedAt || q.createdAt) > d ? q.updatedAt || q.createdAt : d), '') });
  }
  for (const q of ctx.questions) entries.push({ loc: ctx.absUrl(`q/${q.id}/`), lastmod: q.updatedAt || q.createdAt });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url><loc>${esc(e.loc)}</loc><lastmod>${e.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
}

function robots(ctx) {
  return `User-agent: *
Allow: /

Sitemap: ${ctx.absUrl('sitemap.xml')}
`;
}

function adsTxt(ctx) {
  const pub = ctx.config.ads.client.replace(/^ca-/, '');
  return `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`;
}

module.exports = { createContext, homePage, categoryPage, questionPage, notFoundPage, sitemap, robots, adsTxt };
