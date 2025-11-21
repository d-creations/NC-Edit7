/**
 * NCKeywordPanel - Displays keywords and sync codes from parsed NC program
 */

import { BaseComponent } from './BaseComponent';
import { getServiceRegistry } from '@core/ServiceRegistry';
import { SERVICE_TOKENS, type ChannelId, type KeywordEntry } from '@core/types';
import type { StateService } from '@services/StateService';
import type { EventBus } from '@services/EventBus';

export class NCKeywordPanel extends BaseComponent {
  private channelId!: ChannelId;
  private stateService!: StateService;
  private eventBus!: EventBus;
  private keywords: KeywordEntry[] = [];
  private selectedKeyword: KeywordEntry | null = null;

  static get observedAttributes() {
    return ['channel-id'];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;

    if (name === 'channel-id') {
      this.channelId = newValue;
      this.loadKeywords();
    }
  }

  protected onConnected(): void {
    const registry = getServiceRegistry();
    this.stateService = registry.get<StateService>(SERVICE_TOKENS.StateService);
    this.eventBus = registry.get<EventBus>(SERVICE_TOKENS.EventBus);

    this.channelId = this.getAttribute('channel-id') || 'channel-1';

    this.setupEventListeners();
    this.loadKeywords();
  }

  private setupEventListeners(): void {
    this.eventBus.on('parse:completed', (event) => {
      const payload = event.payload as {
        channelId: ChannelId;
        artifacts: { keywords: KeywordEntry[] };
      };
      if (payload.channelId === this.channelId) {
        this.keywords = payload.artifacts.keywords;
        this.requestRender();
      }
    });

    this.eventBus.on('editor:selection-changed', (event) => {
      const payload = event.payload as { channelId: ChannelId; line: number };
      if (payload.channelId === this.channelId) {
        // Clear selection when cursor moves
        this.selectedKeyword = null;
        this.requestRender();
      }
    });
  }

  private loadKeywords(): void {
    if (!this.channelId || !this.stateService) return;

    const channel = this.stateService.getChannel(this.channelId);
    if (channel?.parseArtifacts) {
      this.keywords = channel.parseArtifacts.keywords;
      this.requestRender();
    }
  }

  private handleKeywordClick(keyword: KeywordEntry): void {
    this.selectedKeyword = keyword;

    // Emit event to scroll editor to this line
    this.eventBus.emit({
      type: 'keyword:clicked',
      timestamp: Date.now(),
      payload: {
        channelId: this.channelId,
        keyword: keyword.keyword,
        lineNumber: keyword.lineNumber,
      },
    });

    this.requestRender();
  }

  protected render(): void {
    this.shadow.innerHTML = '';
    this.shadow.appendChild(this.createStyles(this.getStyles()));

    const container = document.createElement('div');
    container.className = 'nc-keyword-panel';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.textContent = 'Keywords & Sync Codes';
    container.appendChild(header);

    if (this.keywords.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No keywords found. Enter NC code in the editor.';
      container.appendChild(empty);
    } else {
      const list = document.createElement('div');
      list.className = 'keyword-list';

      // Group keywords by type
      const grouped = this.groupKeywords(this.keywords);

      for (const [group, items] of Object.entries(grouped)) {
        if (items.length === 0) continue;

        const groupHeader = document.createElement('div');
        groupHeader.className = 'group-header';
        groupHeader.textContent = group;
        list.appendChild(groupHeader);

        items.forEach((keyword) => {
          const item = document.createElement('div');
          item.className = 'keyword-item';
          if (this.selectedKeyword === keyword) {
            item.classList.add('selected');
          }

          const keywordText = document.createElement('span');
          keywordText.className = 'keyword-text';
          keywordText.textContent = keyword.keyword;

          const lineNumber = document.createElement('span');
          lineNumber.className = 'line-number';
          lineNumber.textContent = `L${keyword.lineNumber}`;

          item.appendChild(keywordText);
          item.appendChild(lineNumber);

          item.addEventListener('click', () => {
            this.handleKeywordClick(keyword);
          });

          list.appendChild(item);
        });
      }

      container.appendChild(list);
    }

    this.shadow.appendChild(container);
  }

  private groupKeywords(keywords: KeywordEntry[]): Record<string, KeywordEntry[]> {
    const groups: Record<string, KeywordEntry[]> = {
      Motion: [],
      Spindle: [],
      Tool: [],
      Misc: [],
    };

    keywords.forEach((keyword) => {
      const code = keyword.keyword.toUpperCase();

      if (/^G[0-3]$/.test(code)) {
        groups['Motion']?.push(keyword);
      } else if (/^M[3-5]$/.test(code)) {
        groups['Spindle']?.push(keyword);
      } else if (/^T\d+$/.test(code)) {
        groups['Tool']?.push(keyword);
      } else {
        groups['Misc']?.push(keyword);
      }
    });

    return groups;
  }

  private getStyles(): string {
    return `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow: auto;
      }

      .nc-keyword-panel {
        width: 100%;
        height: 100%;
        background: #1e1e1e;
        color: #d4d4d4;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .panel-header {
        padding: 10px 15px;
        background: #2d2d30;
        border-bottom: 1px solid #3e3e42;
        font-weight: 500;
        font-size: 13px;
        text-transform: uppercase;
        color: #888;
      }

      .empty-state {
        padding: 20px;
        text-align: center;
        color: #666;
        font-size: 13px;
      }

      .keyword-list {
        padding: 5px 0;
      }

      .group-header {
        padding: 8px 15px;
        font-size: 11px;
        font-weight: 600;
        color: #888;
        text-transform: uppercase;
        background: #252526;
        border-bottom: 1px solid #3e3e42;
        border-top: 1px solid #3e3e42;
        margin-top: 5px;
      }

      .keyword-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 15px;
        cursor: pointer;
        transition: background 0.2s;
        font-size: 13px;
      }

      .keyword-item:hover {
        background: #2a2d2e;
      }

      .keyword-item.selected {
        background: #094771;
        border-left: 3px solid #569cd6;
      }

      .keyword-text {
        font-family: 'Courier New', monospace;
        color: #4ec9b0;
        font-weight: 500;
      }

      .line-number {
        font-size: 11px;
        color: #858585;
        font-family: 'Courier New', monospace;
      }
    `;
  }
}

// Register the custom element
customElements.define('nc-keyword-panel', NCKeywordPanel);
