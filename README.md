✅ One-Line Install (Deno)
deno install -A --name obsct https://raw.githubusercontent.com/<your-username>/obsct/main/src/main.ts


After that, run:

obsct scan <projectDir> <vaultDir> "<note>.md"

📌 README Section: Install via Deno (Copy-Paste Ready)

md

## 🧰 Install (Deno)

If you already use Deno, you can install **obsct** as a global CLI with a single command:

```bash
deno install -A --name obsct https://raw.githubusercontent.com/<your-username>/obsct/main/src/main.ts
```

This will install the obsct executable into your Deno bin directory (usually ~/.deno/bin).

Make sure the Deno bin directory is in your PATH.
If not, add it:

macOS / Linux
```bash
export PATH="$HOME/.deno/bin:$PATH"
```

✅ Usage
obsct scan ~/projects/my-app ~/Documents/obsidian-vault "Code Tasks.md"


Example comment:

// TODO: Improve error handling @p(high) @due(2025-02-20) @tags(cli,bug)


This will append a new task to the specified note inside your Obsidian vault — no Obsidian plugins required.

🧹 Uninstall
```bash
deno uninstall obsct
```