import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {I18nProvider} from './i18n';
import {LocalizedSurface} from './LocalizedSurface';
import {StabilityLayer} from './StabilityLayer';
import './styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><I18nProvider><StabilityLayer><LocalizedSurface/><App/></StabilityLayer></I18nProvider></React.StrictMode>);
