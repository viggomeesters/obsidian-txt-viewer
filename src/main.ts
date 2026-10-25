import {
  Notice,
  Plugin,
  TFile,
  TextFileView,
  WorkspaceLeaf,
  setIcon,
} from "obsidian";
import {
  SearchMatch,
  TextAnalysis,
  TextLine,
  analyzeText,
  findMatches,
  visibleFilteredLines,
} from "./text";

const VIEW_TYPE_TXT_VIEWER = "txt-viewer";
const TXT_EXTENSIONS = ["txt"];

type ViewMode = "text" | "filtered";

export default class TxtViewerPlugin extends Plugin {
  async onload(): Promise<void> {
    this.registerView(
      VIEW_TYPE_TXT_VIEWER,
      (leaf) => new TxtViewerView(leaf),
    );
    this.registerExtensions(TXT_EXTENSIONS, VIEW_TYPE_TXT_VIEWER);

    this.addCommand({
      id: "open-current-txt-in-viewer",
      name: "Open current TXT file in viewer",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!isTxtFile(file)) return false;

        if (!checking) {
          void this.openTxtFile(file);
        }
        return true;
      },
    });
  }

  async openTxtFile(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.setViewState({
      type: VIEW_TYPE_TXT_VIEWER,
      state: { file: file.path },
      active: true,
    });
  }
}

class TxtViewerView extends TextFileView {
  private query = "";
  private mode: ViewMode = "text";
  private wrapLines = true;
  private activeMatchIndex = 0;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_TXT_VIEWER;
  }

  getDisplayText(): string {
    return this.file?.basename ?? "TXT viewer";
  }

  getIcon(): string {
    return "file-text";
  }

  setViewData(data: string): void {
    this.data = data;
    this.render();
  }

  getViewData(): string {
    return this.data;
  }

  clear(): void {
    this.data = "";
    this.contentEl.empty();
  }

  private render(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass("txt-viewer");

    const header = container.createDiv({ cls: "txt-viewer__header" });
    this.renderTitle(header);

    const analysis = analyzeText(this.data);
    const matches = findMatches(analysis.lines, this.query);
    if (this.activeMatchIndex >= matches.length) {
      this.activeMatchIndex = Math.max(0, matches.length - 1);
    }

    this.renderToolbar(header, matches);

    if (!this.file) {
      renderMessage(container, "No TXT file is attached to this viewer.");
      return;
    }

    if (!isTxtFile(this.file)) {
      renderMessage(container, "This viewer only supports .txt files.");
      return;
    }

    renderSummary(container, analysis, this.wrapLines, this.mode, matches, this.query);
    renderWarnings(container, analysis);

    if (analysis.lineCount === 0) {
      renderMessage(container, "This file is empty.");
      return;
    }

    this.renderText(container, analysis, matches);
  }

  private renderTitle(parent: HTMLElement): void {
    const title = parent.createDiv({ cls: "txt-viewer__title" });
    title.createDiv({
      cls: "txt-viewer__filename",
      text: this.file?.name ?? "TXT file",
    });
    title.createDiv({
      cls: "txt-viewer__path",
      text: this.file?.path ?? "",
    });
  }

  private renderToolbar(parent: HTMLElement, matches: SearchMatch[]): void {
    const toolbar = parent.createDiv({ cls: "txt-viewer__toolbar" });

    const searchWrap = toolbar.createDiv({ cls: "txt-viewer__search" });
    setIcon(searchWrap.createSpan({ cls: "txt-viewer__search-icon" }), "search");
    const searchInput = searchWrap.createEl("input", {
      attr: {
        "aria-label": "Search text",
        placeholder: "Search",
        spellcheck: "false",
        type: "search",
        value: this.query,
      },
    });
    searchInput.addEventListener("input", () => {
      this.query = searchInput.value;
      this.activeMatchIndex = 0;
      this.render();
    });

    const matchCounter = toolbar.createDiv({
      cls: "txt-viewer__match-count",
      text: matchCountLabel(matches, this.activeMatchIndex, this.query),
    });
    matchCounter.setAttribute("aria-live", "polite");

    const previousButton = createIconButton(toolbar, "chevron-up", "Previous match");
    previousButton.disabled = matches.length === 0;
    previousButton.addEventListener("click", () => {
      this.activeMatchIndex = previousIndex(this.activeMatchIndex, matches.length);
      this.render();
    });

    const nextButton = createIconButton(toolbar, "chevron-down", "Next match");
    nextButton.disabled = matches.length === 0;
    nextButton.addEventListener("click", () => {
      this.activeMatchIndex = nextIndex(this.activeMatchIndex, matches.length);
      this.render();
    });

    const modeGroup = toolbar.createDiv({
      cls: "txt-viewer__segmented",
      attr: { "aria-label": "View mode" },
    });
    const textButton = createTextButton(modeGroup, "Text");
    const filterButton = createTextButton(modeGroup, "Filter");
    textButton.toggleClass("is-active", this.mode === "text");
    filterButton.toggleClass("is-active", this.mode === "filtered");

    textButton.addEventListener("click", () => {
      this.mode = "text";
      this.render();
    });
    filterButton.addEventListener("click", () => {
      this.mode = "filtered";
      this.render();
    });

    const wrapButton = createIconButton(toolbar, "wrap-text", this.wrapLines ? "Disable soft wrap" : "Enable soft wrap");
    wrapButton.toggleClass("is-active", this.wrapLines);
    wrapButton.addEventListener("click", () => {
      this.wrapLines = !this.wrapLines;
      this.render();
    });

    const refreshButton = createIconButton(toolbar, "refresh-cw", "Refresh file");
    refreshButton.addEventListener("click", () => {
      void this.reloadFile();
    });
  }

  private renderText(parent: HTMLElement, analysis: TextAnalysis, matches: SearchMatch[]): void {
    const body = parent.createDiv({
      cls: `txt-viewer__body ${this.wrapLines ? "is-wrapped" : "is-nowrap"}`,
    });
    const pre = body.createEl("pre", { cls: "txt-viewer__pre" });

    const activeLineNumber = matches[this.activeMatchIndex]?.lineNumber;
    const rangeMap = rangesByLine(matches);
    const lines = this.linesForMode(analysis);

    if (lines.length === 0) {
      renderMessage(parent, "No lines match the current filter.");
      return;
    }

    for (const line of lines) {
      const isActive = activeLineNumber === line.number;
      const lineEl = pre.createDiv({
        cls: `txt-viewer__line${isActive ? " is-active-match" : ""}`,
        attr: { "data-line": String(line.number) },
      });
      lineEl.createSpan({
        cls: "txt-viewer__line-number",
        text: String(line.number),
      });
      const code = lineEl.createSpan({ cls: "txt-viewer__code" });
      renderLineText(code, line.text, rangeMap.get(line.number) ?? []);

      if (isActive) {
        this.contentEl.win.requestAnimationFrame(() => {
          lineEl.scrollIntoView({ block: "center" });
        });
      }
    }
  }

  private linesForMode(analysis: TextAnalysis): TextLine[] {
    if (this.mode === "text") return analysis.renderedLines;
    if (!this.query.trim()) return analysis.renderedLines;
    return visibleFilteredLines(analysis.lines, this.query).lines;
  }

  private async reloadFile(): Promise<void> {
    if (!this.file) {
      new Notice("No TXT file to refresh");
      return;
    }

    try {
      this.data = await this.app.vault.read(this.file);
      this.render();
    } catch (error) {
      this.contentEl.empty();
      this.contentEl.addClass("txt-viewer");
      renderMessage(this.contentEl, `Unable to read file: ${getErrorMessage(error)}`);
    }
  }
}

function renderSummary(
  parent: HTMLElement,
  analysis: TextAnalysis,
  wrapLines: boolean,
  mode: ViewMode,
  matches: SearchMatch[],
  query: string,
): void {
  const summary = parent.createDiv({ cls: "txt-viewer__summary" });
  summary.createSpan({ cls: "txt-viewer__pill", text: `${analysis.lineCount} lines` });
  summary.createSpan({ cls: "txt-viewer__pill", text: `${analysis.characterCount} chars` });
  summary.createSpan({ cls: "txt-viewer__pill", text: `${analysis.byteCount} bytes` });
  summary.createSpan({ cls: "txt-viewer__pill", text: `${analysis.lineEnding} endings` });
  summary.createSpan({ cls: "txt-viewer__pill", text: wrapLines ? "wrap on" : "wrap off" });
  summary.createSpan({ cls: "txt-viewer__pill", text: mode === "filtered" ? "filter mode" : "text mode" });
  if (query.trim()) {
    summary.createSpan({ cls: "txt-viewer__note", text: `${matches.length} matching lines` });
  }
  if (analysis.skippedLines > 0) {
    summary.createSpan({
      cls: "txt-viewer__note",
      text: `${analysis.renderedLines.length} lines rendered`,
    });
  }
  if (mode === "filtered" && query.trim()) {
    const filtered = visibleFilteredLines(analysis.lines, query);
    if (filtered.skippedMatches > 0) {
      summary.createSpan({
        cls: "txt-viewer__note",
        text: `${filtered.skippedMatches} matching lines hidden`,
      });
    }
  }
}

function renderWarnings(parent: HTMLElement, analysis: TextAnalysis): void {
  if (analysis.warnings.length === 0) return;

  const box = parent.createDiv({ cls: "txt-viewer__warnings" });
  box.createDiv({ cls: "txt-viewer__warnings-title", text: "Text warnings" });
  analysis.warnings.slice(0, 12).forEach((warning) => {
    box.createDiv({
      cls: "txt-viewer__warning",
      text: `${warning.label}: ${warning.message}`,
    });
  });
  if (analysis.warnings.length > 12) {
    box.createDiv({
      cls: "txt-viewer__warning-more",
      text: `${analysis.warnings.length - 12} additional warnings hidden`,
    });
  }
}

function renderLineText(parent: HTMLElement, text: string, ranges: Array<{ start: number; end: number }>): void {
  if (ranges.length === 0) {
    parent.createSpan({ text });
    return;
  }

  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      parent.createSpan({ text: text.slice(cursor, range.start) });
    }
    parent.createSpan({
      cls: "txt-viewer__match",
      text: text.slice(range.start, range.end),
    });
    cursor = range.end;
  }
  if (cursor < text.length) {
    parent.createSpan({ text: text.slice(cursor) });
  }
}

function rangesByLine(matches: SearchMatch[]): Map<number, Array<{ start: number; end: number }>> {
  const map = new Map<number, Array<{ start: number; end: number }>>();
  matches.forEach((match) => {
    map.set(match.lineNumber, match.ranges);
  });
  return map;
}

function matchCountLabel(matches: SearchMatch[], activeIndex: number, query: string): string {
  if (!query.trim()) return "No search";
  if (matches.length === 0) return "0 matches";
  return `${activeIndex + 1} / ${matches.length}`;
}

function previousIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return index <= 0 ? length - 1 : index - 1;
}

function nextIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return index >= length - 1 ? 0 : index + 1;
}

function createIconButton(parent: HTMLElement, icon: string, label: string): HTMLButtonElement {
  const button = parent.createEl("button", {
    cls: "clickable-icon txt-viewer__button",
    attr: { "aria-label": label, title: label, type: "button" },
  });
  setIcon(button, icon);
  return button;
}

function createTextButton(parent: HTMLElement, label: string): HTMLButtonElement {
  return parent.createEl("button", {
    cls: "txt-viewer__text-button",
    text: label,
    attr: { type: "button" },
  });
}

function renderMessage(parent: HTMLElement, message: string): void {
  parent.createDiv({ cls: "txt-viewer__message", text: message });
}

function isTxtFile(file: TFile | null): file is TFile {
  return Boolean(file && TXT_EXTENSIONS.includes(file.extension.toLowerCase()));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
