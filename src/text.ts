export const RENDER_LINE_LIMIT = 10000;
export const MATCH_RENDER_LIMIT = 1000;

export type LineEndingKind = "empty" | "LF" | "CRLF" | "CR" | "mixed";

export interface TextLine {
  number: number;
  text: string;
}

export interface MatchRange {
  start: number;
  end: number;
}

export interface SearchMatch {
  lineNumber: number;
  ranges: MatchRange[];
}

export interface TextWarning {
  label: string;
  message: string;
}

export interface TextAnalysis {
  lines: TextLine[];
  renderedLines: TextLine[];
  skippedLines: number;
  lineCount: number;
  characterCount: number;
  byteCount: number;
  lineEnding: LineEndingKind;
  warnings: TextWarning[];
  isProbablyBinary: boolean;
}

export function analyzeText(data: string): TextAnalysis {
  const lines = splitLines(data);
  const warnings: TextWarning[] = [];
  const lineEnding = detectLineEnding(data);
  const byteCount = new TextEncoder().encode(data).length;
  const isProbablyBinary = detectBinaryText(data);
  const renderedLines = lines.slice(0, RENDER_LINE_LIMIT);
  const skippedLines = Math.max(0, lines.length - renderedLines.length);

  if (skippedLines > 0) {
    warnings.push({
      label: "Render cap",
      message: `${skippedLines} lines are not rendered to keep the view responsive.`,
    });
  }

  if (lineEnding === "mixed") {
    warnings.push({
      label: "Mixed line endings",
      message: "This file contains more than one line ending style.",
    });
  }

  if (isProbablyBinary) {
    warnings.push({
      label: "Possible binary content",
      message: "This file contains many control characters. It is rendered as text, but it may not be a plain text file.",
    });
  }

  return {
    lines,
    renderedLines,
    skippedLines,
    lineCount: data.length === 0 ? 0 : lines.length,
    characterCount: data.length,
    byteCount,
    lineEnding,
    warnings,
    isProbablyBinary,
  };
}

export function findMatches(lines: TextLine[], query: string): SearchMatch[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const matches: SearchMatch[] = [];
  for (const line of lines) {
    const ranges: MatchRange[] = [];
    const lower = line.text.toLowerCase();
    let index = lower.indexOf(needle);
    while (index >= 0) {
      ranges.push({ start: index, end: index + needle.length });
      index = lower.indexOf(needle, index + Math.max(needle.length, 1));
    }
    if (ranges.length > 0) {
      matches.push({ lineNumber: line.number, ranges });
    }
  }
  return matches;
}

export function filterLines(lines: TextLine[], query: string): TextLine[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return lines;
  return lines.filter((line) => line.text.toLowerCase().includes(needle));
}

export function visibleFilteredLines(lines: TextLine[], query: string): {
  lines: TextLine[];
  skippedMatches: number;
} {
  const filtered = filterLines(lines, query);
  return {
    lines: filtered.slice(0, MATCH_RENDER_LIMIT),
    skippedMatches: Math.max(0, filtered.length - MATCH_RENDER_LIMIT),
  };
}

export function splitLines(data: string): TextLine[] {
  if (data.length === 0) return [];
  const parts = data.split(/\r\n|\n|\r/);
  if (/\r\n$|\n$|\r$/.test(data)) {
    parts.pop();
  }
  return parts.map((text, index) => ({
    number: index + 1,
    text,
  }));
}

export function detectLineEnding(data: string): LineEndingKind {
  if (data.length === 0) return "empty";

  const crlfCount = countMatches(data, /\r\n/g);
  const withoutCrlf = data.replace(/\r\n/g, "");
  const lfCount = countMatches(withoutCrlf, /\n/g);
  const crCount = countMatches(withoutCrlf, /\r/g);
  const kinds = [crlfCount > 0, lfCount > 0, crCount > 0].filter(Boolean).length;

  if (kinds === 0) return "LF";
  if (kinds > 1) return "mixed";
  if (crlfCount > 0) return "CRLF";
  if (lfCount > 0) return "LF";
  return "CR";
}

export function detectBinaryText(data: string): boolean {
  if (data.length === 0) return false;

  let suspicious = 0;
  const sample = data.slice(0, 4096);
  for (let index = 0; index < sample.length; index += 1) {
    const code = sample.charCodeAt(index);
    const allowedWhitespace = code === 9 || code === 10 || code === 13;
    const control = code < 32 || code === 127;
    if (control && !allowedWhitespace) suspicious += 1;
  }
  return suspicious > 0 && suspicious / sample.length > 0.02;
}

function countMatches(data: string, pattern: RegExp): number {
  return data.match(pattern)?.length ?? 0;
}
