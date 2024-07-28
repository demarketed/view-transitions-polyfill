import ViewTransitionGroup from './elements/view-transition-group';

class ImageData {
  image: Element | undefined;
  width = 0;
  height = 0;
  styleTransform = 'initial';
  transform = 'initial';
  writingMode = 'initial';
  direction = 'initial';
  textOrientation = 'initial';
  mixBlendMode = 'initial';
  backdropFilter = 'initial';
  colorScheme = 'initial';
}

export default class CaptureElement {
  // The initial structure of captureElement follows https://drafts.csswg.org/css-view-transitions/#captured-element
  old = new ImageData();
  groupKeyframes = '';
  groupAnimationNameRule = '';
  groupStylesRule = '';
  imagePairIsolationRule = '';
  imageAnimationNameRule = '';

  oldElement: Element | undefined;
  newElement: Element | undefined;
  name = '';
  group: ViewTransitionGroup | undefined;

  new = new ImageData();
}
