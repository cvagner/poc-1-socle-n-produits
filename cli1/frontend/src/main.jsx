import { AppShell, commonMenuEntry } from '@archi/core-ui';
import '@archi/core-ui/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Cli1Screen } from './Cli1Screen.jsx';
import './cli1.css';

const menu = [
  commonMenuEntry,
  { label: 'Espace client 1', path: '/cli1', element: <Cli1Screen /> },
];

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppShell title="Client 1" menu={menu} />
  </StrictMode>,
);
