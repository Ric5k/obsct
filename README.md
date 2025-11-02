# obs-comment-tasks

Deno 製 CLI でコードコメント中の TODO/FIXME/NOTE をスキャンし、Obsidian Vault
内の指定ノートにタスク形式で追記します。Obsidian
側にプラグインを追加せず、コメントに含めたメタ情報を整理したチェックボックスタスクを生成します。

## できること

- `scan <projectDir> <vaultDir> <notePath>` コマンド 1 つで対象リポジトリを走査
- 行/ブロックコメントの両方に対応（`//`, `#`, `--`, `;`, `/* ... */`, `<!-- ... -->`）
- メタトークン `@due(YYYY-MM-DD)`, `@tags(a,b)`, `@assignee(name)`, `@p(high|med|low)` を抽出
- ハッシュ管理（`relativePath + line + message`）で重複タスクを抑止
- 追記ブロックは `## Imported from comments (ISO8601)` 見出し配下に整形
- 優先度記号: `high=⏫`, `med=🔼`, `low=🔽`

## セットアップ

```sh
deno task build
```

もしくは開発用に:

```sh
deno task dev
```

`deno.json` には `jsr:@std/*` への import map と `dev` / `build` タスクが定義されています。

## 使い方

```sh
deno run -A src/main.ts scan <projectDir> <vaultDir> <notePath> \
  [--patterns=TODO,FIXME,NOTE] \
  [--exts=.ts,.py,.rs] \
  [--state=.obs_task_state.json]
```

- `<projectDir>`: コメントを走査するディレクトリ
- `<vaultDir>`: Obsidian Vault ルート
- `<notePath>`: Vault からの相対パス（例: `"Inbox/Code Tasks.md"`）
- `--patterns`: コメント先頭で検出するキーワード（既定値: `TODO,FIXME,NOTE`）
- `--exts`: 解析対象ファイル拡張子（既定値: `.ts,.tsx,...,.css`）
- `--state`: ハッシュ状態ファイル。相対パスは `<vaultDir>` 基準（既定値: `.obs_task_state.json`）

### 出力例

```
## Imported from comments (2024-05-18T10:42:10.123Z)
⏫ Replace legacy auth flow @riku 📅 2025-11-10 #backend #infra
src/app/auth.ts:123  [hash:1bc2a7f4]
```

1 回の実行で追加されたタスクは同一 ISO
時刻の見出し配下にまとまります。状態ファイルに記録されたハッシュは次回以降スキップされ、同じコメントが二重で登録されません。

## サンプル

`examples/sample-project/` には簡単な TypeScript / Python
ファイルが入っており、以下のように動作確認できます。

```sh
deno run -A src/main.ts scan ./examples/sample-project ./examples/vault "Inbox/Code Tasks.md"
```

このコマンドは `examples/vault/Inbox/Code Tasks.md` に追記し、状態を
`examples/vault/.obs_task_state.json` に保存します。

## テスト

```sh
deno test -A
```

## 注意事項

- 解析対象外ディレクトリ: `node_modules`, `.git`
- 大規模リポジトリでも `Deno.walk` を使った逐次処理のためメモリ負荷を抑制
- 解析対象ファイルのパス区切りは POSIX 形式に統一して出力
- 例外発生時は非 0 終了で `[ERROR] ...` ログを表示します
