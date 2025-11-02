import { dirname, isAbsolute, join, resolve } from "@std/path";

export function toPosixPath(path: string): string {
  return path.replace(/\\/g, "/");
}

export function resolvePath(base: string, target: string): string {
  if (isAbsolute(target)) {
    return normalizePath(target);
  }
  return normalizePath(resolve(base, target));
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

export async function ensureParentDir(path: string): Promise<void> {
  const parent = dirname(path);
  if (!parent || parent === "." || parent === path) {
    return;
  }
  await Deno.mkdir(parent, { recursive: true });
}

export async function readTextFileSafe(path: string): Promise<string> {
  try {
    return await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return "";
    }
    throw error;
  }
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  await ensureParentDir(path);
  await Deno.writeTextFile(path, content);
}

export function joinPath(base: string, relativePath: string): string {
  return normalizePath(join(base, relativePath));
}
