import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ensureDeviceId } from './device';
import { I18nProvider } from './i18n';
import './styles.css';

// Идентификатор устройства нужен до первого запроса к API:
// по нему backend считает лимиты, общие для всех посетителей сайта.
ensureDeviceId();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);
