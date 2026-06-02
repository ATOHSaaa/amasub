# アマサブ（Amasub）

Kindle Unlimited・Audibleを中心に、Amazonサブスクの選び方・活用法を発信するブログメディアです。

- **本番URL:** https://amasub.tateku.net
- **技術:** [Astro](https://astro.build/)（静的サイト）+ GitHub Pages

## 開発

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/ + Pagefind インデックス
npm run preview  # ビルド結果のプレビュー（検索含む）
```

Node.js 20 以上を推奨（CI は 22）。

## 記事の追加

`src/content/posts/` に Markdown を追加します。

**SEO・文体**は [docs/seo-article-guide.md](docs/seo-article-guide.md)、**Amazon公式情報（料金・確認手順など）**は [docs/amazon-official-reference.md](docs/amazon-official-reference.md) を参照してください。AI 執筆時は両方＋（任意で）SERP 分析レポートを使います（`.cursor/rules/seo-article-writing.mdc`）。

### SERP競合分析（DuckDuckGo）

```bash
npm run research -- "三体 Kindle Unlimited"
```

上位ページの見出し構造を分析し、`research/` に Markdown / JSON レポートを出力します。記事執筆前の構成設計に使います。

### 記事の追加（手順）

```markdown
---
title: '記事タイトル'
description: 'メタ説明文'
pubDate: 2026-06-01
services:
  - kindle-unlimited   # または audible
tags:
  - 比較
cta: kindle-unlimited # 省略時は services から自動。both | none も可
draft: false
---

本文...
```

- ファイル名が URL になります（例: `ku-vs-audible.md` → `/posts/ku-vs-audible/`）
- 記事末尾には **CTA** と **アソシエイト表記** が自動挿入されます

## 環境変数

`.env.example` を `.env` にコピーして設定してください。

| 変数 | 用途 |
|------|------|
| `PUBLIC_GA4_MEASUREMENT_ID` | Google Analytics 4 |
| `PUBLIC_CLARITY_PROJECT_ID` | Microsoft Clarity |
| `PUBLIC_AMAZON_ASSOCIATE_TAG` | アソシエイト tag（`amasubweb-22`） |
| `AMAZON_CREATORS_API_*` | Creators API（ビルド時の商品取得用・任意） |

GitHub Actions では **Repository variables** に同名で登録してください。

## GitHub Pages の初回設定

1. リポジトリ `amasub` を GitHub に push
2. **Settings → Pages → Build and deployment**
   - Source: **GitHub Actions**
3. DNS（`amasub.tateku.net`）で CNAME を GitHub Pages に向ける  
   - `public/CNAME` にドメインを記載済み
4. リポジトリ Variables に GA4 / Clarity / アソシエイト tag を設定
5. `main` へ push で自動デプロイ

## Amazon Creators API

`src/lib/creators-api.ts` にクライアントの骨組みがあります。  
[Creators API](https://affiliate.amazon.co.jp/creatorsapi) の公式仕様に合わせてエンドポイント・署名を更新し、ビルド時に商品情報を取得する運用を想定しています。

静的ホスティングのため、API キーは **ビルド環境（GitHub Actions secrets）のみ** に置き、ブラウザへは露出させないでください。

## ライセンス

コンテンツ・コードの権利は運営者に帰属します。無断転載を禁じます。
