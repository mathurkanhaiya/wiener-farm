import './adsgramGuard';
import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {I18nProvider} from './i18n';
import {LocalizedSurface} from './LocalizedSurface';
import {StabilityLayer} from './StabilityLayer';
import {SpinNotificationLayer} from './SpinNotificationLayer';
import './styles.css';
import './styles-spin-card-clean.css';
import './styles-spin-notifications.css';
import './nav-six.css';
import './styles-rich-pro.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <I18nProvider>
      <StabilityLayer>
        <LocalizedSurface/>
        <SpinNotificationLayer/>
        <App/>
      </StabilityLayer>
    </I18nProvider>
  </React.StrictMode>
);

// Do not block the first app render on remote animated WebP downloads.
// Start warming the animation cache only after the UI is mounted.
if (typeof window !== 'undefined') {
  const warm = () => {
    import('./assetPreload')
      .then(({preloadWienerAnimations}) => preloadWienerAnimations())
      .catch(() => {});
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warm, {timeout: 1800});
  } else {
    window.setTimeout(warm, 900);
  }
}
