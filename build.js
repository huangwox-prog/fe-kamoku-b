#!/usr/bin/env node
'use strict';
// 問題JSONから静的サイトを dist/ に生成するビルドスクリプト。
//
// 使い方:
//   node build.js                                  … site.config.json の baseUrl で生成
//   node build.js --base-url http://localhost:8080/ … ベースURLを上書き（ローカル確認用）
//   環境変数 SITE_BASE_URL でも上書きできる（GitHub Actions で使用）

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT, loadConfig, loadCategories, loadQuestions, validateQuestion } = require('./src/lib/questions');
const render = require('./src/render');

const DIST = path.join(ROOT, 'dist');
const ASSETS_SRC = path.join(ROOT, 'src', 'assets');

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function normalizeBaseUrl(url) {
  const u = new URL(url);
  if (!u.pathname.endsWith('/')) u.pathname += '/';
  return u.toString();
}

function writeFile(relPath, content) {
  const file = path.join(DIST, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function main() {
  const config = loadConfig();
  config.baseUrl = normalizeBaseUrl(argValue('--base-url') || process.env.SITE_BASE_URL || config.baseUrl);
  config.basePath = new URL(config.baseUrl).pathname;

  const categories = loadCategories();
  const categoryIds = categories.map((c) => c.id);
  const { questions: all, errors } = loadQuestions();
  if (errors.length) {
    errors.forEach((e) => console.error(`[${e.id}] ${e.reason}`));
    process.exit(1);
  }

  // 公開対象は status が publishStatuses（既定: verified / reviewed）の問題だけ
  const published = [];
  for (const q of all) {
    if (!config.publishStatuses.includes(q.status)) continue;
    const problems = validateQuestion(q, categoryIds);
    if (problems.length) {
      console.error(`[${q.id}] スキーマエラーのため中止します:\n  ${problems.join('\n  ')}`);
      process.exit(1);
    }
    published.push(q);
  }
  published.sort((a, b) => a.id.localeCompare(b.id));

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // CSS/JS をコピーし、キャッシュ対策としてファイル内容のハッシュを ?v= に付ける
  const assetVersions = {};
  for (const name of fs.readdirSync(ASSETS_SRC)) {
    const buf = fs.readFileSync(path.join(ASSETS_SRC, name));
    writeFile(path.join('assets', name), buf);
    assetVersions[name] = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
  }

  const ctx = render.createContext({ config, categories, questions: published, assetVersions });

  writeFile('index.html', render.homePage(ctx));
  for (const cat of categories) {
    writeFile(path.join('c', cat.id, 'index.html'), render.categoryPage(ctx, cat));
  }
  published.forEach((q, i) => {
    writeFile(path.join('q', q.id, 'index.html'), render.questionPage(ctx, q, published[i - 1], published[i + 1]));
  });
  writeFile('404.html', render.notFoundPage(ctx));
  writeFile('sitemap.xml', render.sitemap(ctx));
  writeFile('robots.txt', render.robots(ctx));
  writeFile('.nojekyll', '');
  if (config.ads.enabled) writeFile('ads.txt', render.adsTxt(ctx));

  const skipped = all.length - published.length;
  console.log(`✓ ${published.length} 問を公開して dist/ に出力しました（非公開 ${skipped} 問）`);
  console.log(`  ベースURL: ${config.baseUrl}`);
}

main();
