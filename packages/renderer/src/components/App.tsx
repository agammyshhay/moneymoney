import { StoresProvider } from '../store';
import './App.css';
import Body from './Body';
import TopBar from './topBar/TopBar';
import ConceptMockup from './ConceptMockup';
// [CUSTOM-UPDATE-START]
import UpdateToast from './UpdateToast';
// [CUSTOM-UPDATE-END]

function App() {
  // Toggle this to true to see the concept, false for the original app
  const showConcept = false;

  if (showConcept) {
    return <ConceptMockup />;
  }

  return (
    <StoresProvider>
      <div className="App">
        <TopBar />
        {/* [CUSTOM-UPDATE-START] */}
        <UpdateToast />
        {/* [CUSTOM-UPDATE-END] */}
        <Body />
      </div>
    </StoresProvider>
  );
}

export default App;
