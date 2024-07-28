import {
  mapViewTransitionName,
  mapStartViewTransition,
  mapPolyfillViewTransitionAnimate,
  mapToGetAnimations,
} from './polyfill-functions';

if (!document.startViewTransition) {
  mapStartViewTransition();
  mapPolyfillViewTransitionAnimate();
  mapToGetAnimations();
  mapViewTransitionName();
}
