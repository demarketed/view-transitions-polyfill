export default class PolyfillSwitch extends HTMLElement {
  static template = `
    <style>
        :host {
          position: fixed;
          bottom: 0;
          right: 0;
          margin: 1rem;
          color-scheme: light;
        }
        .wrapper {
          color: black;
          background: white;
          border-radius: 0.5rem;
          border: 2px solid lightgray;
          box-shadow: 3px 3px 15px 3px rgb(0, 0, 0, 0.5);
          overflow: hidden;
        }
        summary {
          cursor: pointer;
          padding: 0.5rem;
          background-color: #ececec;
        }
        .controls {
          padding: 0.5rem;
          padding-top: 0;
        }
        fieldset {
          border-radius: 0.5rem;
        }
        p {
          margin-block: 0.5rem;
        }
        label {
          display: block;
        }
        .view-transitions-not-supported {
          color: gray;
        }
        .polyfill-link, .polyfill-link:visited {
          color: blue;
        }
        .not-supported {
          font-style: italic;
        }
        @media (max-width: 400px) {
          :host {
            margin: 0;
            right: 0;
            left: 0;
            bottom: 0;
          }
          .wrapper {
            border-radius: 0;
          }
        }
    </style>
    <div class="wrapper">
    <details open>
    <summary>Hide controls</summary>
    <div class="controls">
    <p>
      This demo uses the 
      <a class="polyfill-link" href="https://github.com/demarketed/view-transitions-polyfill">
        View Transitions API polyfill.
      </a>
    </p>
        <fieldset>
            <legend>
                Choose between:
            </legend>
            <label class="view-transitions-api-label">
            <input type="radio" name="polyfill" id="view-transitions" value="View Transitions API">
            <span class="view-transitions-api-text">View Transitions API</span>
            </label>
            <label>
            <input type="radio" name="polyfill" id="polyfill" value="Polyfill" checked>
            Polyfill for the View Transitions API
            </label>
            <label>
            <input type="radio" name="polyfill" id="no-transitions" value="No transitions">
            No transitions
            </label>
            </div>
            </details>
        </div>
        </fieldset>
    `;
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.radioButtons = this.shadow.querySelectorAll('input[type="radio"]');
  }
  connectedCallback() {
    const template = document.createElement('template');
    template.innerHTML = PolyfillSwitch.template;
    const content = template.content.cloneNode(true);

    this.shadow;
    if (this.shadowRoot) {
      this.shadow = this.shadowRoot;
      this.shadow.innerHTML = '';
      this.shadow.append(content);
    } else {
      this.shadow = this.attachShadow({ mode: 'open' });
      this.shadow.append(content);
    }

    const detailsElement = this.shadow.querySelector('details');
    const summaryElement = this.shadow.querySelector('summary');
    detailsElement.open = window.controlsShown ?? true;
    detailsElement.addEventListener('toggle', () => {
      if (detailsElement.open) {
        window.controlsShown = true;
        summaryElement.innerText = 'Hide controls';
      } else {
        window.controlsShown = false;
        summaryElement.innerText = 'Show controls';
      }
    });

    this.radioButtons = this.shadow.querySelectorAll('input[type="radio"]');
    const fieldset = this.shadow.querySelector('fieldset');
    fieldset.addEventListener('change', this.radioButtonChange.bind(this));

    const viewTransitionsAPISupported = document.startViewTransition
      ? true
      : false;
    if (!viewTransitionsAPISupported || window.viewTransitionsPolyfilled) {
      const viewTransitionsRadioButton =
        this.shadow.querySelector('#view-transitions');
      viewTransitionsRadioButton.disabled = true;
      this.shadow
        .querySelector('.view-transitions-api-label')
        ?.classList.add('view-transitions-not-supported');
      const notSupportedSpan = document.createElement('span');
      notSupportedSpan.classList.add('not-supported');
      notSupportedSpan.innerText = ' (Not Supported)';
      this.shadow
        .querySelector('.view-transitions-api-label')
        ?.appendChild(notSupportedSpan);
    }

    this.syncWithEnvironment();
    this.radioButtonChange();
  }
  radioButtonChange() {
    // As a quick way to implement state persistence in the polyfill switch component
    //  in an environment where document.body.innerHTML is continuously replaced,
    // the component stores its state on the window object
    const checkedButton = [...this.radioButtons].filter(
      (button) => button.checked === true
    )[0];
    window.viewTransitionMode = checkedButton.id;
  }
  syncWithEnvironment() {
    switch (window.viewTransitionMode) {
      case 'view-transitions': {
        const button = this.shadow.querySelector('input#view-transitions');
        button.checked = true;
        break;
      }
      case 'polyfill': {
        const button = this.shadow.querySelector('input#polyfill');
        button.checked = true;
        break;
      }
      case 'no-transitions': {
        const button = this.shadow.querySelector('input#no-transitions');
        button.checked = true;
        break;
      }
    }
  }
}
customElements.define('polyfill-switch', PolyfillSwitch);
