import { ensureParentDir, readTextFileSafe, writeTextFile } from "./fsutil.ts";

export interface TaskState {
  seen: Record<string, string>;
}

export async function loadState(path: string): Promise<TaskState> {
  const raw = await readTextFileSafe(path);
  if (raw.trim().length === 0) {
    return { seen: {} };
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || typeof parsed.seen !== "object") {
      throw new Error("Invalid state file structure.");
    }
    return { seen: { ...parsed.seen } };
  } catch (error) {
    throw new Error(
      `Failed to parse state file "${path}": ${error instanceof Error ? error.message : error}`,
    );
  }
}

export async function saveState(path: string, state: TaskState): Promise<void> {
  await ensureParentDir(path);
  const serialized = JSON.stringify(state, null, 2);
  await writeTextFile(path, `${serialized}\n`);
}

export function markSeen(state: TaskState, hash: string, timestamp: string): void {
  state.seen[hash] = timestamp;
}
