import {
  ViewTransitionImagePair,
  ViewTransitionOld,
  ViewTransitionNew,
} from './view-transition-image-elements';
import CaptureElement from '../capture-element';

type GroupStyleRuleValues = {
  width: string;
  height: string;
  transform: string;
  writingMode: string;
  direction: string;
  textOrientation: string;
  mixBlendMode: string;
  backdropFilter: string;
  colorScheme: string;
};

export default class ViewTransitionGroup extends HTMLElement {
  constructor() {
    super();
  }
  transitionName = '';
  captureElement = new CaptureElement();
  imagePair = new ViewTransitionImagePair();
  oldImage: ViewTransitionOld | undefined;
  newImage: ViewTransitionNew | undefined;
  groupStyle = document.createElement('style');
  setupForOldImage(name: string, captureElement: CaptureElement) {
    this.transitionName = name;
    this.setAttribute('name', name);
    this.captureElement = captureElement;

    this.imagePair = new ViewTransitionImagePair();
    this.oldImage = this.imagePair.setupForOldImage(name, captureElement);
    if (this.oldImage) this.forceDisplay(this.oldImage, true);

    // Set initial positioning values for the group
    // This prevents a flash of unpositioned groups before the update callback
    const initialValues: GroupStyleRuleValues = this.getStyleValues('old');
    this.mapStyleValuesForAttribute(initialValues);
    this.appendChild(this.imagePair);
    this.appendChild(this.groupStyle);
  }
  forceDisplay(image: ViewTransitionOld | ViewTransitionNew, toggle: boolean) {
    // Force an element's CSS display value to block (therefore not none)
    // This is useful for the old image: because ViewTransitionManager
    //  yields to the browser's event loop before showing the new images
    //  of captured elements, we need to avoid a flash of missing elements.
    // This could happen if the website's authour has set display: none
    //  on a class of ::view-transition-old expecting the new image to already
    //  be there, even though the polyfill cannot place it in the DOM yet.
    image.style.display = toggle ? 'block' : '';
  }
  setupForNewImage(name: string, captureElement: CaptureElement) {
    this.transitionName = name;
    this.setAttribute('name', name);
    this.captureElement = captureElement;

    this.imagePair = new ViewTransitionImagePair();
    this.newImage = this.imagePair.setupForNewImage(name, captureElement);

    // Set initial positioning values for the group
    // This prevents a flash of unpositioned groups before the update callback
    const initialValues: GroupStyleRuleValues = this.getStyleValues('new');
    this.mapStyleValuesForAttribute(initialValues);
    this.appendChild(this.imagePair);
    this.appendChild(this.groupStyle);
  }
  addNewImage() {
    this.newImage = this.imagePair.addNewImage();
  }
  setup() {
    // Move the values previously initialized in the style attribute to a <style> element
    // This enables changing the specificity to match that expected from a user agent style
    if (!this.newImage) {
      const values: GroupStyleRuleValues = this.getStyleValues('old');
      this.captureElement.groupStylesRule = `
      :where(view-transition-group[name="${this.transitionName}"]) {
        width: ${values.width};
        height: ${values.height};
        transform: ${values.transform};
        writing-mode: ${values.writingMode};
        direction: ${values.direction};
        text-orientation: ${values.textOrientation};
        mix-blend-mode: ${values.mixBlendMode};
        backdrop-filter: ${values.backdropFilter};
        color-scheme: ${values.colorScheme};
      }
      `;
      this.appendToStyle(this.captureElement.groupStylesRule);
      this.setAttribute('style', '');
      this.appendToStyle(
        `:where(view-transition-old[name="${this.transitionName}"]) {
          animation-name: -ua-view-transition-fade-out;
        }`
      );
      return;
    }

    const values: GroupStyleRuleValues = this.getStyleValues('new');
    this.captureElement.groupStylesRule = `
      :where(view-transition-group[name="${this.transitionName}"]) {
        width: ${values.width};
        height: ${values.height};
        transform: ${values.transform};
        writing-mode: ${values.writingMode};
        direction: ${values.direction};
        text-orientation: ${values.textOrientation};
        mix-blend-mode: ${values.mixBlendMode};
        backdrop-filter: ${values.backdropFilter};
        color-scheme: ${values.colorScheme};
      }
      `;
    this.appendToStyle(this.captureElement.groupStylesRule);
    this.setAttribute('style', '');

    if (!this.oldImage) {
      this.appendToStyle(
        `:where(view-transition-new[name="${this.transitionName}"]) {
          animation-name: -ua-view-transition-fade-in;
        }`
      );
      return;
    }

    // Reset forced display mode
    this.forceDisplay(this.oldImage, false);

    this.captureElement.groupKeyframes = `
        @keyframes -ua-view-transition-group-anim-${this.transitionName} {
          from {
            transform: ${this.captureElement.old.transform};
            width: ${this.captureElement.old.width}px;
            height: ${this.captureElement.old.height}px;
            backdrop-filter: ${this.captureElement.old.backdropFilter};
          }
        }
      `;
    this.appendToStyle(this.captureElement.groupKeyframes);
    this.captureElement.groupAnimationNameRule = `
        :where(view-transition-group[name="${this.transitionName}"]) {
          animation-name: -ua-view-transition-group-anim-${this.transitionName};
        }
      `;
    this.appendToStyle(this.captureElement.groupAnimationNameRule);
    this.captureElement.imagePairIsolationRule = `
        :where(view-transition-image-pair[name="${this.transitionName}"]) {
          isolation: isolate;
        }
      `;
    this.appendToStyle(this.captureElement.imagePairIsolationRule);
    this.captureElement.imageAnimationNameRule = `
        :where(view-transition-old[name="${this.transitionName}"]) {
          animation-name: -ua-view-transition-fade-out, -ua-mix-blend-mode-plus-lighter;
        }
        :where(view-transition-new[name="${this.transitionName}"]) {
          animation-name: -ua-view-transition-fade-in, -ua-mix-blend-mode-plus-lighter;
        }
      `;
    this.appendToStyle(this.captureElement.imageAnimationNameRule);
  }
  appendToStyle(string: string) {
    const text = this.groupStyle.textContent || '';
    this.groupStyle.textContent = text.concat(string);
  }
  getStyleValues(stage: 'old' | 'new' = 'old'): GroupStyleRuleValues {
    if (stage === 'old') {
      const values: GroupStyleRuleValues = {
        width: this.captureElement.old.width.toString().concat('px'),
        height: this.captureElement.old.height.toString().concat('px'),
        transform: this.captureElement.old.transform,
        writingMode: this.captureElement.old.writingMode,
        direction: this.captureElement.old.direction,
        textOrientation: this.captureElement.old.textOrientation,
        mixBlendMode: this.captureElement.old.mixBlendMode,
        backdropFilter: this.captureElement.old.mixBlendMode,
        colorScheme: this.captureElement.old.colorScheme,
      };
      return values;
    } else {
      const values: GroupStyleRuleValues = {
        width: this.captureElement.new.width.toString().concat('px'),
        height: this.captureElement.new.height.toString().concat('px'),
        transform: this.captureElement.new.transform,
        writingMode: this.captureElement.new.writingMode,
        direction: this.captureElement.new.direction,
        textOrientation: this.captureElement.new.textOrientation,
        mixBlendMode: this.captureElement.new.mixBlendMode,
        backdropFilter: this.captureElement.new.backdropFilter,
        colorScheme: this.captureElement.new.colorScheme,
      };
      return values;
    }
  }
  mapStyleValuesForAttribute(values: GroupStyleRuleValues) {
    enum caseConverter {
      width = 'width',
      height = 'height',
      transform = 'transform',
      writingMode = 'writing-mode',
      direction = 'direction',
      textOrientation = 'text-orientation',
      mixBlendMode = 'mix-blend-mode',
      backdropFilter = 'backdrop-filter',
      colorScheme = 'color-scheme',
    }
    for (const [property, value] of Object.entries(values)) {
      const converted = caseConverter[property as keyof typeof caseConverter];
      if (!converted) continue;
      this.style.setProperty(converted, value);
    }
    return;
  }
  getSizingAnimationParemters(): [number, string] {
    // This function returns the duration of the user agent animation that resizes the view-transition-group
    // It is used to simulate the replaced content sizing effect in this.animateImages()
    const style = getComputedStyle(this);
    return [
      this.getSizingAnimationDuration(style),
      this.getSizingAnimationEasing(style),
    ];
  }
  getSizingAnimationDuration(style: CSSStyleDeclaration) {
    const animations = style.animationName.split(', ');
    const animationDurations = style.animationDuration.split(', ');
    const durationsMap = new Map(
      animations.map((animationName) => {
        return [
          animationName,
          animationDurations[animations.indexOf(animationName)],
        ];
      })
    );
    const rawDuration = durationsMap.get(
      `-ua-view-transition-group-anim-${this.transitionName}`
    );
    const duration = parseFloat(rawDuration || '0') * 1000;
    return duration;
  }
  getSizingAnimationEasing(style: CSSStyleDeclaration) {
    const animations = style.animationName.split(', ');
    const animationEasings = style.animationTimingFunction.split(', ');
    const easingsMap = new Map(
      animations.map((animationName) => {
        return [
          animationName,
          animationEasings[animations.indexOf(animationName)],
        ];
      })
    );
    const easing = easingsMap.get(
      `-ua-view-transition-group-anim-${this.transitionName}`
    );
    return easing || 'ease';
  }
  animateImages() {
    const [duration, easing] = this.getSizingAnimationParemters();
    if (this.oldImage) this.oldImage.animateImage(duration, easing);
    if (this.newImage) this.newImage.animateImage(duration, easing);
  }
}
customElements.define('view-transition-group', ViewTransitionGroup);
