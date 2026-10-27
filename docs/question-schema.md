# 問題JSONのスキーマ（仮）

問題は `data/questions/{id}.json` に 1問1ファイルで置きます。ファイル名は `id` と同じにしてください。
見本は [`data/questions/B-loop-001.json`](../data/questions/B-loop-001.json) です。

> このスキーマは仮の設計です。手元に別のサンプルJSONがあれば、それに合わせて変更します。

| 項目 | 必須 | 型 | 説明 |
|---|---|---|---|
| `id` | ○ | 文字列 | `B-{分野}-{3桁番号}`（例: `B-loop-001`）。URL `/q/{id}/` になる |
| `title` | ○ | 文字列 | 問題タイトル。ページの title は「{title}｜基本情報 科目B 演習」 |
| `category` | ○ | 文字列 | 分野ID。`data/categories.json` の `id` のどれか |
| `difficulty` | ○ | 1〜3 | 難易度（1: 易しい / 2: 普通 / 3: 難しい）。★で表示 |
| `status` | ○ | 文字列 | `draft` / `verified` / `reviewed` / `archived`。**公開されるのは `verified` と `reviewed` だけ**（`site.config.json` の `publishStatuses` で変更可） |
| `createdAt` | ○ | `YYYY-MM-DD` | 作成日。トップの「最新の問題」の並び順に使う |
| `updatedAt` |  | `YYYY-MM-DD` | 更新日。sitemap.xml の lastmod に使う（なければ createdAt） |
| `description` |  | 文字列 | meta description / OGP の説明文（120字程度）。なければ問題文の先頭から作る |
| `statement` | ○ | 文字列 or 文字列の配列 | 問題文。配列の1要素が1段落 |
| `code` |  | 文字列 | 擬似言語のプログラム。改行は `\n`、インデントは半角スペース |
| `choices` | ○ | 配列 | 解答群。`[{ "label": "ア", "text": "9" }, ...]` |
| `answer` | ○ | 文字列 | 正解の `label`（例: `"イ"`） |
| `explanation` | ○ | 文字列 or 文字列の配列 | 解説 |
| `trace` |  | オブジェクト | トレース表。`{ "columns": ["i", "s"], "rows": [["1", "0"], ...] }`。各行の列数は columns と同じ |
| `verify` | ○ | オブジェクト | 検証用。`{ "code": "...", "expected": "18" }` |

## 文中の装飾

`statement`・`explanation`・`choices[].text` では次の2つだけ使えます（HTMLは書けません）。

- `` `calc` `` → インラインコード
- `**イ**` → 太字

## verify（検証コード）の書き方

`verify.code` は JavaScript の **関数の本体** として実行され、`return` した値が結果になります。

```js
function calc(n) { let s = 0; for (let i = 1; i <= n; i++) if (i % 3 === 0) s += i; return s; }
return calc(10);
```

`node verify.js` は次の2点を確認します。

1. 実行結果が `verify.expected` と一致する（文字列にして比較。配列などは JSON 文字列で比較）
2. `verify.expected` が、`answer` の選択肢の `text` と一致する

選択肢の text が `"18"` のように値そのものではない問題（例: 「s が 18 になる」）では、
`expected` と選択肢 text を一致させる必要があるので、`return` で選択肢の文字列そのものを返すように書きます。
