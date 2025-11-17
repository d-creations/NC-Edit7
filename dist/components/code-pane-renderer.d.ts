import type { ChannelState } from "../domain/models.js";
export interface CodePaneRenderResult {
    title: string;
    lineCountLabel: string;
    errorCountLabel: string;
    summaryText: string;
    contentHtml: string;
}
export declare function buildCodePaneRenderResult(state: ChannelState, channelId: string): CodePaneRenderResult;
//# sourceMappingURL=code-pane-renderer.d.ts.map