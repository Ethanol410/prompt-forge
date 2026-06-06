import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { App } from './App.js';
import { Landing } from './landing/Landing.js';
import { ConsentBanner } from './ConsentBanner.js';
import {
  DESKTOP_DOWNLOAD_URL,
  DESKTOP_RELEASES_URL,
  DESKTOP_VERSION,
  GITHUB_REPO_URL,
} from './config.js';

const APP_PATH = '/app';

/**
 * Routeur minimal (History API, sans dépendance) : landing en `/`, app en `/app`.
 * Note hébergement : en production, configurer un fallback SPA vers index.html pour `/app`.
 */
export function Root(): ReactElement {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = (): void => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string): void => {
    if (window.location.pathname !== to) {
      window.history.pushState(null, '', to);
    }
    setPath(to);
    window.scrollTo(0, 0);
  }, []);

  const page =
    path === APP_PATH ? (
      <App onNavigateHome={() => navigate('/')} />
    ) : (
      <Landing
        onLaunch={() => navigate(APP_PATH)}
        downloadUrl={DESKTOP_DOWNLOAD_URL}
        releasesUrl={DESKTOP_RELEASES_URL}
        repoUrl={GITHUB_REPO_URL}
        version={DESKTOP_VERSION}
      />
    );

  return (
    <>
      {page}
      <ConsentBanner />
    </>
  );
}
