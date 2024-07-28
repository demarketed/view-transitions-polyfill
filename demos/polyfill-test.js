// Test if the View Transitions API is available in the browser
if (!document.startViewTransition) {
  window.viewTransitionsPolyfilled = true;
} else {
  window.viewTransitionsPolyfilled = false;
}
