import { ApiCard } from '@archi/core-ui';

/** Écran spécifique au client 2 : appelle le web service de cli2. */
export function Cli2Screen() {
  return (
    <section className="screen">
      <h2 className="screen__title">Espace client 2</h2>
      <p className="screen__intro">Cet écran n'existe que dans le front du client 2.</p>
      <ApiCard url="/api/cli2/hello" />
    </section>
  );
}
