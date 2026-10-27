# 基本情報 科目B 演習

基本情報技術者試験 科目B のオリジナル問題を、スマホで1問ずつ解ける静的サイトです。
フレームワークや npm パッケージは使わず、HTML / CSS / JavaScript と Node.js のスクリプトだけで動きます。

## フォルダ構成

```
data/
  categories.json        分野の一覧（名前・説明）
  questions/*.json       問題（1問1ファイル）→ スキーマは docs/question-schema.md
src/
  render.js              ページのHTMLテンプレート
  lib/questions.js       問題の読み込みとスキーマ検査
  partials/              広告枠などの差し込み用パーシャル
  assets/                style.css / app.js（そのまま dist/assets にコピー）
site.config.json         サイト名・ベースURL・広告の ON/OFF など
verify.js                問題の検証スクリプト
build.js                 dist/ に静的HTMLを生成するスクリプト
serve.js                 dist/ をローカルで見るための簡易サーバ
.github/workflows/       GitHub Pages への自動公開
```

## よく使うコマンド

| コマンド | 内容 |
|---|---|
| `node verify.js` | 全問題を検証（失敗すると一覧を出して終了コード 1） |
| `node verify.js B-loop-001` | 指定した問題だけ検証 |
| `node build.js` | `site.config.json` の `baseUrl` で `dist/` を生成 |
| `npm run dev` | 検証 → ローカル用にビルド → http://localhost:8080/ で表示 |

## 生成されるページ

- `/` トップ（サイト説明・分野別の問題数・最新の問題）
- `/c/{分野ID}/` 分野別一覧
- `/q/{問題ID}/` 問題ページ
- `/sitemap.xml`, `/robots.txt`, `/404.html`

回答履歴はブラウザの localStorage（キー `fe-kamoku-b:history:v1`）に保存され、一覧で解いた問題に「✓ 正解 / ✕ 不正解」が付きます。

## 設定（site.config.json）

- `baseUrl` … サイトのURL。canonical・OGP・sitemap に使います。
  GitHub Actions では自動で GitHub Pages のURLに上書きされるので、普段は変更不要です。
- `publishStatuses` … 公開する status（既定: `verified`, `reviewed`）
- `ads` … 広告設定（下記）

### 独自ドメインにするとき

1. GitHub の Settings → Pages → Custom domain にドメインを入力し、DNS を設定
2. Settings → Secrets and variables → Actions → **Variables** に `SITE_BASE_URL` = `https://あなたのドメイン/` を追加
3. もう一度 main に push（または Actions 画面から再実行）

※ `robots.txt` はドメイン直下にあるときだけ検索エンジンに読まれます。`ユーザー名.github.io/リポジトリ名/` の形のURLでは効果がないので、独自ドメイン化してから有効になります。

### Google AdSense を付けるとき

1. `site.config.json` の `ads.enabled` を `true`、`ads.client` を自分の `ca-pub-...` にする
2. `ads.slots` に、AdSense で作った広告ユニットの ID を入れる（空のままの枠は出力されません）
   - `question-top` … 問題ページのタイトル下
   - `question-bottom` … 問題ページの解説の下
   - `list-bottom` … トップ・分野一覧の下
3. ビルドすると、全ページの `<head>` に AdSense のタグが入り、`ads.txt` も自動生成されます

広告のHTMLは `src/partials/ad-slot.html` と `src/partials/ad-head.html` で変更できます。
