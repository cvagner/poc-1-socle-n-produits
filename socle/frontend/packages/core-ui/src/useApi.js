import { useEffect, useState } from 'react';

/**
 * Appel GET d'un web service. Les URL sont relatives (/api/...) : le nginx
 * du front route vers la bonne API selon la topologie déployée.
 */
export function useApi(url) {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, data: null, error: null });

    fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setState({ loading: false, data: await response.json(), error: null });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setState({ loading: false, data: null, error: error.message });
      });

    return () => controller.abort();
  }, [url]);

  return state;
}
