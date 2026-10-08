import { useApi } from './useApi.js';

/** Affiche la réponse d'un web service au format commun (archi/core ApiResponse). */
export function ApiCard({ url }) {
  const { loading, data, error } = useApi(url);

  return (
    <article className="api-card">
      <header className="api-card__header">
        <span className="api-card__method">GET</span> <code className="api-card__url">{url}</code>
      </header>

      {loading && <p className="api-card__status">Chargement…</p>}
      {error && <p className="api-card__status api-card__status--error">Erreur : {error}</p>}

      {data && (
        <dl className="api-card__body">
          <dt>Message</dt>
          <dd>{data.message}</dd>
          <dt>Module</dt>
          <dd>{data.module}</dd>
          <dt>Servi par</dt>
          <dd><code>{data.served_by}</code></dd>
          <dt>Modules chargés</dt>
          <dd>
            {data.modules_loaded.map((module) => (
              <span key={module} className="api-card__tag">{module}</span>
            ))}
          </dd>
        </dl>
      )}
    </article>
  );
}
