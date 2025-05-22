# View Transitions API polyfill

A polyfill for the [View Transitions API](https://drafts.csswg.org/css-view-transitions/).

The polyfill is [available on NPM](https://www.npmjs.com/package/view-transitions-polyfill).

## Demo

View some [demos showing example transitions](https://demarketed.github.io/view-transitions-polyfill/).

![A screen recording of some demos from the above link](./showcase.webp)

## Installation

Install the polyfill in your project from [NPM](https://www.npmjs.com/package/view-transitions-polyfill):

```
npm install view-transitions-polyfill
```

## Usage

Import the module into your site.

Inside a script:

```js
import 'view-transitions-polyfill';
```

Or from the HTML:

```html
<script type="module">
  import 'view-transitions-polyfill';
</script>
```

### With Astro View Transitions

You can use the polyfill with [Astro view transitions](https://docs.astro.build/en/guides/view-transitions/) by importing the script in the document as you would normally. For example, within a component:

```html
<script src="view-transitions-polyfill"></script>
```

## Compatibility

Based on actual testing and data from [Can I use](https://caniuse.com/es6,web-animation,mdn-css_selectors_where,shadowdomv1,mdn-api_customelementregistry,requestanimationframe), the polyfill should be fully supported on:

| Browser | Supported versions | Release date   | Note                        |
| ------- | ------------------ | -------------- | --------------------------- |
| Chrome  | ≥ 105              | `Aug 30, 2022` |                             |
| Edge    | ≥ 105              | `Sep 1 , 2022` | Same as Chrome              |
| Firefox | ≥ 106              | `Oct 18, 2022` |                             |
| Safari  | ≥ 17               | `Sep 26, 2023` |                             |
| Opera   | ≥ 97               | `Mar 13, 2023` | Haven't test older versions |


The polyfill currently requires the browser to support these notable features:

- [Element.animate()](https://developer.mozilla.org/en-US/docs/Web/API/Element/animate)
- [Document.getAnimations()](https://developer.mozilla.org/en-US/docs/Web/API/Document/getAnimations)
- [requestAnimationFrame()](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- Custom elements
- Shadow DOM
- [CSS :where() selector](https://developer.mozilla.org/en-US/docs/Web/CSS/:where)

## Development

### Building

Build the polyfill to `dist`:

```
npm run build
```

### Testing

To test the polyfill, you can run [Web Platform Tests](https://web-platform-tests.org/index.html).
You need to [set up your system](https://web-platform-tests.org/running-tests/from-local-system.html) before running tests.

Run the tests with:

```
npm run test
```

This will generate report files in `test/report`.

The polyfill only loads its functions into the browser if it does not already natively support the View Transitions API.
You can run the tests with a version of the polyfill that avoids this check with:

```
npm run test-always-polyfill
```

You can view the tests' web pages in your browser with:

```
npm run test-debug
```

### Performance measurement

A version of the polyfill set up to measure its performance can be found at the [performance branch](https://github.com/demarketed/view-transitions-polyfill/tree/performance). You can follow the [associated instructions](https://github.com/demarketed/view-transitions-polyfill/tree/performance#performance-measurement).
