import { AppShell, commonMenuEntry } from '@archi/core-ui';
import '@archi/core-ui/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Cli2CatalogueScreen } from './Cli2CatalogueScreen.jsx';
import { Cli2Screen } from './Cli2Screen.jsx';
import './cli2.css';

const menu = [
  commonMenuEntry,
  { label: 'Espace client 2', path: '/cli2', element: <Cli2Screen /> },
  { label: 'Catalogue', path: '/cli2/catalogue', element: <Cli2CatalogueScreen /> },
];

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppShell title="Client 2" menu={menu} />
  </StrictMode>,
);
