import { BrowserRouter, NavLink, Route, Routes } from 'react-router';

/**
 * Coquille commune à tous les fronts : même DOM pour chaque client.
 * La disposition (menu latéral, horizontal…) et les couleurs relèvent
 * exclusivement de la feuille CSS du client, via les classes app-*.
 *
 * menu : [{ label, path, element }]
 */
export function AppShell({ title, menu, footer = 'POC 1 socle, N produits · socle @archi/core-ui' }) {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="app-header">
          <h1 className="app-title">{title}</h1>
        </header>

        <nav className="app-menu" aria-label="Menu principal">
          <ul>
            {menu.map((entry) => (
              <li key={entry.path}>
                <NavLink to={entry.path} end className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
                  {entry.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="app-main">
          <Routes>
            {menu.map((entry) => (
              <Route key={entry.path} path={entry.path} element={entry.element} />
            ))}
          </Routes>
        </main>

        <footer className="app-footer">{footer}</footer>
      </div>
    </BrowserRouter>
  );
}
