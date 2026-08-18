import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import RadioPage from './components/radio/RadioPage.jsx'
import AdminLogin from './components/admin/adminLogin/AdminLogin.jsx'
import AdminPanel from './components/admin/AdminPanel.jsx'
import { GuestLandingPage } from './components/guestRoom/GuestLandingPage.jsx'
import { NotFoundPage } from './components/NotFoundPage.jsx'
import { applyDirection } from './i18n/rtl.js'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './i18n/serverMessage.js'
import { parseRadioPath, buildRadioPath } from './i18n/localePaths.js'
import './index.css'

const syncRadioLocale = (path) => {
  const parsed = parseRadioPath(path);
  if (!parsed) return null;

  if (parsed.explicit) {
    localStorage.setItem('radio_lang', parsed.locale);
    return parsed.locale;
  }

  const stored = localStorage.getItem('radio_lang');
  if (stored && stored !== DEFAULT_LOCALE && SUPPORTED_LOCALES.includes(stored)) {
    window.history.replaceState({}, '', buildRadioPath(stored, parsed.page));
    return stored;
  }

  return null;
};

applyDirection(syncRadioLocale(window.location.pathname) || localStorage.getItem('lang') || 'uk');

const Root = () => {
  const [path, setPath] = useState(window.location.pathname);

  const navigate = (to) => {
    window.history.pushState({}, '', to);
    setPath(to);
  };

  useEffect(() => {
    const handleLocationChange = () => {
      syncRadioLocale(window.location.pathname);
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const radioPath = parseRadioPath(path);
  const isKnownPath = radioPath || path === '/adlogin' || path === '/adpanel';

  return (
    <React.StrictMode>
      {radioPath?.page === 'radio' && <RadioPage />}
      {radioPath?.page === 'guest' && <GuestLandingPage navigate={navigate} />}
      {path === '/adlogin' && <AdminLogin navigate={navigate} />}
      {path === '/adpanel' && <AdminPanel navigate={navigate} />}
      {!isKnownPath && <NotFoundPage navigate={navigate} />}
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<Root />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        //console.log('SW registered', reg);
      })
      .catch(err => {
        console.error('SW registration failed', err);
      });
  });
}
