import { parseStyles } from './style-parsing/style-sheet-parser';
import CaptureElement from './capture-element';
import {
  cloneElementWithStyles,
  getElementPosition,
  isStylableElement,
  CSSTransformPropertyToFunction,
  ViewTransition,
} from './polyfill-utils';
import ViewTransitionGroup from './elements/view-transition-group';
import type { StylableElement } from './polyfill-utils';
import type { Callback } from './polyfill-utils';
import { ViewTransitionElement } from './elements/view-transition-element';
import {
  setElementVisibility,
  setDocumentVisibility,
  afterNextPaint,
} from './polyfill-utils';

declare global {
  interface CSSStyleDeclaration {
    viewTransitionName: string;
  }
}
class DuplicateNamesError extends Error {
  elements: [Element, Element];
  constructor(message: string | undefined, elements: [Element, Element]) {
    super(message);
    this.elements = elements;
  }
}

type NamedElementsMap = Map<string, CaptureElement>;
type viewTransitionElementsMap = Map<string, HTMLElement>;
type ViewTransitionPhase =
  | 'pending-capture'
  | 'update-callback-called'
  | 'animating'
  | 'done';

export default class ViewTransitionManager {
  static isViewTransitionActive() {
    return document.querySelector('view-transition') ? true : false;
  }

  // Adapted from https://drafts.csswg.org/css-view-transitions/#ua-styles
  // :where() removes specificity, simulating a user agent style sheet
  static UAStylesheetText = `* {
      --vt-polyfill-name: initial;
    }
    
    :where(:root) {
      --vt-polyfill-name: root;
    }
    
    :where(view-transition) {
      position: fixed;
      inset: 0;
      z-index: 100000;
  
      pointer-events: none;
    }
    
    :where(view-transition-group) {
      position: absolute;
      top: 0;
      left: 0;
    
      animation-duration: 0.25s;
      animation-fill-mode: both;
    }
    
    :where(view-transition-image-pair) {
      position: absolute;
      inset: 0;
    
      isolation: isolate;
    
      animation-duration: inherit;
      animation-fill-mode: inherit;
    }
    
    :where(view-transition-old,
    view-transition-new) {
      position: absolute;
      inset-block-start: 0;
      inline-size: 100%;
      block-size: auto;
    
      mix-blend-mode: plus-lighter;
    
      animation-duration: inherit;
      animation-fill-mode: inherit;
    }
  
    @keyframes -ua-view-transition-fade-out {
      to { opacity: 0; }
    }
    @keyframes -ua-view-transition-fade-in {
      from { opacity: 0; }
    }
    @keyframes -ua-mix-blend-mode-plus-lighter {
      from { mix-blend-mode: plus-lighter }
      to { mix-blend-mode: plus-lighter }
    }
    
    /* Extra rule other than those in the spec */
    :where(view-transition.has-root-group) {
      background-color: #fff;
      background-color: Canvas;
    }
    `;

  phase: ViewTransitionPhase = 'pending-capture';
  transitionPromises: ViewTransition = new ViewTransition(this);
  viewTransitionElement = new ViewTransitionElement();
  parsedStyleElement = document.createElement('style');
  namedElements: NamedElementsMap = new Map();
  oldElements: viewTransitionElementsMap = new Map();
  newElements: viewTransitionElementsMap = new Map();
  callback: Callback | undefined = () => undefined;
  animationPromises: Promise<Animation>[] = [];

  // Store focus to be restored from inert
  activeElement: HTMLElement | undefined;

  constructor() {}
  async startViewTransition(
    viewTransitionObject: ViewTransition,
    callback?: Callback
  ) {
    this.phase = 'pending-capture';
    this.transitionPromises = viewTransitionObject;
    if (callback) this.callback = callback;
    if (ViewTransitionManager.isViewTransitionActive()) {
      this.skipTransition(
        'Tried to initiate a View Transition from the polyfill, but one was already active.'
      );
      return;
    }
    this.viewTransitionElement = new ViewTransitionElement();
    document.documentElement.appendChild(this.viewTransitionElement);

    try {
      const parsedStyleString = await parseStyles();
      this.parsedStyleElement = document.createElement('style');
      this.parsedStyleElement.textContent = parsedStyleString;
    } catch (error) {
      const reason =
        error instanceof Error
          ? `View Transitions API polyfill: could not parse stylesheets: ${error.name} ${error.message}`
          : error;
      this.skipTransition(reason);
      throw reason;
    }

    this.addUAStylesheet();
    this.viewTransitionElement.appendChild(this.parsedStyleElement);

    this.namedElements = new Map();
    try {
      this.oldElements = this.getNamedTransitionElements();
    } catch (e) {
      if (e instanceof DuplicateNamesError) {
        return;
      }
    }
    this.captureElements('old');
    this.initialSetupGroups();

    this.activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    document.body.setAttribute('inert', '');

    try {
      if (callback) await callback();
      this.transitionPromises.updateCallbackDone.resolve();
      this.phase = 'update-callback-called';
    } catch (error) {
      this.transitionPromises.updateCallbackDone.reject(error);
      this.skipTransition(error);
      return;
    }

    this.parsedStyleElement?.remove();
    try {
      const parsedStyleString = await parseStyles();
      this.parsedStyleElement = document.createElement('style');
      this.parsedStyleElement.textContent = parsedStyleString;
      this.viewTransitionElement.appendChild(this.parsedStyleElement);
    } catch (error) {
      const reason =
        error instanceof Error
          ? `View Transitions API polyfill: could not parse stylesheets: ${error.name} ${error.message}`
          : error;
      this.skipTransition(reason);
      throw reason;
    }

    try {
      this.newElements = this.getNamedTransitionElements();
    } catch (e) {
      if (e instanceof DuplicateNamesError) {
        return;
      }
    }
    this.captureElements('new');

    // Yield control of the event loop to the browser
    await afterNextPaint();
    this.setupGroups();
    this.newElements.forEach((element) => setElementVisibility(element, false));
    this.transitionPromises.ready.resolve();
    this.phase = 'animating';

    // Clear the view transition once every animation is over
    // https://drafts.csswg.org/css-view-transitions/#handle-transition-frame-algorithm
    const animations = this.viewTransitionElement.getAnimations({
      subtree: true,
    });
    const finishedPromises = animations.map((animation) => animation.finished);
    this.animationPromises.push(...finishedPromises);
    this.animationsFinished();
  }
  skipTransition(reason?: unknown) {
    if (this.phase === 'pending-capture') {
      // Call the update callback if it has not been called yet
      queueMicrotask(async () => {
        if (this.callback) await this.callback();
        this.transitionPromises.updateCallbackDone.resolve();
      });
    }
    setDocumentVisibility(true);
    document.body.removeAttribute('inert');
    this.phase = 'done';
    this.transitionPromises.ready.reject(reason);
    this.transitionPromises.finished.resolve();

    // Account for multiple view transition elements
    // in case the polyfill has erroneously added more than one
    const viewTransitionElements = document.querySelectorAll('view-transition');
    viewTransitionElements.forEach((element) => element.remove());
  }
  captureElements(stage: 'old' | 'new') {
    // For each old or new element captured, add its data to a new CapturedElement struct
    // https://drafts.csswg.org/css-view-transitions/#capture-old-state-algorithm
    const map = stage === 'old' ? this.oldElements : this.newElements;
    for (const [viewTransitionName, element] of map) {
      let captureElement = this.namedElements.get(viewTransitionName);
      if (!captureElement) {
        captureElement = new CaptureElement();
        this.namedElements.set(viewTransitionName, captureElement);
      }
      const style = getComputedStyle(element);
      captureElement.name = viewTransitionName;
      if (stage === 'old') {
        captureElement.oldElement = element;
      } else {
        captureElement.newElement = element;
      }

      try {
        const live = stage === 'new';
        captureElement[stage].image = cloneElementWithStyles(element, live);
      } catch (error) {
        const reason =
          error instanceof Error
            ? `Could not clone element ${element}: ${error.message}`
            : error;
        this.skipTransition(reason);
        return;
      }
      captureElement[stage].width = element.offsetWidth;
      captureElement[stage].height = element.offsetHeight;

      captureElement[stage].styleTransform = style.transform;
      // Within the scope of this function, if the style transform is none,
      // replace it with an empty string to concat
      const styleTransform =
        captureElement[stage].styleTransform === 'none'
          ? ''
          : captureElement[stage].styleTransform;

      // Convert the standalone CSS transform properties to CSS functions
      const standaloneTranslate = CSSTransformPropertyToFunction(
        'translate',
        style.translate
      );
      const standaloneRotate = CSSTransformPropertyToFunction(
        'rotate',
        style.rotate
      );
      const standaloneScale = CSSTransformPropertyToFunction(
        'scale',
        style.scale
      );
      const standaloneTransforms = [
        standaloneTranslate,
        standaloneRotate,
        standaloneScale,
      ].join(' ');

      try {
        // Get the element's position and put it in the form of a translate()
        const elementPosition = getElementPosition(element);
        const elementPositionTranslateFunction = `translate(${elementPosition.left}px, ${elementPosition.top}px)`;
        // Combine the translate() for the element's position with any transforms the element had
        // This follows a specific order according to how CSS transforms are applied:
        //  first the element position, then the standalone transforms, then the previous value of the transform property
        captureElement[stage].transform =
          `${elementPositionTranslateFunction} ${standaloneTransforms} ${styleTransform}`.trim();
      } catch (error) {
        const reason =
          error instanceof Error
            ? `Could not get position of element ${element}: ${error.message}`
            : error;
        this.skipTransition(reason);
        return;
      }

      captureElement[stage].writingMode = style.writingMode;
      captureElement[stage].direction = style.direction;
      captureElement[stage].textOrientation = style.textOrientation;
      captureElement[stage].mixBlendMode = style.mixBlendMode;
      captureElement[stage].backdropFilter = style.backdropFilter;
      captureElement[stage].colorScheme = style.colorScheme;
      if (stage === 'old')
        this.namedElements.set(viewTransitionName, captureElement);
    }
  }
  addUAStylesheet() {
    // Append a <style> element with the default styles normally in the UA stylesheet for browsers that support the API
    const UAStyleEl = document.createElement('style');
    UAStyleEl.setAttribute('data-vt-polyfill-style', '');
    UAStyleEl.textContent = ViewTransitionManager.UAStylesheetText;
    this.viewTransitionElement.appendChild(UAStyleEl);
  }
  getNamedTransitionElements() {
    // This function parses the DOM for elements with a view transition name

    const usedTransitionNames: string[] = [];
    // capturedElements maps view transition names to the elements that have them
    const capturedElements = new Map();
    const loopforNamedElements = (element: StylableElement): void => {
      // Recursive function: analyze the given element and call the function again individually for each of its children

      if (element === document.head) return;

      const style = getComputedStyle(element);

      const isRendered =
        element.checkVisibility() ??
        style.getPropertyValue('display') !== 'none';
      if (!isRendered) return;
      const viewTransitionName =
        element.style.viewTransitionName ||
        style.getPropertyValue('--vt-polyfill-name');

      const loopOverChildren = (element: StylableElement) =>
        element.querySelectorAll(':scope > *').forEach((child) => {
          if (!isStylableElement(child)) return;
          loopforNamedElements(child);
        });

      if (viewTransitionName === 'none') {
        return loopOverChildren(element);
      }

      if (usedTransitionNames.includes(viewTransitionName)) {
        const duplicateNamesError = new DuplicateNamesError(
          'View Transitions API Polyfill: two elements with the same view transition name have been found',
          [capturedElements.get(viewTransitionName), element]
        );
        throw duplicateNamesError;
      }

      if (viewTransitionName !== '') {
        usedTransitionNames.push(viewTransitionName);
        capturedElements.set(viewTransitionName, element);
        if (element === document.documentElement || element === document.body) {
          // If <html> (or <body>) has a view transition name (which is the default case, but can be overridden),
          //  a white background (specified in the polyfill's user agent stylesheet) is applied to <view-transition>.
          this.viewTransitionElement.classList.add('has-root-group');
        }
      }
      return loopOverChildren(element);
    };
    try {
      loopforNamedElements(document.documentElement);
    } catch (e) {
      if (e instanceof DuplicateNamesError) {
        this.skipTransition(e);
        throw e;
      }
    }
    return capturedElements;
  }
  initialSetupGroups() {
    // Append partially completed groups with old images to DOM to simulate rendering freeze for callback
    for (const [key, value] of this.namedElements) {
      const captureElement = value;
      const viewTransitionName = key;

      const viewTransitionGroup = new ViewTransitionGroup();
      captureElement.group = viewTransitionGroup;
      viewTransitionGroup.setupForOldImage(viewTransitionName, captureElement);
      this.viewTransitionElement.appendChild(viewTransitionGroup);
    }
  }
  setupGroups() {
    for (const entry of this.namedElements) {
      const viewTransitionName = entry[0];
      const captureElement = entry[1];

      let viewTransitionGroup = captureElement.group;
      if (!viewTransitionGroup) {
        viewTransitionGroup = new ViewTransitionGroup();
        captureElement.group = viewTransitionGroup;
        viewTransitionGroup.setupForNewImage(
          viewTransitionName,
          captureElement
        );
        this.viewTransitionElement.appendChild(viewTransitionGroup);
      } else {
        viewTransitionGroup.addNewImage();
      }
      viewTransitionGroup.setup();
      viewTransitionGroup.animateImages();
    }
  }
  updateAnimations(newAnimation: Animation) {
    // Add animations from document.documentElement.animate()
    //  to the finished promises to be awaited for the end of the transition.
    this.animationPromises.push(newAnimation.finished);
  }
  animationsFinished() {
    Promise.allSettled(this.animationPromises).then((resolvedPromises) => {
      // The array of resolvedPromises was initially made to include
      //  the animations generated by the polyfill itself, not including
      //  any animations added by document.documentElement.animate()
      //  to this.animationPromises.
      if (resolvedPromises.length === this.animationPromises.length) {
        this.animationPromises = [];
        this.phase = 'done';
        this.transitionPromises.finished.resolve();
        setDocumentVisibility(true);
        document.body.removeAttribute('inert');
        if (this.activeElement && document.body.contains(this.activeElement)) {
          this.activeElement.focus();
        }
        this.viewTransitionElement.remove();
      } else {
        this.animationsFinished();
      }
    });
  }
}
