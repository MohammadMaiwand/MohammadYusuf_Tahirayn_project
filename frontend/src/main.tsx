import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import './i18n';
import './lib/env';
import './styles/index.css';
import './styles/auth.css';
import './styles/premium.css';
import './styles/enterprise.css';
import './styles/print.css';
import { App } from './app/App';
import { queryClient } from './lib/queryClient';
import { ThemeProvider } from './components/common/Appearance';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider />
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
