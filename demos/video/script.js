import PolyfillSwitch from '../polyfill-switch-component.js';
import startViewTransition from '../transition-helper.js';

document.body.appendChild(new PolyfillSwitch());

const video = document.querySelector('.main-video');

document
  .querySelector('.toggle-video-position')
  .addEventListener('click', () => {
    transition('move-video', () => {
      video.classList.toggle('overlay');
    });
  });

document
  .querySelector('.toggle-video-position-slow')
  .addEventListener('click', () => {
    transition('move-video slow', () => {
      video.classList.toggle('overlay');
    });
  });

async function transition(className, callback) {
  const classes = className
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean);

  document.documentElement.classList.add(...classes);

  try {
    const transition = startViewTransition(callback);
    await transition.finished;
  } finally {
    document.documentElement.classList.remove(...classes);
  }
}
