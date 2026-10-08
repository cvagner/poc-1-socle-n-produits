import { AppShell, commonMenuEntry } from '@archi/core-ui';
import '@archi/core-ui/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Cli2Screen } from './Cli2Screen.jsx';
import './cli2.css';

const menu = [
  commonMenuEntry,
  { label: 'Espace client 2', path: '/cli2', element: <Cli2Screen /> },
];

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppShell title="Client 2" menu={menu} />
  </StrictMode>,
);
