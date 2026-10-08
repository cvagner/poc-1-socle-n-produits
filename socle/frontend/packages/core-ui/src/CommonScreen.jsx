import { ApiCard } from './ApiCard.jsx';

/** Écran commun, fourni par le socle à tous les clients. */
export function CommonScreen() {
  return (
    <section className="screen">
      <h2 className="screen__title">Espace commun</h2>
      <p className="screen__intro">
        Cet écran est fourni par le socle (<code>@archi/core-ui</code>) et appelle le service commun.
      </p>
      <ApiCard url="/api/common/hello" />
    </section>
  );
}

/** Entrée de menu de l'écran commun, à placer dans le menu de chaque client. */
export const commonMenuEntry = { label: 'Espace commun', path: '/', element: <CommonScreen /> };
