# project-hub — PROGRESS.md
最終更新: 2026-03-22

## 完了タスク
- [x] project-hub プロジェクト作成（aggregate.js + dashboard UI + .project-meta.yaml スキーマ）
- [x] 集約スクリプト（scripts/aggregate.js）— GitHub API + ローカルスキャン対応
- [x] ダッシュボードUI（public/index.html）— カード一覧・検索・フィルター・AIエクスポート・URL一覧テーブル・AI Tactリンク
- [x] 全27プロジェクトに .project-meta.yaml 配置（ending-note詳細含む）
- [x] GitHub Actions ワークフロー（15分スケジュール + push時）有効化・PROJECT_HUB_TOKENシークレット設定
- [x] GitHub push + Vercelデプロイ完了（https://project-hub-seven-lime.vercel.app/）
- [x] Vercel不要プロジェクト9件削除（38→29）
- [x] project-registry.yaml のending-noteエントリを最新状態に大幅更新

## 残タスク
- [ ] 静的サイト7件のGitHub Pages移行（quality-rulebook, algorithm-review, ending-note-proposal, internnect-map, onboarding-okamura, claude-code-internals, internnect-hp）
- [ ] カスタムドメイン projects.internnect.ai 設定
- [ ] 全URL疎通テスト（Vercel残留 + 移行済み）
- [ ] ending-noteの施設導入メリット壁打ち（他AIへのエクスポート利用）

## ブロッカー
- なし

## 次セッションでやるべきこと
1. 静的サイト7件のGitHub Pages移行
2. projects.internnect.ai ドメイン設定
3. 全URL疎通テスト
4. ending-note施設導入の企画壁打ち

## 判明した仕様・制約
- Vercel Hobbyプランで38プロジェクトは多すぎた（重複・壊れた設定がビルドエラーの原因）
- gh CLIのOAuthトークンにworkflowスコープがデフォルトでない（gh auth refreshで追加が必要）
- project-hubは静的HTML+JSONなのでVercel/GitHub Pagesどちらでも可
- brand-osのVercelプロジェクトは実はMedIA-Opsの統合クライアント管理（削除禁止）
