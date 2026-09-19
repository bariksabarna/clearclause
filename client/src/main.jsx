/**
 * Client entry point. Mounts React Router + the session store and renders the app shell into the root element. Kept intentionally minimal.
 */
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

const container = document.getElementById('root');

if (container) {
  createRoot(container).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
