import parseStyleString from './style-parser';

export async function parseStyles() {
  // Get all stylesheets and build an array (stylesheetContents) of their unparsed contents
  // We cannot rely on the built-in cssText property, as it won't return unsupported properties
  const stylesheets = [...document.styleSheets];

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
  const linkedStylesheets = stylesheets.filter(
    (stylesheet) => stylesheet.ownerNode instanceof HTMLLinkElement
  );
  const linkedStylesheetsContents: Map<CSSStyleSheet, string> = new Map();
  await Promise.all(
    linkedStylesheets.map(async (stylesheet) => {
      const href = stylesheet.href;
      if (!href) return;
      const fetchResponse = await fetch(href, {
        headers: { Accept: 'text/css' },
      });
      const responseText = await fetchResponse.text();
      linkedStylesheetsContents.set(stylesheet, responseText);
    })
  );

  // Merge arrays following the order of document.styleSheets
  const stylesheetContents = stylesheets.map((stylesheet) => {
    return (
      styleElementsContents.get(stylesheet) ||
      linkedStylesheetsContents.get(stylesheet)
    );
  });

  // Parse each stylesheet
  const parsedStyleStrings: string[] = [];
  await Promise.all(
    stylesheetContents.map((stylesheetString) => {
      if (!stylesheetString) return;
      const parsedString = parseStyleString(stylesheetString);
      parsedStyleStrings.push(parsedString);
    })
  );
  return parsedStyleStrings.join('\n');
}
