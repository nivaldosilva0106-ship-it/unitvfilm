import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import App from './src/App';
console.log('Rendering...');
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.window = { addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {} };
global.navigator = { userAgent: '' };
global.document = { body: { classList: { add: () => {}, remove: () => {} } } };
try {
  renderToString(createElement(App));
  console.log('Render successful!');
} catch (e) {
  console.error('ERROR CAUGHT:', e);
}
