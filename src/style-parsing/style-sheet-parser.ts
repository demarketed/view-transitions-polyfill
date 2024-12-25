import parseStyleString from './style-parser';

export async function parseStyles() {
  // Get all stylesheets and build an array (stylesheetContents) of their unparsed contents
  // We cannot rely on the built-in cssText property, as it won't return unsupported properties
  const stylesheets = [...document.styleSheets];

  performance.mark('inline-styles');
  const styleElementsContents: Map<CSSStyleSheet, string> = new Map();
  for (const stylesheet of stylesheets) {
    if (stylesheet.ownerNode instanceof HTMLStyleElement) {
      if (stylesheet.ownerNode.hasAttribute('data-vt-polyfill-style')) continue;
      const styleString = stylesheet.ownerNode.textContent;
      if (!styleString) continue;
      styleElementsContents.set(stylesheet, styleString);
    }
  }

  // Get <link rel="stylesheet"> contents
  performance.mark('link-styles');
  const linkedStylesheets = stylesheets.filter(
    (stylesheet) => stylesheet.ownerNode instanceof HTMLLinkElement
  );
  const linkedStylesheetsContents: Map<CSSStyleSheet, string> = new Map();
  await Promise.all(
    linkedStylesheets.map(async (stylesheet) => {
      performance.mark(`linked-style-${stylesheet.href}`);
      const href = stylesheet.href;
      if (!href) return;
      const fetchResponse = await fetch(href, {
        headers: { Accept: 'text/css' },
      });
      const responseText = await fetchResponse.text();
      linkedStylesheetsContents.set(stylesheet, responseText);
      performance.mark(`linked-style-done-${stylesheet.href}`);
      performance.measure(
        `linked-style-${stylesheet.href}`,
        `linked-style-${stylesheet.href}`,
        `linked-style-done-${stylesheet.href}`
      );
    })
  );

  // Merge arrays following the order of document.styleSheets
  performance.mark('merger');
  const stylesheetContents = stylesheets.map((stylesheet) => {
    return (
      styleElementsContents.get(stylesheet) ||
      linkedStylesheetsContents.get(stylesheet)
    );
  });

  // Parse each stylesheet
  performance.mark('parse-start');
  const parsedStyleStrings: string[] = [];
  await Promise.all(
    stylesheetContents.map((stylesheetString) => {
      if (!stylesheetString) return;
      const parsedString = parseStyleString(stylesheetString);
      parsedStyleStrings.push(parsedString);
    })
  );
  performance.mark('union-start');
  const str = parsedStyleStrings.join('\n');
  performance.mark('union-end');
  performance.measure('inline-styles', 'inline-styles', 'link-styles');
  performance.measure('link-styles', 'link-styles', 'merger');
  performance.measure('merger', 'merger', 'parse-start');
  performance.measure('parse', 'parse-start', 'union-start');
  performance.measure('union', 'union-start', 'union-end');
  return str;
}
