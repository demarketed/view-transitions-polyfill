import '../../src/view-transitions-api-polyfill';

const elements = new Map(
  [...document.querySelectorAll('.container')].map((container) => {
    return [
      container.querySelector('.element'),
      container.querySelector('.value'),
    ];
  })
);

function populateTable(elementsMap) {
  for (const [element, value] of elementsMap) {
    value.innerText = element.style.viewTransitionName;
  }
}

populateTable(elements);

const nameButton = document.querySelector('button#submit-name');
const nameChangeTarget = document.querySelector('#name-target');
const nameField = document.querySelector('input#name-setter');
nameButton.addEventListener('click', () => {
  const name = nameField.value;
  nameChangeTarget.style.viewTransitionName = name;
  nameChangeTarget.innerText = nameChangeTarget.style.viewTransitionName;
});
