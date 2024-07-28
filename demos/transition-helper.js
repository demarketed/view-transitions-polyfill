import './polyfill-test.js';
import {
  startViewTransitionPolyfill,
  mapStartViewTransition,
  mapPolyfillViewTransitionAnimate,
  mapToGetAnimations,
  mapViewTransitionName,
} from '../demos/dist/view-transitions-polyfill.js';

const originalMethods = {};

if (!document.startViewTransition) {
  mapPolyfilledMethods();
}

export default function startViewTransition(callback) {
  const promiseResolves = [];
  let transition;
  switch (window.viewTransitionMode) {
    case 'view-transitions':
      if (!document.startViewTransition) {
        return callback();
      }
      return document.startViewTransition(callback);
    case 'polyfill':
      mapPolyfilledMethods();
      transition = startViewTransitionPolyfill(callback);
      transition.finished.then(() => restoreOriginalMethods());
      return transition;
    case 'no-transitions':
      // Return promise-like object when not transitioning
      Promise.resolve(callback()).then(() => {
        promiseResolves.forEach((res) => res());
      });
      return {
        updateCallbackDone: new Promise((res) => promiseResolves.push(res)),
        ready: new Promise((res) => promiseResolves.push(res)),
        finished: new Promise((res) => promiseResolves.push(res)),
      };
  }
}

function mapPolyfilledMethods() {
  // Replace any existing browser methods in order to
  //  use the polyfill even if the API is supported.

  // Store references to the original browser methods
  originalMethods.startViewTransition = Document.prototype.startViewTransition;
  originalMethods.animate = HTMLHtmlElement.prototype.animate;
  originalMethods.getAnimations = Document.prototype.getAnimations;
  originalMethods.style = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'style'
  );

  mapStartViewTransition();
  mapPolyfillViewTransitionAnimate();
  mapToGetAnimations();
  mapViewTransitionName();
}

function restoreOriginalMethods() {
  // Restore the browser-provided methods for view transitions.
  // Useful after triggering a polyfill transition in a demo
  //  if the browser supports the API.
  Document.prototype.startViewTransition = originalMethods.startViewTransition;
  HTMLHtmlElement.prototype.animate = originalMethods.animate;
  Document.prototype.getAnimations = originalMethods.getAnimations;
  Object.defineProperty(HTMLElement.prototype, 'style', {
    get: originalMethods.style.get,
    configurable: originalMethods.style.configurable,
  });
}
