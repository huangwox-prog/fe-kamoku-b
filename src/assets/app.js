// 答え合わせと回答履歴（localStorage）を扱うスクリプト。
(function () {
  'use strict';

  var STORAGE_KEY = 'fe-kamoku-b:history:v1';

  // localStorage はプライベートモード等で使えないことがあるので、必ず try/catch で囲む
  function loadHistory() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : {};
      return data && typeof data === 'object' ? data : {};
    } catch (e) {
      return {};
    }
  }

  function saveHistory(history) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      /* 保存できなくても答え合わせはそのまま動かす */
    }
  }

  // 画面中央に大きな ○ / × を一瞬表示する（表示後は要素ごと削除）
  function showJudgeMark(correct) {
    var old = document.querySelector('.judge-overlay');
    if (old) old.parentNode.removeChild(old);
    var overlay = document.createElement('div');
    overlay.className = 'judge-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    var mark = document.createElement('div');
    mark.className = 'judge-mark ' + (correct ? 'is-correct' : 'is-wrong');
    overlay.appendChild(mark);
    document.body.appendChild(overlay);
    function remove() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    mark.addEventListener('animationend', remove);
    setTimeout(remove, 1500); // animationend が来ない環境でも必ず消す
  }

  // ---- 問題ページ ----
  function setupQuestion(article) {
    var id = article.getAttribute('data-question-id');
    var answer = article.getAttribute('data-answer');
    var buttons = Array.prototype.slice.call(article.querySelectorAll('.choice'));
    var result = article.querySelector('[data-result]');
    var explanation = article.querySelector('[data-explanation]');
    var reset = article.querySelector('[data-reset]');

    function showResult(chosen) {
      var correct = chosen === answer;
      buttons.forEach(function (b) {
        var label = b.getAttribute('data-label');
        b.disabled = true;
        if (label === answer) b.classList.add('is-correct');
        else if (label === chosen) b.classList.add('is-wrong');
        else b.classList.add('is-dimmed');
      });
      result.textContent = correct ? '◯ 正解です！' : '✕ 不正解… 正解は「' + answer + '」です';
      result.className = 'result ' + (correct ? 'is-correct' : 'is-wrong');
      explanation.hidden = false;
      return correct;
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var chosen = button.getAttribute('data-label');
        var correct = showResult(chosen);
        showJudgeMark(correct);
        var history = loadHistory();
        history[id] = { choice: chosen, correct: correct, answeredAt: new Date().toISOString() };
        saveHistory(history);
        explanation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });

    reset.addEventListener('click', function () {
      buttons.forEach(function (b) {
        b.disabled = false;
        b.classList.remove('is-correct', 'is-wrong', 'is-dimmed');
      });
      result.textContent = '';
      result.className = 'result';
      explanation.hidden = true;
      buttons[0].focus();
    });
  }

  // ---- 一覧ページ：解いた問題に印を付ける ----
  function markSolved(history) {
    var items = document.querySelectorAll('[data-qid]');
    Array.prototype.forEach.call(items, function (item) {
      var record = history[item.getAttribute('data-qid')];
      var mark = item.querySelector('[data-solved-mark]');
      if (!record || !mark) return;
      mark.textContent = record.correct ? '✓ 正解' : '✕ 不正解';
      mark.classList.add(record.correct ? 'is-correct' : 'is-wrong');
    });
  }

  function showProgress(history) {
    var el = document.querySelector('[data-progress]');
    if (!el) return;
    var total = Number(el.getAttribute('data-total'));
    var answered = Object.keys(history).length;
    if (!answered) return;
    var correct = Object.keys(history).filter(function (k) { return history[k].correct; }).length;
    el.textContent = 'これまでに ' + answered + ' 問に回答（正解 ' + correct + ' 問）／全 ' + total + ' 問';
    el.hidden = false;
  }

  var history = loadHistory();
  var article = document.querySelector('[data-question-id]');
  if (article) setupQuestion(article);
  markSolved(history);
  showProgress(history);
})();
