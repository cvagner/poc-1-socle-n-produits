import { ApiCard } from '@archi/core-ui';

/** Écran spécifique au client 1 : appelle le web service de cli1. */
export function Cli1Screen() {
  return (
    <section className="screen">
      <h2 className="screen__title">Espace client 1</h2>
      <p className="screen__intro">Cet écran n'existe que dans le front du client 1.</p>
      <ApiCard url="/api/cli1/hello" />
    </section>
  );
}
