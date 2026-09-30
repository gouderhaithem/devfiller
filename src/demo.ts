import { fillPage } from './fill';
window.addEventListener('message', event => {
  if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== 'devfiller-fill') return;
  const result = fillPage(event.data.request);
  window.parent.postMessage({ type: 'devfiller-result', result }, window.location.origin);
});
document.querySelector('form')?.addEventListener('submit', event => event.preventDefault());
