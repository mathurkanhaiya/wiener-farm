import React, {lazy, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
const App=lazy(()=>import('./App'));
import GuestApp from './GuestApp';
import {I18nProvider} from './i18n';
import {LocalizedSurface} from './LocalizedSurface';
import {StabilityLayer} from './StabilityLayer';
import {SpinNotificationLayer} from './SpinNotificationLayer';
import './styles.css';
import './styles-spin-card-clean.css';
import './styles-spin-notifications.css';
import './nav-six.css';
import './styles-rich-pro.css';

const hasTelegramSession=()=>Boolean(window.Telegram?.WebApp?.initData);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <StabilityLayer>
        <LocalizedSurface/>
        <SpinNotificationLayer/>
        <Suspense fallback={<div className="center-screen" role="status">Opening your farm…</div>}>{hasTelegramSession()?<App/>:<GuestApp/>}</Suspense>
      </StabilityLayer>
    </I18nProvider>
  </React.StrictMode>
);
