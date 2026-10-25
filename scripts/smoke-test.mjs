import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const releasePackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const releaseVersions = JSON.parse(fs.readFileSync("versions.json", "utf8"));
const main = fs.readFileSync("src/main.ts", "utf8");
const text = fs.readFileSync("src/text.ts", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

const assertions = [
  [manifest.id === "txt-viewer", "manifest id is txt-viewer"],
  [manifest.version === releasePackage.version && /^\d+\.\d+\.\d+$/.test(manifest.version) && releaseVersions[manifest.version] === manifest.minAppVersion, "release version matches package and supported app version"],
  [!/obsidian/i.test(manifest.description), "manifest description avoids product name"],
  [main.includes("registerExtensions(TXT_EXTENSIONS"), "txt extension is registered"],
  [main.includes("type ViewMode = \"text\" | \"filtered\""), "text/filter modes exist"],
  [main.includes("visibleFilteredLines(analysis.lines, this.query)"), "filter mode uses original line numbers"],
  [main.includes("this.app.vault.read(this.file)"), "refresh reads through vault API"],
  [text.includes("RENDER_LINE_LIMIT = 10000"), "render cap exists"],
  [text.includes("MATCH_RENDER_LIMIT = 1000"), "filtered match cap exists"],
  [text.includes("detectLineEnding"), "line ending detection exists"],
  [text.includes("detectBinaryText"), "binary warning detection exists"],
  [!main.includes("navigator.clipboard") && !text.includes("navigator.clipboard"), "no clipboard access"],
  [!main.includes("fetch(") && !text.includes("fetch("), "no fetch usage"],
  [!main.includes("XMLHttpRequest") && !text.includes("XMLHttpRequest"), "no XMLHttpRequest usage"],
  [!main.includes("WebSocket") && !text.includes("WebSocket"), "no WebSocket usage"],
  [!main.includes("eval(") && !text.includes("eval("), "no eval usage"],
  [!main.includes("new Function") && !text.includes("new Function"), "no Function constructor usage"],
  [!styles.includes("!important"), "styles do not use important overrides"],
];

const failures = assertions.filter(([passes]) => !passes).map(([, label]) => label);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  process.exit(1);
}

console.log("TXT Viewer smoke checks passed.");
