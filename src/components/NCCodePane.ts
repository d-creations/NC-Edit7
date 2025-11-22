import { ServiceRegistry } from '@core/ServiceRegistry';
import { PARSER_SERVICE_TOKEN } from '@core/ServiceTokens';
import { ParserService } from '@services/ParserService';
// @ts-ignore
import ace from 'ace-builds/src-noconflict/ace';
import 'ace-builds/src-noconflict/mode-text';
import 'ace-builds/src-noconflict/theme-monokai';

export class NCCodePane extends HTMLElement {
  private editor?: ace.Ace.Editor;
  private parserService: ParserService;
  private channelId: string = '';
  private resizeObserver?: ResizeObserver;

  constructor() {
    super();
    // ACE editor has issues with Shadow DOM, so we render directly to light DOM
    this.parserService = ServiceRegistry.getInstance().get(PARSER_SERVICE_TOKEN);
  }

  static get observedAttributes() {
    return ['channel-id'];
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'channel-id') {
      this.channelId = newValue;
    }
  }

  connectedCallback() {
    this.render();
    this.initEditor();
  }

  disconnectedCallback() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.editor) {
      this.editor.destroy();
      this.editor = undefined;
    }
  }

  private render() {
    // Ensure host has dimensions and block display
    this.style.display = 'block';
    this.style.width = '100%';
    this.style.height = '100%';
    this.style.position = 'relative';

    // Use a class instead of ID to avoid conflicts across multiple instances
    this.innerHTML = `
      <style>
        .ace_editor {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace !important;
        }
        .ace_line {
            color: #f8f8f2 !important;
        }
        .ace_layer {
            z-index: auto !important;
        }
      </style>
      <div class="ace-editor-container" style="position: absolute; top: 0; right: 0; bottom: 0; left: 0; font-size: 14px; background-color: #272822; color: #f8f8f2; z-index: 1;"></div>
    `;
  }

  private initEditor() {
    const editorElement = this.querySelector('.ace-editor-container') as HTMLElement;
    if (!editorElement) return;

    // Ensure the container has explicit dimensions before initializing ACE
    const rect = this.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
        // Fallback if not yet laid out
        editorElement.style.width = '100%';
        editorElement.style.height = '100%';
    }

    this.editor = ace.edit(editorElement, {
      mode: 'ace/mode/text', // TODO: Custom NC mode
      theme: 'ace/theme/monokai',
      fontSize: 14,
      showPrintMargin: false,
      showGutter: true,
      highlightActiveLine: true,
      readOnly: false,
      value: '%\nO0001 (TEST PROGRAM)\nG0 X100 Z100\nM30\n%', // Default content for testing
    });
    
    // Use ResizeObserver to handle dynamic layout changes
    this.resizeObserver = new ResizeObserver(() => {
      this.editor?.resize();
    });
    this.resizeObserver.observe(this);

    // Trigger initial parse
    this.parserService.parse(this.editor.getValue(), this.channelId);

    this.editor.on('change', () => {
      const value = this.editor?.getValue() || '';
      this.dispatchEvent(new CustomEvent('code-change', {
        detail: { channelId: this.channelId, code: value },
        bubbles: true,
        composed: true
      }));
      
      // Trigger parse
      this.parserService.parse(value, this.channelId);
    });
  }

  setValue(code: string) {
    if (this.editor && this.editor.getValue() !== code) {
      this.editor.setValue(code, -1);
    }
  }

  getValue(): string {
    return this.editor?.getValue() || '';
  }
}

customElements.define('nc-code-pane', NCCodePane);
