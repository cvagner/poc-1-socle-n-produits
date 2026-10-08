import { ApiCard } from '@archi/core-ui';

/** Second écran spécifique au client 2 : appelle le web service catalogue de cli2. */
export function Cli2CatalogueScreen() {
  return (
    <section className="screen">
      <h2 className="screen__title">Catalogue client 2</h2>
      <p className="screen__intro">Ce second écran spécifique n'existe que dans le front du client 2.</p>
      <ApiCard url="/api/cli2/catalogue" />
    </section>
  );
}
