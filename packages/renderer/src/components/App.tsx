import { useState } from 'react';
import { StoresProvider } from '../store';
import './App.css';
import Body from './Body';
import ErrorBoundary from './ErrorBoundary';
import TopBar from './topBar/TopBar';
import ConceptMockup from './ConceptMockup';
// [CUSTOM-UPDATE-START]
import UpdateToast from './UpdateToast';
// [CUSTOM-UPDATE-END]
// [CUSTOM-WEBVIEW-START]
import WebAppView from './WebAppView';
// [CUSTOM-WEBVIEW-END]

function App() {
  // Toggle this to true to see the concept, false for the original app
  const showConcept = false;
  // [CUSTOM-WEBVIEW-START]
  const [showWebApp, setShowWebApp] = useState(false);
  // [CUSTOM-WEBVIEW-END]

  if (showConcept) {
    return <ConceptMockup />;
  }

  return (
    <ErrorBoundary>
      <StoresProvider>
        <div className="App">
          <TopBar showWebApp={showWebApp} setShowWebApp={setShowWebApp} />
          {/* [CUSTOM-UPDATE-START] */}
          <UpdateToast />
          {/* [CUSTOM-UPDATE-END] */}
          {/* [CUSTOM-WEBVIEW-START] */}
          {showWebApp ? <WebAppView /> : <Body />}
          {/* [CUSTOM-WEBVIEW-END] */}
        </div>
      </StoresProvider>
    </ErrorBoundary>
  );
}

export default App;
