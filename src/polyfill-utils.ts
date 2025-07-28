import { MediaClone } from './elements/media-clone';
import ViewTransitionManager from './view-transition-manager';

type PromiseResolve = (value?: PromiseLike<undefined> | undefined) => void;
type PromiseReject = (reason?: unknown) => void;

export type DeferredPromise = Promise<undefined> & {
  resolve: PromiseResolve;
  reject: PromiseReject;
};

export function defer() {
  let resolve!: PromiseResolve;
  let reject!: PromiseReject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  }) as DeferredPromise;
  promise.resolve = resolve;
  promise.reject = reject;

  return promise;
}

export type Callback = () => unknown;

export class ViewTransition {
  private viewTransitionElement: ViewTransitionManager;
  finished: DeferredPromise;
  ready: DeferredPromise;
  updateCallbackDone: DeferredPromise;
  constructor(viewTransitionElement: ViewTransitionManager) {
    // Deferred promises are resolved remotely as needed by the ViewTransitionElement governing the transition
    this.finished = defer();
    this.ready = defer();
    this.updateCallbackDone = defer();
    this.viewTransitionElement = viewTransitionElement;
  }
  skipTransition() {
    this.viewTransitionElement.skipTransition(
      new DOMException('Transition skipped')
    );
  }
}

export const afterNextPaint = (): Promise<void> =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });

const isElementUnallowed = (el: Element) => {
  const unallowedTagNames = [
    'head',
    'script',
    'style',
    'view-transition',
    'view-transition-group',
    'view-transition-image-pair',
    'view-transition-old',
    'view-transition-new',
  ];
  return unallowedTagNames.includes(el.tagName.toLowerCase());
};

const isVoidElement = (el: Element) => {
  const voidElements = [
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
  ];
  return voidElements.includes(el.tagName.toLowerCase());
};

const isElementOutsideViewport = (el: Element) => {
  const rect = el.getBoundingClientRect();

  return (
    rect.top > window.innerHeight + document.documentElement.scrollTop ||
    rect.left > window.innerWidth + document.documentElement.scrollLeft
  );
};

// Always clone these link properties, as their real values
// could be hidden by the :visited pseudo-class.
// https://developer.mozilla.org/en-US/docs/Web/CSS/:visited#privacy_restrictions
const linkProperties = [
  'color',
  'background-color',
  'border-color',
  'border-bottom-color',
  'border-left-color',
  'border-right-color',
  'border-top-color',
  'column-rule-color',
  'outline-color',
  'text-decoration-color',
  'text-emphasis-color',
  'text-decoration-line',
];

// Always clone the values of these layout-related CSS properties.
// Using longhands because shorthands are not included in CSSStyleDeclaration.
const alwaysCloneProperties = [
  'width',
  'height',
  'inline-size',
  'block-size',
  'padding-top',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'border-top-width',
  'border-bottom-width',
  'border-left-width',
  'border-right-width',
  'margin-top',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'box-sizing',
  'display',
];
// Never clone the values of these layout-related CSS properties.
// Their values would hinder animations on ViewTransitionImage.
const neverCloneProperties = [
  'max-width',
  'max-height',
  'max-inline-size',
  'max-block-size',
  'min-width',
  'min-height',
  'min-inline-size',
  'min-block-size',
];

const spacerProperties = [
  'position',
  'margin-top',
  'margin-bottom',
  'margin-right',
  'margin-left',
  'position',
  'top',
  'bottom',
  'right',
  'left',
];

const cloneAsSpacer = (el: Element) => {
  const clone = document.createElement('div');
  clone.dataset.vtSpacer = '';

  const rect = el.getBoundingClientRect();
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;

  const style = getComputedStyle(el);
  for (const prop of spacerProperties) {
    clone.style.setProperty(prop, style.getPropertyValue(prop));
  }
  return clone;
};

// The Element interface does not implement the style property (needed for cloning),
//  but all of its subclasses do.
export type StylableElement = Element & { style: CSSStyleDeclaration };
export function isStylableElement(
  element: unknown
): element is StylableElement {
  return (
    element instanceof HTMLElement ||
    element instanceof SVGElement ||
    element instanceof MathMLElement
  );
}

export function cloneElementWithStyles(
  element: StylableElement,
  live = false
): Element | undefined {
  // This is a recursive function that clones an element while also applying its computed styles

  // Create a defaultStyle object which contains the default
  // CSS declarations from the user agent, in order to avoid
  // duplicating these when cloning an element's style.
  const div = document.createElement('div');
  div.setAttribute('data-vt-default-style-div', '');
  div.style.all = 'initial';
  div.style.display = 'none';
  document.body.appendChild(div);
  const defaultStyle = getComputedStyle(div);

  const cloneElement = (el: StylableElement) => {
    // Check that the element is:
    // + Not the <html> element (in such a case, go clone the <body> directly and skip <html>)
    // + Not an element that would be redundant to clone
    if (isElementUnallowed(el)) {
      return;
    }

    // Create the clone
    // Avoid duplicate <body> tags
    // Clone <video> elements as <canvas>
    let clone: StylableElement;
    if (el instanceof HTMLBodyElement || el instanceof HTMLHtmlElement) {
      clone = document.createElement('div');
    } else if (el instanceof HTMLVideoElement) {
      try {
        const mediaClone = new MediaClone();
        mediaClone.setup(el, live);
        clone = mediaClone;
      } catch {
        // Canvas context 2D unsupported
        return undefined;
      }
    } else {
      clone = el.cloneNode() as StylableElement;
    }

    // Iterate over the properties of getComputedStyle() to make up the contents of a style attribute
    const style = getComputedStyle(el);
    const CSSProperties: Array<string> = [];
    CSSProperties.push('all: initial;'); // Disable inheritance
    if (style) {
      for (const property of [...style]) {
        if (neverCloneProperties.includes(property)) continue;
        const value = style.getPropertyValue(property);
        if (
          value === defaultStyle.getPropertyValue(property) &&
          !alwaysCloneProperties.includes(property)
        ) {
          continue;
        }
        if (property === '-webkit-text-fill-color') {
          // There are cases of shadow DOMs which override the color property
          //  but where the polyfill still applies the inherited color
          //  because of -webkit-text-fill-color, which overrides it.
          // As such, normalize it to the color property.
          CSSProperties.push(`color: ${value};`);
          continue;
        }
        CSSProperties.push(`${property}: ${value};`);
      }
    }

    if (el instanceof HTMLAnchorElement) {
      for (const property of linkProperties) {
        clone.style.setProperty(property, style.getPropertyValue(property));
      }
    }

    // Make up an ID for the clone to be referenced in <style> tags
    const cloneID = 'VT' + Math.random().toString(36).slice(2);
    clone.setAttribute('id', cloneID);

    if (el instanceof HTMLHtmlElement) {
      // If <html> has a view transition name (which is the default case, but can be overridden),
      //  a white background (specified in the polyfill's user agent stylesheet) is applied to <view-transition>

      // This ensures all content behind the transition is obscured, even before a view-transition group for <html> is added.
      // As such, there won't be a flash of content visible through the transparent <view-transition>
      //  if the transition is supposed to encompass the whole document.
      const backgroundStyle = document.createElement('style');
      backgroundStyle.textContent = `:where(#${cloneID}) {background-color: Canvas}`;
      clone.appendChild(backgroundStyle);
    }

    if (cloningRoot) {
      clone.style.margin = '0';
    }

    if (isVoidElement(clone)) {
      clone.setAttribute('style', CSSProperties.join(''));
    } else {
      const styleElement = document.createElement('style');
      styleElement.textContent = `#${cloneID} {${CSSProperties.join('')}}`;
      clone.appendChild(styleElement);
    }

    clone.style.opacity = el.hasAttribute('data-vt-polyfill-opacity')
      ? el.getAttribute('data-vt-polyfill-opacity') || '1'
      : style
        ? style.getPropertyValue('opacity')
        : '1';
    clone.removeAttribute('data-vt-polyfill-opacity');

    if (cloningRoot) {
      clone.style.position = 'relative';
      clone.style.inset = '0';
      clone.style.transform = 'none';
      if (clone.style.translate !== undefined) {
        // The browser supports standalone CSS transform properties
        clone.style.translate = 'none';
        clone.style.rotate = 'none';
        clone.style.scale = 'none';
      }
    }

    // Clone the ::before and ::after pseudo elements if they are present
    // Their styles need to be placed withing a separate <style> tag, not the style attribute

    const beforePseudoEl = getComputedStyle(el, '::before');
    if (
      beforePseudoEl.content !== 'none' &&
      beforePseudoEl.content !== '-moz-alt-content'
      // If a pseudo-element's content is none, it does not exist
      // -moz-alt-content is returned for images in firefox
      // For our purposes, -moz-alt-content is like none
    ) {
      const styleEl = document.createElement('style');
      const CSSProperties: Array<string> = [];
      for (const property of [...beforePseudoEl]) {
        CSSProperties.push(
          `${property}: ${beforePseudoEl.getPropertyValue(property)};`
        );
      }
      styleEl.textContent = `#${cloneID}::before {${CSSProperties.join('')}}`;
      clone.appendChild(styleEl);
    }

    const afterPseudoEl = getComputedStyle(el, '::after');
    if (
      afterPseudoEl.content !== 'none' &&
      afterPseudoEl.content !== '-moz-alt-content'
    ) {
      const styleEl = document.createElement('style');
      const CSSProperties: Array<string> = [];
      for (const property of [...afterPseudoEl]) {
        CSSProperties.push(
          `${property}: ${afterPseudoEl.getPropertyValue(property)};`
        );
      }
      styleEl.textContent = `#${cloneID}::after {${CSSProperties.join('')}}`;
      clone.appendChild(styleEl);
    }

    // Clone scroll position

    const scrollTop = el.scrollTop;

    if (scrollTop !== 0) {
      clone.setAttribute('data-vt-scroll-top', scrollTop.toString());
    }

    const scrollLeft = el.scrollLeft;

    if (scrollLeft !== 0) {
      clone.setAttribute('data-vt-scroll-left', scrollLeft.toString());
    }

    // Recursively call the clone function for the element's childNodes,
    // then appending the resulting child clones to the parent clone
    const elementChildren = el.childNodes;
    for (const child of [...elementChildren]) {
      if (child instanceof Element && !isElementUnallowed(child)) {
        cloningRoot = false;
        if (child.hasAttribute('data-vt-default-style-div')) continue;
        // If a child has a view transition name, its contents will be skipped.
        const childHasName =
          getComputedStyle(child).getPropertyValue('--vt-polyfill-name');
        if (isElementOutsideViewport(child) || childHasName) {
          // If the element is outside the viewport's bounds,
          // only clone it as an empty div to take up space,
          // saving resources by not cloning its subtree.
          const childClone = cloneAsSpacer(child);
          clone.appendChild(childClone);
          continue;
        }
        const childClone = cloneElement(child as StylableElement);
        if (childClone) {
          clone.appendChild(childClone);
        }
      } else if (child instanceof Text && child.textContent?.trim()) {
        const childClone = child.cloneNode();
        clone.append(childClone);
      }
    }

    return clone;
  };

  let cloningRoot = true;
  try {
    const rootElement = cloneElement(element);
    return rootElement;
  } finally {
    div.remove();
  }
}

type CSSTransformProperty = 'translate' | 'rotate' | 'scale';
export function CSSTransformPropertyToFunction(
  transformProperty: CSSTransformProperty,
  transformString: string
): string {
  // Convert a standalone CSS transform property (translate, rotate, scale)
  //  to an equivalent CSS function for the transform property.
  // This is mostly about converting space-separated lists of values to comma-separated ones.
  if (transformString === 'none') return '';
  const transformValues = transformString.split(' ').join(', ');
  switch (transformProperty) {
    case 'translate':
      return `translate(${transformValues})`;
    case 'rotate':
      return `rotate(${transformValues})`;
    case 'scale':
      return `scale(${transformValues})`;
  }
  return '';
}

function getScrollOffset(element: HTMLElement): [number, number] {
  // Function to get the total amount of pixels that an element's
  //  layout position is offset on the screen due to the parents' scrolling
  let scrollTop = 0;
  let scrollLeft = 0;
  const addOffset = (el: HTMLElement): void => {
    if (el.scrollTop === 0 && el.scrollLeft === 0) {
      if (!el.parentElement) return;
      return addOffset(el.parentElement);
    }
    scrollTop += el.scrollTop;
    scrollLeft += el.scrollLeft;
  };
  if (!element.parentElement) return [0, 0];
  addOffset(element.parentElement);
  return [scrollTop, scrollLeft];
}

export function getElementPosition(element: HTMLElement): {
  top: number;
  left: number;
} {
  const offsetPosition = (el: HTMLElement) => {
    // Recursive function to get an element's position in page layout without transforms
    // offsetTop and offsetLeft are relative to the nearest ancestor with position =/= static
    // Recursion is needed to loop through offsetParents and get an absolute position

    const top = el.offsetTop;
    const left = el.offsetLeft;

    const offsetParent = el.offsetParent as HTMLElement;
    let parentPosition = { top: 0, left: 0 };
    if (offsetParent) {
      // When the limit has been reached, offsetParent will be <html>
      // When el.offsetParent is <html>, it actually returns null
      parentPosition = offsetPosition(offsetParent);
    }
    const positionObject = {
      top: top + parentPosition.top,
      left: left + parentPosition.left,
    };
    return positionObject;
  };
  const [scrollTopOffset, scrollLeftOffset] = getScrollOffset(element);
  const position = offsetPosition(element);
  position.top -= scrollTopOffset;
  position.left -= scrollLeftOffset;
  return position;
}

export function setElementVisibility(element: StylableElement, value: boolean) {
  if (element instanceof HTMLHtmlElement) {
    // Forward visibility of <html> to body to avoid hiding view-transition
    setElementVisibility(document.body, value);
    return;
  }
  if (value === false) {
    // Hide elements
    if (element.hasAttribute('data-vt-polyfill-opacity')) return;
    const elementOpacity = element.style.opacity;
    element.setAttribute('data-vt-polyfill-opacity', elementOpacity);
    element.style.opacity = '0.001';
  } else if (value === true) {
    // Show elements
    if (element.hasAttribute('data-vt-polyfill-opacity')) {
      element.style.opacity =
        element.getAttribute('data-vt-polyfill-opacity') ?? '';
      element.removeAttribute('data-vt-polyfill-opacity');
    }
  }
}
export function setDocumentVisibility(value: boolean) {
  // Reset visibility of previously hidden elements with a view-transition-name
  const elements = document.querySelectorAll('[data-vt-polyfill-opacity]');
  for (const element of elements) {
    setElementVisibility(element as StylableElement, value);
  }
}
