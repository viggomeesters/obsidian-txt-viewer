import assert from "node:assert/strict";
import fs from "node:fs";
import esbuild from "esbuild";

await esbuild.build({
  bundle: true,
  entryPoints: ["src/text.ts"],
  format: "esm",
  outfile: ".tmp-text-test.mjs",
  platform: "node",
  target: "node20",
});

const {
  RENDER_LINE_LIMIT,
  analyzeText,
  detectBinaryText,
  detectLineEnding,
  filterLines,
  findMatches,
  splitLines,
  visibleFilteredLines,
} = await import(new URL("../.tmp-text-test.mjs", import.meta.url));

function readFixture(name) {
  return fs.readFileSync(new URL(`../test-fixtures/${name}`, import.meta.url), "utf8");
}

const empty = analyzeText(readFixture("empty.txt"));
assert.equal(empty.lineCount, 0);
assert.equal(empty.lineEnding, "empty");

const simple = analyzeText(readFixture("simple.txt"));
assert.equal(simple.lineCount, 4);
assert.equal(simple.renderedLines[0].number, 1);
assert.equal(simple.lineEnding, "LF");

const longLine = analyzeText(readFixture("long-line.txt"));
assert.equal(longLine.lineCount, 2);
assert.ok(longLine.renderedLines[0].text.length > 180);

assert.equal(detectLineEnding("a\r\nb\r\n"), "CRLF");
assert.equal(detectLineEnding("a\rb\r"), "CR");
assert.equal(detectLineEnding("a\nb\r\nc"), "mixed");

const unicode = analyzeText(readFixture("unicode.txt"));
assert.ok(unicode.byteCount > unicode.characterCount);

const matches = findMatches(splitLines("Alpha\nbeta alpha\nGamma"), "alpha");
assert.equal(matches.length, 2);
assert.equal(matches[0].lineNumber, 1);
assert.equal(matches[1].ranges[0].start, 5);

const filtered = filterLines(splitLines("Alpha\nbeta alpha\nGamma"), "alpha");
assert.deepEqual(filtered.map((line) => line.number), [1, 2]);

const largeText = Array.from({ length: RENDER_LINE_LIMIT + 5 }, (_, index) => `line ${index}`).join("\n");
const large = analyzeText(largeText);
assert.equal(large.renderedLines.length, RENDER_LINE_LIMIT);
assert.equal(large.skippedLines, 5);
assert.ok(large.warnings.some((warning) => warning.label === "Render cap"));

const manyMatches = visibleFilteredLines(splitLines(largeText), "line");
assert.equal(manyMatches.lines.length, 1000);
assert.ok(manyMatches.skippedMatches > 0);

const binary = readFixture("binary-looking.txt");
assert.equal(detectBinaryText(binary), true);
assert.equal(analyzeText(binary).isProbablyBinary, true);

fs.rmSync(new URL("../.tmp-text-test.mjs", import.meta.url));
console.log("TXT Viewer text fixture tests passed.");
