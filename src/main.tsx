import React from 'react';
import {createRoot} from 'react-dom/client';
import {TadsWidgetProvider} from 'react-tads-widget';
import App from './App';
import './styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><TadsWidgetProvider><App/></TadsWidgetProvider></React.StrictMode>);
