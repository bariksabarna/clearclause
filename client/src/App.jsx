/**
 * Application shell. Mounts the session store, renders the persistent chrome
 * (skip link, header, footer), and code-splits the six screens behind a
 * Suspense fallback so route chunks load only when first visited.
 */
import { Suspense, lazy } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './store/session.jsx';
import SkipLink from './components/SkipLink.jsx';
import AppHeader from './components/AppHeader.jsx';
import AppFooter from './components/AppFooter.jsx';

const HomeScreen = lazy(() => import('./screens/HomeScreen.jsx'));
const AnalyzingScreen = lazy(() => import('./screens/AnalyzingScreen.jsx'));
const AnalysisScreen = lazy(() => import('./screens/AnalysisScreen.jsx'));
const QaScreen = lazy(() => import('./screens/QaScreen.jsx'));
const ChecklistScreen = lazy(() => import('./screens/ChecklistScreen.jsx'));
const CompareScreen = lazy(() => import('./screens/CompareScreen.jsx'));
const IssuesScreen = lazy(() => import('./screens/IssuesScreen.jsx'));

export function ScreenFallback() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-20 text-center" aria-busy="true">
      <p role="status" className="font-label-md text-label-md text-secondary">
        Loading ClearClause…
      </p>
    </section>
  );
}

function NotFound() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-20 text-center">
      <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-primary">
        map
      </span>
      <h1 className="mt-3 font-headline-lg text-headline-lg text-primary">Page not found</h1>
      <p className="mt-2 font-body-md text-body-md text-secondary">
        That route does not exist on this desk.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 bg-primary px-5 py-2.5 font-label-lg text-label-lg font-semibold text-on-primary shadow-sm"
      >
        Back to upload
      </Link>
    </section>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <SkipLink />
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <div id="main-content" tabIndex={-1} className="flex-1">
          <Suspense fallback={<ScreenFallback />}>
            <Routes>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/analyzing" element={<AnalyzingScreen />} />
              <Route path="/analysis" element={<AnalysisScreen />} />
              <Route path="/qa" element={<QaScreen />} />
              <Route path="/checklist" element={<ChecklistScreen />} />
              <Route path="/compare" element={<CompareScreen />} />
              <Route path="/issues" element={<IssuesScreen />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
        <AppFooter />
      </div>
    </SessionProvider>
  );
}
