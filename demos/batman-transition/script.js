import { getPageContent, onLinkNavigate } from '../utils.js';
import PolyfillSwitch from '../polyfill-switch-component.js';
import startViewTransition from '../transition-helper.js';

document.body.appendChild(new PolyfillSwitch());

function decodeBatmanImage() {
  const img = new Image();
  img.src = 'batman.svg';
  return img.decode();
}

onLinkNavigate(async (toPath) => {
  const content = await getPageContent(toPath);
  const div = document.createElement('div');
  div.style.viewTransitionName = 'batman';
  div.style.contain = 'paint';
  document.body.append(div);

  const transition = startViewTransition(async () => {
    document.body.innerHTML = content;
    document.body.appendChild(new PolyfillSwitch());
    await decodeBatmanImage();
  });
  await transition.finished;
});
