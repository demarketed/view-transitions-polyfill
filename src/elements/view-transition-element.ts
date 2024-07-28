export class ViewTransitionElement extends HTMLElement {
  constructor() {
    super();
    this.setAttribute('aria-hidden', 'true');
    this.setAttribute('inert', '');
  }
}
customElements.define('view-transition', ViewTransitionElement);
