import CaptureElement from '../capture-element';
export class ViewTransitionImagePair extends HTMLElement {
  constructor() {
    super();
  }
  name = '';
  captureElement = new CaptureElement();
  oldImage: ViewTransitionOld | undefined;
  newImage: ViewTransitionNew | undefined;
  setupForOldImage(name: string, captureElement: CaptureElement) {
    this.name = name;
    this.setAttribute('name', name);
    this.captureElement = captureElement;

    if (this.captureElement.oldElement) {
      this.oldImage = new ViewTransitionOld();
      this.oldImage.setup(this.name, this.captureElement);
      this.appendChild(this.oldImage);
    }

    return this.oldImage;
  }
  setupForNewImage(name: string, captureElement: CaptureElement) {
    this.name = name;
    this.setAttribute('name', name);
    this.captureElement = captureElement;

    if (this.captureElement.newElement) {
      this.newImage = new ViewTransitionNew();
      this.newImage.setup(this.name, this.captureElement);
      this.appendChild(this.newImage);
    }

    return this.newImage;
  }
  addNewImage() {
    if (this.captureElement.newElement) {
      this.newImage = new ViewTransitionNew();
      this.newImage.setup(this.name, this.captureElement);
      this.appendChild(this.newImage);
    }

    return this.newImage;
  }
}
class PolyfillInnerElement {
  static stylesheet = `
      .polyfill-inner-element {
        display: block;
        position: relative;
        inline-size: fit-content;
      }
      `;
  styleEl: HTMLStyleElement;
  element: HTMLDivElement;
  constructor() {
    this.element = document.createElement('div');
    this.element.classList.add('polyfill-inner-element');
    this.styleEl = document.createElement('style');
    this.styleEl.textContent = PolyfillInnerElement.stylesheet;
    this.element.appendChild(this.styleEl);
  }
}
type CSSTranslateFunction = string;
type CSSScaleFunction = string;
class ViewTransitionImage extends HTMLElement {
  constructor() {
    super();
    const polyfillInnerElement = new PolyfillInnerElement();
    this.innerElement = polyfillInnerElement.element;
  }
  protected innerElement: HTMLDivElement;
  name = '';
  captureElement = new CaptureElement();
  protected image: Element | undefined;
  protected element: Element | undefined;
  setup(name: string, captureElement: CaptureElement) {
    this.name = name;
    if (!this.image)
      throw new Error(
        `View Transitions API polyfill: could not find old captured clone for name ${name}`
      );
    if (!this.element)
      throw new Error(
        `View Transitions API polyfill: could not find old captured element for name ${name}`
      );
    this.setAttribute('name', name);
    this.captureElement = captureElement;

    const shadow = this.attachShadow({ mode: 'closed' });

    // To simulate the sizing of the replaced content that should be put inside ::view-transition-old and ::view-transition-new
    // An extra element to put inside the old and new images is required, because the polyfill uses actual elements instead of images
    // The size of this element will be animated as a transform: scale() to fit the requirements of the applied object-fit CSS properties
    // We can be sure that oldImage is not undefined as ViewTransitionImagePair checks for it
    this.innerElement.appendChild(this.image);
    shadow.appendChild(this.innerElement);
  }
  connectedCallback() {
    // Restore the scroll position of each cloned element
    // We need to wait for connectedCallback, as the element needs to be in the document
    this.innerElement
      .querySelectorAll('[data-vt-scroll-top]')
      .forEach((element) => {
        // Make element scrollable by constraining its size
        if (element instanceof HTMLElement) {
          element.style.overflow = 'hidden';
          element.style.maxHeight = '100vh';
          element.style.maxWidth = '100vw';
          const scrollTop =
            parseInt(element.getAttribute('data-vt-scroll-top') || '0') ?? 0;
          element.scrollTop = scrollTop;
        }
      });

    this.innerElement
      .querySelectorAll('[data-vt-scroll-left]')
      .forEach((element) => {
        if (element instanceof HTMLElement) {
          element.style.overflow = 'hidden';
          element.style.maxHeight = '100vh';
          element.style.maxWidth = '100vw';
          const scrollTop =
            parseInt(element.getAttribute('data-vt-scroll-top') || '0') ?? 0;
          element.scrollTop = scrollTop;
        }
      });

    // Check for margin on root cloned element.
    // If there was margin collapsing before but not anymore,
    //  it should be removed becuase it won't be collapsed
    //  with the position: fixed transition elements.
    const childMarginCollapsingEl = this.innerElement.querySelector(
      ':scope > :not(style) > :not(style)'
    );
    if (
      this.offsetHeight !== this.innerElement.offsetHeight &&
      childMarginCollapsingEl instanceof HTMLElement &&
      !(this.element instanceof HTMLHtmlElement)
    ) {
      childMarginCollapsingEl.style.marginBlockStart = '0';
    }
  }
  getScaleFactor(
    objectFit: string,
    fromWidth: number,
    toWidth: number,
    fromHeight: number,
    toHeight: number
  ): [number, number, string] {
    let scaleFunction: CSSScaleFunction = '';
    let scaleFactorX = 1;
    let scaleFactorY = 1;

    if (this.element instanceof HTMLHtmlElement) {
      // Do not do any scale on the clone of <html>
      // https://drafts.csswg.org/css-view-transitions/#capture-the-image
      scaleFactorX = 1;
      scaleFactorY = 1;
      scaleFunction = '';

      return [scaleFactorX, scaleFactorY, scaleFunction];
    }

    const fromAspectRatio = fromWidth / fromHeight;
    const toAspectRatio = toWidth / toHeight;

    switch (objectFit) {
      case 'fill':
        // The scale factors for X and Y are only different when stretching
        scaleFactorX = toWidth / fromWidth;
        scaleFactorY = toHeight / fromHeight;
        break;
      case 'contain':
        if (fromAspectRatio > toAspectRatio) {
          scaleFactorX = toWidth / fromWidth;
        } else {
          scaleFactorX = toHeight / fromHeight;
        }
        scaleFactorY = scaleFactorX;
        break;
      case 'cover':
        if (fromAspectRatio > toAspectRatio) {
          scaleFactorX = toHeight / fromHeight;
        } else {
          scaleFactorX = toWidth / fromWidth;
        }
        scaleFactorY = scaleFactorX;
        break;
      case 'scale-down':
        scaleFactorX = 1;
        scaleFactorY = scaleFactorX;
        break;
    }

    // Fix possible divisions by zero
    scaleFactorX = Number.isNaN(scaleFactorX) ? 1 : scaleFactorX;
    scaleFactorY = Number.isNaN(scaleFactorY) ? 1 : scaleFactorY;

    scaleFactorX = parseFloat(scaleFactorX.toFixed(2));
    scaleFactorY = parseFloat(scaleFactorY.toFixed(2));
    scaleFunction = `scale(${scaleFactorX}, ${scaleFactorY})`;

    return [scaleFactorX, scaleFactorY, scaleFunction];
  }
  getObjectPositionValues(
    objectPosition: string,
    oldWidth: number,
    newWidth: number,
    oldHeight: number,
    newHeight: number
  ) {
    // Do not do any translation on the clone of <html>
    // https://drafts.csswg.org/css-view-transitions/#capture-the-image
    if (this.element instanceof HTMLHtmlElement)
      return {
        old: { top: '0px', left: '0px' },
        new: { top: '0px', left: '0px' },
      };

    const [objectPositionX, objectPositionY] = objectPosition.split(' ');

    const oldContainerWidth = this.captureElement.old.width;
    const oldContainerHeight = this.captureElement.old.height;
    const newContainerWidth = this.captureElement.new.width;
    const newContainerHeight = this.captureElement.new.height;

    let oldLeft: string;
    let newLeft: string;
    if (objectPositionX.includes('%')) {
      // Calculating the position of the top left corner of the image given the percentage object-position
      // https://developer.mozilla.org/en-US/docs/Web/CSS/background-position#regarding_percentages
      const positionOffset = parseFloat(objectPositionX) / 100;
      oldLeft = ((oldContainerWidth - oldWidth) * positionOffset)
        .toString()
        .concat('px');
      newLeft = ((newContainerWidth - newWidth) * positionOffset)
        .toString()
        .concat('px');
    } else {
      oldLeft = objectPositionX;
      newLeft = objectPositionX;
    }

    let oldTop: string;
    let newTop: string;
    if (objectPositionY.includes('%')) {
      const positionOffset = parseFloat(objectPositionY) / 100;
      oldTop = ((oldContainerHeight - oldHeight) * positionOffset)
        .toString()
        .concat('px');
      newTop = ((newContainerHeight - newHeight) * positionOffset)
        .toString()
        .concat('px');
    } else {
      oldTop = objectPositionY;
      newTop = objectPositionY;
    }

    return {
      old: { top: oldTop, left: oldLeft },
      new: { top: newTop, left: newLeft },
    };
  }
  animateImage(
    animationDuration: number,
    CSSeasing: string,
    fromTransform: string,
    toTransform: string
  ) {
    this.innerElement.animate(
      [
        {
          transform: fromTransform,
          transformOrigin: 'top left',
        },
        {
          transform: toTransform,
          transformOrigin: 'top left',
        },
      ],
      {
        duration: animationDuration,
        iterations: 1,
        fill: 'forwards',
        easing: CSSeasing,
      }
    );
  }
}
export class ViewTransitionOld extends ViewTransitionImage {
  setup(name: string, captureElement: CaptureElement) {
    this.image = captureElement.old.image;
    this.element = captureElement.oldElement;
    return super.setup(name, captureElement);
  }
  getAnimateImageFunctions() {
    // Simulate the replaced content sizing of ::view-transition-old and ::view-transition-new
    // Since view-transition-old and view-transition-new are not images in the polyfill,
    // their size will fit the change in size of the animation by animating transform: scale() on them

    // The value for transform will be determined using the value of object-fit
    const style = getComputedStyle(this);
    const objectFit = style.objectFit;

    const [scaleFactorX, scaleFactorY, scaleFunction] =
      this.getScaleFactor(objectFit);

    const objectPosition = style.objectPosition;
    const objectPositionValues = this.getObjectPositionValues(
      objectPosition,
      scaleFactorX,
      scaleFactorY
    );
    const oldObjectPositionTranslate: CSSTranslateFunction = `translate(${objectPositionValues.old.left}, ${objectPositionValues.old.top})`;
    const newObjectPositionTranslate: CSSTranslateFunction = `translate(${objectPositionValues.new.left}, ${objectPositionValues.new.top})`;

    return [
      oldObjectPositionTranslate,
      newObjectPositionTranslate,
      scaleFunction,
    ];
  }
  getScaleFactor(objectFit: string): [number, number, string] {
    const fromWidth = this.captureElement.old.width;
    const fromHeight = this.captureElement.old.height;
    const toWidth = this.captureElement.new.width;
    const toHeight = this.captureElement.new.height;
    return super.getScaleFactor(
      objectFit,
      fromWidth,
      toWidth,
      fromHeight,
      toHeight
    );
  }
  getObjectPositionValues(
    objectPosition: string,
    scaleFactorX: number,
    scaleFactorY: number
  ): {
    old: { top: string; left: string };
    new: { top: string; left: string };
  } {
    const oldWidth = this.innerElement.offsetWidth;
    const oldHeight = this.innerElement.offsetHeight;
    const newWidth = Math.floor(oldWidth * scaleFactorX);
    const newHeight = Math.floor(oldHeight * scaleFactorY);
    return super.getObjectPositionValues(
      objectPosition,
      oldWidth,
      newWidth,
      oldHeight,
      newHeight
    );
  }
  animateImage(animationDuration: number, CSSeasing: string) {
    const [
      oldObjectPositionTranslate,
      newObjectPositionTranslate,
      scaleFunction,
    ] = this.getAnimateImageFunctions();
    return super.animateImage(
      animationDuration,
      CSSeasing,
      oldObjectPositionTranslate,
      `${newObjectPositionTranslate} ${scaleFunction}`
    );
  }
}
export class ViewTransitionNew extends ViewTransitionImage {
  setup(name: string, captureElement: CaptureElement) {
    this.image = captureElement.new.image;
    this.element = captureElement.newElement;
    super.setup(name, captureElement);
  }
  getAnimateImageFunctions() {
    // Simulate the replaced content sizing of ::view-transition-old and ::view-transition-new
    // Since view-transition-old and view-transition-new are not images in the polyfill,
    // their size will fit the change in size of the animation by animating transform: scale() on them

    // The value for transform will be determined using the value of object-fit
    const style = getComputedStyle(this);
    const objectFit = style.objectFit;

    const [scaleFactorX, scaleFactorY, scaleFunction] =
      this.getScaleFactor(objectFit);

    const objectPosition = style.objectPosition;
    const objectPositionValues = this.getObjectPositionValues(
      objectPosition,
      scaleFactorX,
      scaleFactorY
    );
    const oldObjectPositionTranslate: CSSTranslateFunction = `translate(${objectPositionValues.old.left}, ${objectPositionValues.old.top})`;
    const newObjectPositionTranslate: CSSTranslateFunction = `translate(${objectPositionValues.new.left}, ${objectPositionValues.new.top})`;

    return [
      oldObjectPositionTranslate,
      newObjectPositionTranslate,
      scaleFunction,
    ];
  }
  getScaleFactor(objectFit: string): [number, number, string] {
    const fromWidth = this.captureElement.new.width;
    const fromHeight = this.captureElement.new.height;
    const toWidth = this.captureElement.old.width;
    const toHeight = this.captureElement.old.height;
    return super.getScaleFactor(
      objectFit,
      fromWidth,
      toWidth,
      fromHeight,
      toHeight
    );
  }
  getObjectPositionValues(
    objectPosition: string,
    scaleFactorX: number,
    scaleFactorY: number
  ): {
    old: { top: string; left: string };
    new: { top: string; left: string };
  } {
    const newWidth = this.innerElement.offsetWidth;
    const newHeight = this.innerElement.offsetHeight;
    const oldWidth = Math.floor(newWidth * scaleFactorX);
    const oldHeight = Math.floor(newHeight * scaleFactorY);
    return super.getObjectPositionValues(
      objectPosition,
      oldWidth,
      newWidth,
      oldHeight,
      newHeight
    );
  }
  animateImage(animationDuration: number, CSSeasing: string) {
    const [
      oldObjectPositionTranslate,
      newObjectPositionTranslate,
      scaleFunction,
    ] = this.getAnimateImageFunctions();
    return super.animateImage(
      animationDuration,
      CSSeasing,
      `${oldObjectPositionTranslate} ${scaleFunction}`,
      newObjectPositionTranslate
    );
  }
}

customElements.define('view-transition-image-pair', ViewTransitionImagePair);
customElements.define('view-transition-old', ViewTransitionOld);
customElements.define('view-transition-new', ViewTransitionNew);
