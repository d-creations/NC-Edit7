/**
 * Base class for custom Web Components
 */

export abstract class BaseComponent extends HTMLElement {
  protected shadow: ShadowRoot;
  private _isConnected = false;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (!this._isConnected) {
      this._isConnected = true;
      this.render();
      this.onConnected();
    }
  }

  disconnectedCallback() {
    this.onDisconnected();
    this._isConnected = false;
  }

  /**
   * Override to implement rendering logic
   */
  protected abstract render(): void;

  /**
   * Override to handle connection lifecycle
   */
  protected onConnected(): void {
    // Override in subclasses
  }

  /**
   * Override to handle disconnection lifecycle
   */
  protected onDisconnected(): void {
    // Override in subclasses
  }

  /**
   * Request a re-render
   */
  protected requestRender(): void {
    if (this._isConnected) {
      this.render();
    }
  }

  /**
   * Create a style element with the given CSS
   */
  protected createStyles(css: string): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = css;
    return style;
  }

  /**
   * Query element within shadow root
   */
  protected query<T extends Element>(selector: string): T | null {
    return this.shadow.querySelector<T>(selector);
  }

  /**
   * Query all elements within shadow root
   */
  protected queryAll<T extends Element>(selector: string): NodeListOf<T> {
    return this.shadow.querySelectorAll<T>(selector);
  }
}
