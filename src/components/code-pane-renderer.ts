import type { ChannelState } from "../domain/models.js";

type LineInfo = {
  lineNumber: number;
  text: string;
  hasError: boolean;
};

export interface CodePaneRenderResult {
  title: string;
  lineCountLabel: string;
  errorCountLabel: string;
  summaryText: string;
  contentHtml: string;
}

export function buildCodePaneRenderResult(state: ChannelState, channelId: string): CodePaneRenderResult {
  const parsedLines = state.parseResult?.lines ?? [];
  const errors = state.errors ?? [];

  const lineInfos: LineInfo[] = parsedLines.map((line) => ({
    lineNumber: line.lineNumber,
    text: line.rawLine.trim() || "(blank)",
    hasError: errors.some((error) => error.lineNumber === line.lineNumber),
  }));

  const contentHtml = lineInfos
    .map((line) => {
      const errorClass = line.hasError ? " error" : "";
      return `
        <div class="line${errorClass}" aria-label="Line ${line.lineNumber}">
          <span class="line-number${errorClass}">${line.lineNumber}</span>
          <span class="line-text${errorClass}">${line.text}</span>
        </div>
      `;
    })
    .join("\n");

  const parsedAt = state.parseResult?.summary.parsedAt;
  const summaryText = parsedAt ? `last parsed ${new Date(parsedAt).toLocaleTimeString()}` : "not parsed yet";

  return {
    title: `Channel ${channelId}`,
    lineCountLabel: `${parsedLines.length} lines`,
    errorCountLabel: `${errors.length} errors`,
    summaryText,
    contentHtml,
  };
}
