# project-hub — PROGRESS.md
最終更新: 2026-03-22

## 完了タスク
- [x] project-hub プロジェクト作成（aggregate.js + dashboard UI + .project-meta.yaml スキーマ）
- [x] 集約スクリプト（scripts/aggregate.js）— GitHub API + ローカルスキャン対応
- [x] ダッシュボードUI（public/index.html）— カード一覧・検索・フィルター・AIエクスポート・URL一覧テーブル・AI Tactリンク
- [x] 全27プロジェクトに .project-meta.yaml 配置（ending-note詳細含む）
- [x] GitHub Actions ワークフロー（15分スケジュール + push時）有効化・PROJECT_HUB_TOKENシークレット設定
- [x] GitHub push + Vercelデプロイ完了
- [x] Vercel不要プロジェクト9件削除（38→29）
- [x] project-registry.yaml のending-noteエントリを最新状態に大幅更新
- [x] 静的サイト7件のGitHub Pages移行完了
  - quality-rulebook → https://ryuichi-gt.github.io/quality-rulebook/
  - algorithm-review → https://ryuichi-gt.github.io/algorithm-review/
  - ending-note-proposal → https://ryuichi-gt.github.io/ending-note-proposal/
  - internnect-map → https://ryuichi-gt.github.io/internnect-map/
  - onboarding-okamura → https://ryuichi-gt.github.io/onboarding-okamura/
  - claude-code-internals → https://ryuichi-gt.github.io/claude-code-internals/
  - internnect-hp → https://ryuichi-gt.github.io/internnect-hp/（Next.js静的エクスポート）
- [x] Vercel 7件削除済み（29→22プロジェクト）
- [x] project-hub 再デプロイ成功（https://project-hub-orcin-three.vercel.app/）
- [x] Vercelドメイン projects.internnect.ai 追加済み
- [x] 全URL疎通テスト完了（GitHub Pages 7/7 OK、Vercel 22件確認済み）

## 残タスク
- [ ] CloudflareでDNSレコード追加: `projects CNAME cname.vercel-dns.com`（internnect.aiゾーン）
- [ ] projects.internnect.ai の疎通確認（DNS設定後）
- [ ] ending-noteの施設導入メリット壁打ち（他AIへのエクスポート利用）

## ブロッカー
- Cloudflare APIトークンが未設定のため、DNSレコードをCLIから追加できない
- Cloudflareダッシュボード（https://dash.cloudflare.com/ → internnect.ai → DNS）から手動設定が必要

## 次セッションでやるべきこと
1. CloudflareでDNSレコード追加後、projects.internnect.ai疎通確認
2. ending-note施設導入の企画壁打ち

## GitHub Pagesサイト一覧
| プロジェクト | URL | リポジトリ |
|---|---|---|
| quality-rulebook | https://ryuichi-gt.github.io/quality-rulebook/ | ryuichi-gt/quality-rulebook |
| algorithm-review | https://ryuichi-gt.github.io/algorithm-review/ | ryuichi-gt/algorithm-review |
| ending-note-proposal | https://ryuichi-gt.github.io/ending-note-proposal/ | ryuichi-gt/ending-note-proposal |
| internnect-map | https://ryuichi-gt.github.io/internnect-map/ | ryuichi-gt/internnect-map |
| onboarding-okamura | https://ryuichi-gt.github.io/onboarding-okamura/ | ryuichi-gt/onboarding-okamura |
| claude-code-internals | https://ryuichi-gt.github.io/claude-code-internals/ | ryuichi-gt/claude-code-internals |
| internnect-hp | https://ryuichi-gt.github.io/internnect-hp/ | ryuichi-gt/internnect-hp |

## 判明した仕様・制約
- Vercel Hobbyプランで38プロジェクトは多すぎた（重複・壊れた設定がビルドエラーの原因）
- gh CLIのOAuthトークンにworkflowスコープがデフォルトでない（gh auth refreshで追加が必要）
- project-hubは静的HTML+JSONなのでVercel/GitHub Pagesどちらでも可
- brand-osのVercelプロジェクトは実はMedIA-Opsの統合クライアント管理（削除禁止）
- GitHub Free プランではプライベートリポジトリでGitHub Pagesが使えない → パブリックに変更して対応
- internnect-hpはNext.js（App Router）だが、output:'export'で静的エクスポート可能
- Cloudflare APIトークンが未設定 → DNSレコード追加にはダッシュボード操作が必要
