import { getPageContent, onLinkNavigate } from '../utils.js';
import PolyfillSwitch from '../polyfill-switch-component.js';
import startViewTransition from '../transition-helper.js';

document.body.appendChild(new PolyfillSwitch());

let click;
window.addEventListener('click', (e) => (click = e));

onLinkNavigate(async (toPath) => {
  const content = await getPageContent(toPath);
  const x = click?.clientX ?? window.innerWidth / 2;
  const y = click?.clientY ?? window.innerHeight / 2;
  const endRadius = Math.hypot(
    Math.max(x, innerWidth - x),
    Math.max(y, innerHeight - y)
  );

  const transition = startViewTransition(() => {
    document.body.innerHTML = content;
    document.body.appendChild(new PolyfillSwitch());
  });
  await transition.updateCallbackDone;
  await transition.ready;
  document.documentElement.animate(
    [
      { clipPath: `circle(0 at ${x}px ${y}px)` },
      { clipPath: `circle(${endRadius}px at ${x}px ${y}px)` },
    ],
    {
      duration: 500,
      easing: 'ease-in',
      pseudoElement: '::view-transition-new(root)',
    }
  );
  await transition.finished;
});
