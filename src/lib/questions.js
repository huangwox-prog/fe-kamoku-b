'use strict';
// 問題JSON・分野定義・サイト設定の読み込みと、スキーマの検査をまとめたモジュール。
// verify.js と build.js の両方から使う。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const QUESTIONS_DIR = path.join(ROOT, 'data', 'questions');
const CATEGORIES_FILE = path.join(ROOT, 'data', 'categories.json');
const CONFIG_FILE = path.join(ROOT, 'site.config.json');

const STATUSES = ['draft', 'verified', 'reviewed', 'archived'];
const ID_PATTERN = /^B-[a-z0-9-]+-\d{3}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadConfig() {
  return readJson(CONFIG_FILE);
}

function loadCategories() {
  return readJson(CATEGORIES_FILE);
}

// data/questions/*.json を読み込む。JSONとして壊れているファイルは errors に入れる。
function loadQuestions() {
  const files = fs.readdirSync(QUESTIONS_DIR).filter((f) => f.endsWith('.json')).sort();
  const questions = [];
  const errors = [];
  for (const file of files) {
    try {
      const q = readJson(path.join(QUESTIONS_DIR, file));
      q._file = file;
      questions.push(q);
    } catch (e) {
      errors.push({ id: file, reason: `JSONの読み込みに失敗: ${e.message}` });
    }
  }
  return { questions, errors };
}

const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isTextOrList = (v) => isText(v) || (Array.isArray(v) && v.length > 0 && v.every(isText));

// 1問分のスキーマ検査。問題点の文字列を配列で返す（空なら問題なし）。
function validateQuestion(q, categoryIds) {
  const p = [];
  if (!isText(q.id) || !ID_PATTERN.test(q.id)) p.push('id は "B-分野-001" の形式で指定してください');
  if (q._file && q.id && q._file !== `${q.id}.json`) p.push(`ファイル名 ${q._file} が id と一致しません`);
  if (!isText(q.title)) p.push('title がありません');
  if (!categoryIds.includes(q.category)) p.push(`category "${q.category}" は data/categories.json に定義されていません`);
  if (![1, 2, 3].includes(q.difficulty)) p.push('difficulty は 1〜3 の整数で指定してください');
  if (!STATUSES.includes(q.status)) p.push(`status は ${STATUSES.join(' / ')} のいずれかです`);
  if (!DATE_PATTERN.test(q.createdAt || '')) p.push('createdAt は YYYY-MM-DD 形式で指定してください');
  if (q.updatedAt !== undefined && !DATE_PATTERN.test(q.updatedAt)) p.push('updatedAt は YYYY-MM-DD 形式で指定してください');
  if (q.description !== undefined && !isText(q.description)) p.push('description が空です');
  if (!isTextOrList(q.statement)) p.push('statement（問題文）がありません');
  if (q.code !== undefined && typeof q.code !== 'string') p.push('code は文字列で指定してください');
  if (!Array.isArray(q.choices) || q.choices.length < 2) {
    p.push('choices は2つ以上必要です');
  } else {
    const labels = q.choices.map((c) => c && c.label);
    if (q.choices.some((c) => !c || !isText(c.label) || typeof c.text !== 'string')) p.push('choices の各要素には label と text が必要です');
    if (new Set(labels).size !== labels.length) p.push('choices の label が重複しています');
    if (!labels.includes(q.answer)) p.push(`answer "${q.answer}" が choices の label にありません`);
  }
  if (!isTextOrList(q.explanation)) p.push('explanation（解説）がありません');
  if (q.trace !== undefined) {
    const t = q.trace;
    if (!t || !Array.isArray(t.columns) || !Array.isArray(t.rows)) {
      p.push('trace は { columns: [...], rows: [[...], ...] } の形式です');
    } else if (t.rows.some((r) => !Array.isArray(r) || r.length !== t.columns.length)) {
      p.push('trace.rows の各行の列数が columns と一致しません');
    }
  }
  if (!q.verify || typeof q.verify.code !== 'string' || q.verify.expected === undefined) {
    p.push('verify は { code: "...", expected: "..." } の形式です');
  }
  return p;
}

module.exports = { ROOT, STATUSES, loadConfig, loadCategories, loadQuestions, validateQuestion };
