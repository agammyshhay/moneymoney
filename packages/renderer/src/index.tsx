import 'bootstrap/dist/css/bootstrap.rtl.css';
import { configure } from 'mobx';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
// [CUSTOM-THEME-START]
import { MaterialThemeWrapper } from './components/MaterialThemeWrapper';
// [CUSTOM-THEME-END]
import './index.module.css';
import reportWebVitals from './reportWebVitals';
import logger from './logging/logger';

logger.info('Frontend started');

configureMobxLinting();

const container = document.getElementById('app');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    {/* [CUSTOM-THEME-START] - Wrapping App with Material Theme */}
    <MaterialThemeWrapper>
      <App />
    </MaterialThemeWrapper>
    {/* [CUSTOM-THEME-END] */}
  </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

function configureMobxLinting() {
  configure({
    enforceActions: 'never', // Relaxed from 'always'
    computedRequiresReaction: false,
    reactionRequiresObservable: false,
    observableRequiresReaction: false,
    disableErrorBoundaries: false, // Re-enable error boundaries
  });
}
