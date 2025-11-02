const encoder = new TextEncoder();

export async function createTaskHash(
  relativePath: string,
  line: number,
  message: string,
): Promise<string> {
  const data = encoder.encode(`${relativePath}:${line}:${message}`);
  const digest = await crypto.subtle.digest("SHA-1", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 8);
}
