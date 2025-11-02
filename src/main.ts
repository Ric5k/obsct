import { parseArgs } from "@std/cli/parse-args";
import { isAbsolute, join, resolve } from "@std/path";

import { buildHeading, formatTask } from "./formatter.ts";
import { normalizePath, readTextFileSafe, writeTextFile } from "./fsutil.ts";
import { createTaskHash } from "./hash.ts";
import { DEFAULT_EXTENSIONS, DEFAULT_PATTERNS, scanProject } from "./scanner.ts";
import { loadState, markSeen, saveState } from "./state.ts";

const DEFAULT_STATE_FILE = ".obs_task_state.json";

interface CLIArguments {
  command: string;
  projectDir: string;
  vaultDir: string;
  noteRelativePath: string;
  patterns: string[];
  extensions: string[];
  statePath: string;
}

if (import.meta.main) {
  run(Deno.args).catch((error) => {
    console.error(`[ERROR] ${error instanceof Error ? error.message : String(error)}`);
    Deno.exit(1);
  });
}

async function run(args: string[]): Promise<void> {
  const cli = parseArguments(args);
  if (cli.command !== "scan") {
    throw new Error(`Unsupported command "${cli.command}". Use "scan".`);
  }

  const projectDir = resolve(cli.projectDir);
  const vaultDir = resolve(cli.vaultDir);
  const notePath = normalizePath(join(vaultDir, cli.noteRelativePath));
  const statePath = resolveStatePath(cli.statePath, vaultDir);

  const state = await loadState(statePath);
  const now = new Date();
  const sectionLines = [buildHeading(now), ""];

  let discovered = 0;

  for await (
    const result of scanProject({
      rootDir: projectDir,
      patterns: cli.patterns,
      extensions: cli.extensions,
    })
  ) {
    const messageForHash = result.message.trim().length > 0
      ? result.message.trim()
      : result.pattern;
    const hash = await createTaskHash(result.filePath, result.line, messageForHash);
    if (state.seen[hash]) {
      continue;
    }

    discovered++;
    markSeen(state, hash, new Date().toISOString());

    const lines = formatTask({
      pattern: result.pattern,
      message: result.message,
      meta: result.meta,
      filePath: result.filePath,
      line: result.line,
      hash,
    });

    sectionLines.push(...lines, "");
  }

  if (discovered === 0) {
    console.log("No new comment tasks found.");
    return;
  }

  const section = finalizeSection(sectionLines);
  const existingNote = await readTextFileSafe(notePath);
  const merged = mergeNote(existingNote, section);
  await writeTextFile(notePath, merged);
  await saveState(statePath, state);

  console.log(`Appended ${discovered} task(s) to ${notePath}`);
}

function parseArguments(args: string[]): CLIArguments {
  const parsed = parseArgs(args, {
    string: ["patterns", "exts", "state"],
    boolean: ["help"],
    alias: {
      help: ["h"],
    },
  });

  if (parsed.help) {
    printHelp();
    Deno.exit(0);
  }

  const [command, projectDir, vaultDir, noteRelativePath] = parsed._.map(String);

  if (!command || !projectDir || !vaultDir || !noteRelativePath) {
    printHelp();
    throw new Error("Missing required arguments.");
  }

  return {
    command,
    projectDir,
    vaultDir,
    noteRelativePath,
    patterns: resolvePatterns(parsed.patterns),
    extensions: resolveExtensions(parsed.exts),
    statePath: typeof parsed.state === "string" ? parsed.state : DEFAULT_STATE_FILE,
  };
}

function printHelp(): void {
  console.log(`Usage:
  deno run -A src/main.ts scan <projectDir> <vaultDir> <notePath> [options]

Options:
  --patterns=<list>  Comma-separated keywords (default: ${DEFAULT_PATTERNS.join(", ")})
  --exts=<list>      Comma-separated extensions (default: ${DEFAULT_EXTENSIONS.join(", ")})
  --state=<path>     State file path (default: ${DEFAULT_STATE_FILE} relative to vaultDir)
  -h, --help         Show this help message

Examples:
  deno run -A src/main.ts scan ./examples/sample-project ~/Vault "Inbox/Code Tasks.md"
  deno compile -A -o obs-comment-tasks src/main.ts
`);
}

function resolvePatterns(input: string | string[] | undefined): string[] {
  if (!input || (Array.isArray(input) && input.length === 0)) {
    return Array.from(DEFAULT_PATTERNS);
  }
  const source = Array.isArray(input) ? input.join(",") : input;
  const parsed = source
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (parsed.length === 0) {
    return Array.from(DEFAULT_PATTERNS);
  }
  return parsed;
}

function resolveExtensions(input: string | string[] | undefined): string[] {
  if (!input || (Array.isArray(input) && input.length === 0)) {
    return Array.from(DEFAULT_EXTENSIONS);
  }
  const source = Array.isArray(input) ? input.join(",") : input;
  const parsed = source
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => (item.startsWith(".") ? item : `.${item}`));
  if (parsed.length === 0) {
    return Array.from(DEFAULT_EXTENSIONS);
  }
  return parsed;
}

function resolveStatePath(stateOption: string, vaultDir: string): string {
  if (stateOption.trim().length === 0) {
    return normalizePath(join(vaultDir, DEFAULT_STATE_FILE));
  }
  if (isAbsolute(stateOption)) {
    return normalizePath(stateOption);
  }
  return normalizePath(join(vaultDir, stateOption));
}

function finalizeSection(lines: string[]): string {
  const trimmed = [...lines];
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === "") {
    trimmed.pop();
  }
  trimmed.push("");
  return trimmed.join("\n");
}

function mergeNote(existing: string, section: string): string {
  const base = existing.trimEnd();
  if (base.length === 0) {
    return ensureTrailingNewline(section);
  }
  return `${base}\n\n${ensureTrailingNewline(section)}`;
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}
