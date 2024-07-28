export async function getPageContent(url) {
  const content = await fetch(url);
  const text = await content.text();

  const parser = new DOMParser();
  const parsed = parser.parseFromString(text, 'text/html');

  const body = parsed.body;
  return body.innerHTML;
}

/**
 * Initialize state of History API
 * @typedef {Object} HistoryState
 * @property {string} page
 * @property {('index'|'page-2')} order
 */

/** @type {HistoryState} */
const state = {
  page: window.location.href,
  order: whichPage(window.location.href),
};
history.replaceState(state, '');

/**
 *
 * @param {string} href
 * @returns {('index' | 'page-2')}
 */
export function whichPage(href) {
  // Is the given href referring to index or page-2?
  const page2 = href.search(/page-2/);
  if (page2 === -1) {
    return 'index';
  } else {
    return 'page-2';
  }
}

let storedCallback;

export async function onLinkNavigate(callback) {
  storedCallback = callback;
  const links = [...document.querySelectorAll('a:not([data-demo-link])')];
  links.forEach((link) => {
    link.addEventListener(
      'click',
      async (e) => {
        // Redirect click to callback, which can make use of the destination path
        e.preventDefault();
        const toPath = e.target.closest('a').href;
        await callback(toPath);

        // Reflect new path in history
        /** @type {HistoryState} */
        const state = { page: toPath, order: whichPage(toPath) };
        history.pushState(state, '', toPath);

        // Attach event listener to any new links
        onLinkNavigate(callback);
      },
      {
        passive: false,
      }
    );
  });
}

window.addEventListener('popstate', async (e) => {
  await storedCallback(e.state.page);

  // Attach event listener to any new links
  onLinkNavigate(storedCallback);
});
