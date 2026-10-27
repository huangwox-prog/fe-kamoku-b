#!/usr/bin/env node
'use strict';
// 全問題の検証スクリプト。
//   1. スキーマ検査（必須項目・answer が choices にあるか など）
//   2. verify.code を実行し、戻り値が verify.expected と一致するか
//   3. verify.expected が、answer の選択肢の text と一致するか
// 1つでも失敗があれば一覧を出力して終了コード 1 で終わる。
//
// 使い方: node verify.js            … 全問題
//         node verify.js B-loop-001 … 指定した問題だけ

const vm = require('vm');
const { loadCategories, loadQuestions, validateQuestion } = require('./src/lib/questions');

const TIMEOUT_MS = 2000;

// verify.code は「関数の本体」として実行し、return した値を結果とする。
// require や process には触れない、隔離された環境で動かす。
function runVerifyCode(code) {
  const sandbox = vm.createContext({});
  const script = new vm.Script(`(function () {\n${code}\n})()`, { filename: 'verify.code' });
  return script.runInContext(sandbox, { timeout: TIMEOUT_MS });
}

// 比較は文字列化して行う（配列やオブジェクトは JSON にする）
function normalize(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function main() {
  const only = process.argv.slice(2);
  const categoryIds = loadCategories().map((c) => c.id);
  const { questions, errors: loadErrors } = loadQuestions();
  const failures = [...loadErrors];
  const seen = new Set();
  let checked = 0;

  for (const q of questions) {
    if (only.length && !only.includes(q.id)) continue;
    checked++;
    const id = q.id || q._file;
    const fail = (reason) => failures.push({ id, reason });

    if (seen.has(q.id)) fail('id が他の問題と重複しています');
    seen.add(q.id);

    const problems = validateQuestion(q, categoryIds);
    if (problems.length) {
      problems.forEach(fail);
      if (!q.verify || typeof q.verify.code !== 'string') continue;
    }

    let actual;
    try {
      actual = normalize(runVerifyCode(q.verify.code));
    } catch (e) {
      fail(`verify.code の実行エラー: ${e.message}`);
      continue;
    }
    const expected = normalize(q.verify.expected);
    if (actual !== expected) {
      fail(`実行結果 "${actual}" が verify.expected "${expected}" と一致しません`);
    }
    const answerChoice = Array.isArray(q.choices) && q.choices.find((c) => c && c.label === q.answer);
    if (answerChoice && normalize(answerChoice.text) !== expected) {
      fail(`verify.expected "${expected}" が正解の選択肢（${q.answer}: "${answerChoice.text}"）と一致しません`);
    }
  }

  if (only.length && checked === 0) {
    console.error(`指定された問題が見つかりません: ${only.join(', ')}`);
    process.exit(1);
  }

  if (failures.length) {
    console.error(`\n✗ 検証に失敗しました（${failures.length} 件）\n`);
    for (const f of failures) console.error(`  [${f.id}] ${f.reason}`);
    console.error('');
    process.exit(1);
  }
  console.log(`✓ ${checked} 問すべて検証に成功しました`);
}

main();
