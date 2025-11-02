import { assertEquals } from "jsr:@std/assert@0.224.0/assert-equals";

import { DEFAULT_EXTENSIONS, DEFAULT_PATTERNS, scanProject } from "../src/scanner.ts";

Deno.test("scanProject extracts TODO with metadata", async () => {
  const tempDir = await Deno.makeTempDir();

  try {
    const filePath = `${tempDir}/main.ts`;
    await Deno.writeTextFile(
      filePath,
      `// TODO Fix login flow @due(2024-10-01) @tags(auth,bug) @assignee(riku) @p(high)
function placeholder() {
  return true;
}
`,
    );

    const results = [];
    for await (
      const result of scanProject({
        rootDir: tempDir,
        patterns: Array.from(DEFAULT_PATTERNS),
        extensions: Array.from(DEFAULT_EXTENSIONS),
      })
    ) {
      results.push(result);
    }

    assertEquals(results.length, 1);
    const [task] = results;
    assertEquals(task.pattern, "TODO");
    assertEquals(task.message, "Fix login flow");
    assertEquals(task.meta.due, "2024-10-01");
    assertEquals(task.meta.assignee, "riku");
    assertEquals(task.meta.priority, "high");
    assertEquals(task.meta.tags, ["auth", "bug"]);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
