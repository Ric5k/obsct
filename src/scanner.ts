import { walk } from "@std/fs/walk";
import { basename, extname, relative, resolve } from "@std/path";

import { toPosixPath } from "./fsutil.ts";

export type Priority = "high" | "med" | "low";

export interface CommentMeta {
  due?: string;
  tags: string[];
  assignee?: string;
  priority?: Priority;
}

export interface ScanResult {
  pattern: string;
  message: string;
  meta: CommentMeta;
  filePath: string;
  line: number;
}

export interface ScanOptions {
  rootDir: string;
  patterns: string[];
  extensions: string[];
}

const LINE_MARKERS = ["//", "#", "--", ";"] as const;
const BLOCK_MARKERS = [
  { start: "/*", end: "*/" },
  { start: "<!--", end: "-->" },
] as const;

const EXCLUDED_DIRS = [/[/\\]node_modules[/\\]?/i, /[/\\]\.git[/\\]?/i];

export const DEFAULT_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".rs",
  ".py",
  ".go",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".php",
  ".sh",
  ".ps1",
  ".sql",
  ".ini",
  ".toml",
  ".yaml",
  ".yml",
  ".json",
  ".md",
  ".html",
  ".css",
] as const;

export const DEFAULT_PATTERNS = ["TODO", "FIXME", "NOTE"] as const;

interface ExtensionSets {
  withDot: Set<string>;
  bare: Set<string>;
}

interface ParsedComment {
  pattern: string;
  message: string;
  meta: CommentMeta;
}

interface BlockDescriptor {
  start: string;
  end: string;
}

export async function* scanProject(options: ScanOptions): AsyncGenerator<ScanResult> {
  const root = resolve(options.rootDir);
  const extensionSets = buildExtensionSets(options.extensions);
  const keywordPattern = createKeywordRegex(options.patterns);

  for await (
    const entry of walk(root, {
      includeDirs: false,
      followSymlinks: false,
      skip: EXCLUDED_DIRS,
    })
  ) {
    if (!matchesExtension(entry.path, extensionSets)) {
      continue;
    }

    let relativePath = toPosixPath(relative(root, entry.path));
    if (!relativePath || relativePath === "") {
      relativePath = basename(entry.path);
    }

    const content = await Deno.readTextFile(entry.path);
    yield* extractFromContent(content, {
      relativePath,
      keywordPattern,
      patterns: options.patterns,
    });
  }
}

function buildExtensionSets(extensions: string[]): ExtensionSets {
  const withDot = new Set<string>();
  const bare = new Set<string>();

  extensions
    .map((ext) => ext.trim())
    .filter((ext) => ext.length > 0)
    .forEach((ext) => {
      if (ext.startsWith(".")) {
        withDot.add(ext.toLowerCase());
        bare.add(ext.slice(1).toLowerCase());
      } else {
        withDot.add(`.${ext.toLowerCase()}`);
        bare.add(ext.toLowerCase());
      }
    });

  return { withDot, bare };
}

function matchesExtension(filePath: string, sets: ExtensionSets): boolean {
  const ext = extname(filePath).toLowerCase();
  if (ext.length > 0) {
    return sets.withDot.has(ext);
  }
  const name = basename(filePath).toLowerCase();
  return sets.bare.has(name);
}

interface ExtractContext {
  relativePath: string;
  keywordPattern: RegExp;
  patterns: string[];
}

function* extractFromContent(content: string, context: ExtractContext): Generator<ScanResult> {
  const lineOffsets = computeLineOffsets(content);
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    const lineText = lines[index];
    const trimmed = lineText.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const marker = resolveLineMarker(trimmed);
    if (!marker) {
      continue;
    }

    const rawBody = trimmed.slice(marker.length).trim();
    if (rawBody.length === 0) {
      continue;
    }

    const parsed = parseCommentBody(rawBody, context.keywordPattern);
    if (!parsed) {
      continue;
    }

    yield {
      pattern: parsed.pattern,
      message: parsed.message,
      meta: parsed.meta,
      filePath: context.relativePath,
      line: index + 1,
    };
  }

  for (const descriptor of BLOCK_MARKERS) {
    yield* extractFromBlock(content, descriptor, context, lineOffsets);
  }
}

function resolveLineMarker(trimmedLine: string): string | null {
  for (const marker of LINE_MARKERS) {
    if (!trimmedLine.startsWith(marker)) {
      continue;
    }
    if (marker === "--" && trimmedLine.startsWith("-->")) {
      continue;
    }
    if (marker === "#" && trimmedLine.startsWith("#!")) {
      continue;
    }
    return marker;
  }
  return null;
}

function* extractFromBlock(
  content: string,
  descriptor: BlockDescriptor,
  context: ExtractContext,
  lineOffsets: number[],
): Generator<ScanResult> {
  let cursor = 0;

  while (cursor < content.length) {
    const startIndex = content.indexOf(descriptor.start, cursor);
    if (startIndex === -1) {
      break;
    }

    const endIndex = content.indexOf(descriptor.end, startIndex + descriptor.start.length);
    if (endIndex === -1) {
      break;
    }

    const block = content.slice(startIndex + descriptor.start.length, endIndex);
    const blockLines = block.split(/\r?\n/);
    const startLine = indexToLine(startIndex, lineOffsets);

    for (let offset = 0; offset < blockLines.length; offset++) {
      const lineText = blockLines[offset];
      const sanitized = sanitizeBlockLine(lineText);
      if (!sanitized) {
        continue;
      }
      if (sanitized === descriptor.end) {
        continue;
      }
      const parsed = parseCommentBody(sanitized, context.keywordPattern);
      if (!parsed) {
        continue;
      }

      yield {
        pattern: parsed.pattern,
        message: parsed.message,
        meta: parsed.meta,
        filePath: context.relativePath,
        line: startLine + offset,
      };
    }

    cursor = endIndex + descriptor.end.length;
  }
}

function sanitizeBlockLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed || trimmed === "*" || trimmed === "*/" || trimmed === "-->") {
    return "";
  }
  return trimmed.replace(/^\*+\s*/, "").trim();
}

function createKeywordRegex(patterns: string[]): RegExp {
  const filtered = patterns.map((pattern) => pattern.trim()).filter((pattern) =>
    pattern.length > 0
  );
  const escaped = filtered.map((pattern) => pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^(${escaped.join("|")})\\b[:\\s-]*`, "i");
}

function parseCommentBody(body: string, keywordPattern: RegExp): ParsedComment | null {
  const match = keywordPattern.exec(body);
  if (!match) {
    return null;
  }

  const pattern = match[1].toUpperCase();
  const remainder = body.slice(match[0].length);
  const { meta, cleaned } = extractMeta(remainder);
  const message = cleaned.replace(/^[:\-–—\s]+/, "").trim();

  return {
    pattern,
    message,
    meta,
  };
}

function extractMeta(text: string): { meta: CommentMeta; cleaned: string } {
  let working = text;
  const meta: CommentMeta = {
    tags: [],
  };

  const dueMatch = findMeta(working, /@due\(([^)]+)\)/i);
  if (dueMatch) {
    meta.due = dueMatch.value.trim();
    working = removeToken(working, dueMatch.token);
  }

  const tagsMatch = findMeta(working, /@tags\(([^)]+)\)/i);
  if (tagsMatch) {
    meta.tags = tagsMatch.value.split(/[, ]+/).map((tag) => tag.trim()).filter((tag) =>
      tag.length > 0
    );
    working = removeToken(working, tagsMatch.token);
  } else {
    meta.tags = [];
  }

  const assigneeMatch = findMeta(working, /@assignee\(([^)]+)\)/i);
  if (assigneeMatch) {
    meta.assignee = assigneeMatch.value.trim();
    working = removeToken(working, assigneeMatch.token);
  }

  const priorityMatch = findMeta(working, /@p\(\s*(high|med|low)\s*\)/i);
  if (priorityMatch) {
    meta.priority = priorityMatch.value.toLowerCase() as Priority;
    working = removeToken(working, priorityMatch.token);
  }

  const cleaned = working.replace(/\s+/g, " ").trim();
  return { meta, cleaned };
}

interface MetaMatch {
  value: string;
  token: string;
}

function findMeta(source: string, regex: RegExp): MetaMatch | null {
  const match = regex.exec(source);
  if (!match) {
    return null;
  }
  return {
    value: match[1],
    token: match[0],
  };
}

function removeToken(source: string, token: string): string {
  return source.replace(token, " ");
}

function computeLineOffsets(content: string): number[] {
  const offsets: number[] = [0];
  for (let index = 0; index < content.length; index++) {
    if (content[index] === "\n") {
      offsets.push(index + 1);
    }
  }
  return offsets;
}

function indexToLine(position: number, offsets: number[]): number {
  let low = 0;
  let high = offsets.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const start = offsets[mid];
    const next = mid + 1 < offsets.length ? offsets[mid + 1] : Number.POSITIVE_INFINITY;

    if (position < start) {
      high = mid - 1;
    } else if (position >= next) {
      low = mid + 1;
    } else {
      return mid + 1;
    }
  }

  return offsets.length;
}
