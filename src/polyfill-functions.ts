import type { Callback } from './polyfill-utils';
import { ViewTransition } from './polyfill-utils';
import ViewTransitionManager from './view-transition-manager';
import {
  getFromStyleAttribute,
  setStyleAttribute,
  getSerializedElementSelector,
} from './style-parsing/style-attribute-parser';

let activeViewTransition: ViewTransitionManager | undefined;

export function startViewTransitionPolyfill(
  callback: Callback | undefined
): ViewTransition {
  // The ViewTransitionManager class handles most of the transition work
  const viewTransitionManager = new ViewTransitionManager();
  // The ViewTransition class acts as the polyfill for the user-facing object returned by document.startViewTransition
  const viewTransitionObject = new ViewTransition(viewTransitionManager);
  activeViewTransition = viewTransitionManager;
  viewTransitionManager.startViewTransition(viewTransitionObject, callback);
  viewTransitionObject.finished.then(() => {
    activeViewTransition = undefined;
  });

  return viewTransitionObject;
}

export function mapStartViewTransition() {
  Object.defineProperty(Document.prototype, 'startViewTransition', {
    value: startViewTransitionPolyfill,
    writable: true,
  });
}

declare global {
  interface Document {
    startViewTransition:
      | ((callback?: () => void) => ViewTransition)
      | undefined;
  }
}

export function mapPolyfillViewTransitionAnimate() {
  // Decorate the animate function of <html>
  // The new function must account for changing view transition pseudo elements to polyfill elements

  const animateFunction = HTMLHtmlElement.prototype.animate;

  Object.defineProperty(HTMLHtmlElement.prototype, 'animate', {
    value: (
      keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
      options?: number | KeyframeAnimationOptions
    ): Animation => {
      const callAnimation = () =>
        animateFunction.call(document.documentElement, keyframes, options);

      if (!options || typeof options === 'number') return callAnimation();
      const pseudoElement = options.pseudoElement;
      const hasViewTransitionPseudoElement =
        pseudoElement && pseudoElement.startsWith('::view-transition');
      if (!hasViewTransitionPseudoElement) {
        return callAnimation();
      }
      // Intercept normal animate function if it refers to view transition pseudo elements
      // The polyfill needs to forward the animation to the custom elements in the DOM

      // Turn the pseudo element name into a valid polyfill element name
      const elementName = getSerializedElementSelector(pseudoElement);

      // Remove the pseudoElement option from the animation options now that we are animating a real element
      const animationOptions = { ...options };
      delete animationOptions.pseudoElement;
      const element = document.querySelector(elementName);
      if (!element) {
        // Return an empty Animation that won't ever finish,
        //  following Chrome's behavior
        const keyframeEffect = new KeyframeEffect(
          document.documentElement,
          keyframes,
          animationOptions
        );
        Object.defineProperty(keyframeEffect, 'pseudoElement', {
          get() {
            return pseudoElement;
          },
        });
        const animation = new Animation(keyframeEffect, document.timeline);
        return animation;
      }
      const animation = element.animate(keyframes, animationOptions);
      activeViewTransition?.updateAnimations(animation);
      return animation;
    },
    configurable: true,
    writable: true,
  });
}

export function mapToGetAnimations() {
  // Patch document.getAnimations() such that
  // The animations on polyfill elements are returned as animations of pseudo elements
  // To account for functions looking for animations on view transition pseudo elements

  const getAnimations = Document.prototype.getAnimations;

  Object.defineProperty(Document.prototype, 'getAnimations', {
    value: () => {
      interface AnimationKeyframe extends Animation {
        // Extend the Animation interface to tell TypeScript that Animation.effect is a KeyframeEffect
        //  instead of an AnimationEffect, an abstract interface (never touched in the browser) which does not have a target
        effect: KeyframeEffect;
      }
      const animations = getAnimations.call(document) as AnimationKeyframe[];
      const viewTransitionElementAnimations = animations.filter((animation) => {
        {
          return animation.effect.target?.tagName
            .toLowerCase()
            .startsWith('view-transition');
        }
      });
      viewTransitionElementAnimations.forEach((animation) => {
        const target = animation.effect?.target;
        Object.defineProperty(animation.effect, 'target', {
          get(): HTMLElement {
            // The view transition pseudo elements are attached to <html>
            return document.documentElement;
          },
        });
        Object.defineProperty(animation.effect, 'pseudoElement', {
          get(): string {
            let pseudoElementString = `::${target?.tagName.toLowerCase()}`;
            if (!(target instanceof ViewTransition)) {
              // All view transition elements except for the root have a name
              pseudoElementString = pseudoElementString.concat(
                `(${target?.getAttribute('name')})`
              );
            }
            return pseudoElementString;
          },
        });
      });

      return animations;
    },
    configurable: true,
    writable: true,
  });
}

export function mapViewTransitionName() {
  // Monkey patching HTMLElement.prototype.style.viewTransitionName.
  // To do this, we first monkey patch HTMLElement.prototype.style,
  //  such that the CSSStyleDeclaration object it returns is intercepted
  //  in order to add the viewTransitionName getter and setter.
  // Monkey patching CSSStyleDeclaration directly is not feasible
  //  because 'this' wouldn't refer to an HTMLElement.
  const originalStyle = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'style'
  );
  Object.defineProperty(HTMLElement.prototype, 'style', {
    get() {
      const styleObject: CSSStyleDeclaration = originalStyle?.get?.call(this);
      /* eslint-disable @typescript-eslint/no-this-alias */
      const element = this;
      /* eslint-enable @typescript-eslint/no-this-alias */
      Object.defineProperty(styleObject, 'viewTransitionName', {
        get() {
          const styleAttribute = element.getAttribute('style') || '';
          return getFromStyleAttribute(styleAttribute);
        },
        set(value: string) {
          const styleAttribute = element.getAttribute('style') || '';
          const attribute = setStyleAttribute(styleAttribute, value);
          element.setAttribute('style', attribute);
          return value;
        },
        configurable: true,
      });
      return styleObject;
    },
    configurable: true,
  });
}
