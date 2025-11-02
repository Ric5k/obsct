import type { CommentMeta } from "./scanner.ts";

export interface FormattableTask {
  pattern: string;
  message: string;
  meta: CommentMeta;
  filePath: string;
  line: number;
  hash: string;
}

const PRIORITY_ICONS: Record<Required<CommentMeta>["priority"], string> = {
  high: "⏫",
  med: "🔼",
  low: "🔽",
};

const DEFAULT_ICON = "•";

export function buildHeading(date: Date): string {
  return `## Imported from comments (${date.toISOString()})`;
}

export function formatTask(task: FormattableTask): string[] {
  const icon = task.meta.priority ? PRIORITY_ICONS[task.meta.priority] : DEFAULT_ICON;
  const firstLineParts: string[] = [`${icon}`, ensureMessage(task)];

  if (task.meta.assignee) {
    firstLineParts.push(`@${task.meta.assignee}`);
  }

  if (task.meta.due) {
    firstLineParts.push(`📅 ${task.meta.due}`);
  }

  if (task.meta.tags.length > 0) {
    const tags = task.meta.tags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ");
    firstLineParts.push(tags);
  }

  const firstLine = firstLineParts.join(" ").replace(/\s+/g, " ").trim();
  const secondLine = `${task.filePath}:${task.line}  [hash:${task.hash}]`;

  return [firstLine, secondLine];
}

function ensureMessage(task: Pick<FormattableTask, "message" | "pattern">): string {
  const trimmed = task.message.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }
  return task.pattern;
}
