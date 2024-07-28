export class MediaClone extends HTMLElement {
  clone: HTMLCanvasElement;
  element: HTMLVideoElement | HTMLCanvasElement | undefined;
  ctx: CanvasRenderingContext2D;
  nextAnimationFrame?: number;
  live = false;
  constructor() {
    super();
    this.style.display = 'block';
    this.clone = document.createElement('canvas');
    this.clone.style.width = '100%';
    this.clone.style.height = '100%';
    this.appendChild(this.clone);
    const ctx = this.clone.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context 2D is unsupported');
    }
    this.ctx = ctx;
  }
  setup(element: HTMLVideoElement | HTMLCanvasElement, live?: boolean) {
    this.element = element;
    if (live) {
      this.live = live;
    }

    if (this.element instanceof HTMLVideoElement) {
      this.clone.width = this.element.videoWidth;
      this.clone.height = this.element.videoHeight;
    } else if (this.element instanceof HTMLCanvasElement) {
      this.clone.width = this.element.width;
      this.clone.height = this.element.height;
    }
  }
  connectedCallback() {
    if (this.live) {
      this.drawLive();
    } else {
      this.draw();
    }
  }
  disconnectedCallback() {
    if (this.nextAnimationFrame) cancelAnimationFrame(this.nextAnimationFrame);
  }
  drawLive() {
    // Update the canvas live if the image is not static.
    // Quit when either <video> or <canvas> is removed from the document.
    if (!this) return;
    if (!this.element || !document.documentElement.contains(this.element)) {
      if (this.nextAnimationFrame)
        cancelAnimationFrame(this.nextAnimationFrame);
      return;
    }
    this.ctx.drawImage(this.element, 0, 0);
    requestAnimationFrame(() => this.drawLive.call(this));
  }
  draw() {
    if (!this.element) return;
    return this.ctx.drawImage(this.element, 0, 0);
  }
}
customElements.define('view-transition-media', MediaClone);
