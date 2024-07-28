import PolyfillSwitch from './polyfill-switch-component.js';
import { onLinkNavigate, getPageContent, whichPage } from './utils.js';
import startViewTransition from './transition-helper.js';

document.body.appendChild(new PolyfillSwitch());

onLinkNavigate(async (toPath) => {
  const toPage = whichPage(toPath);
  const content = await getPageContent(toPath);
  const transition = startViewTransition(() => {
    document.body.innerHTML = content;
    document.body.appendChild(new PolyfillSwitch());
    if (toPage === 'page-2') {
      document.documentElement.classList.remove('to-page-1');
      document.documentElement.classList.add('to-page-2');
    } else {
      document.documentElement.classList.remove('to-page-2');
      document.documentElement.classList.add('to-page-1');
    }
  });
  await transition.updateCallbackDone;
  await transition.finished;
  document.documentElement.classList.remove('to-page-2');
  document.documentElement.classList.remove('to-page-1');
});
