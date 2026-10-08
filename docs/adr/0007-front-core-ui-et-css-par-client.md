# ADR 0007 : front, composants partagés, DOM unique et une feuille CSS par client

- **Statut** : accepté
- **Date** : 2026-10-08
- **Décideurs** : responsable du POC

## Contexte

Chaque client a son front React. Chacun comporte :

- un en-tête, un menu, une zone centrale et un pied de page ;
- au moins un écran commun et un écran spécifique au client, qui appelle le web service du client.

Les clients ont des identités visuelles très différentes :

- **cli1** : menu latéral gauche sur toute la hauteur, couleurs sobres ;
- **cli2** : menu horizontal sous l'en-tête, couleurs pastel.

## Options considérées

### A. Coquille et composants partagés dans `@archi/core-ui` ; disposition et couleurs portées par une feuille CSS par client

- Avantages :
  - le code React commun n'est écrit qu'une fois ;
  - un client ne fournit que son écran spécifique, son menu et sa feuille ;
  - les classes stables `app-*` et `api-card*` forment un contrat simple.
- Inconvénients : toute variation de structure (et pas seulement de style) demande d'enrichir la coquille du socle.

### B. Chaque client duplique et adapte ses propres composants

- Avantages : liberté totale.
- Inconvénients : duplication, divergence rapide, et le « tronc commun » front disparaît.

### C. Thème injecté en JavaScript (props de thème, CSS-in-JS)

- Avantages : thème typé et centralisé.
- Inconvénients : une dépendance de plus, et une disposition (grille) plus difficile à faire varier qu'en CSS.

## Décision

Option A.

`@archi/core-ui` (`socle/frontend/packages/core-ui`) fournit :

- `AppShell({ title, menu, footer })` : DOM unique `.app-shell > header.app-header + nav.app-menu + main.app-main + footer.app-footer`, routage react-router, entrée active marquée `.is-active` ;
- `useApi(url)` et `ApiCard` : appel GET et affichage de `message`, `module`, `served_by` et `modules_loaded` ;
- `CommonScreen` et `commonMenuEntry` : l'écran commun et son entrée de menu ;
- `base.css` : remise à zéro structurelle seulement, sans disposition ni couleur.

Chaque client (`cliN/frontend`) fournit :

- `main.jsx` : le menu `[commonMenuEntry, entrée spécifique]` ;
- `CliNScreen.jsx` : l'écran spécifique, qui appelle `/api/cliN/hello` ;
- `cliN.css` : la grille CSS de `.app-shell` et la palette :
  - cli1 : zones `"menu header" "menu main" "menu footer"`, ardoise et accent bleu sourd ;
  - cli2 : zones `"header" "menu" "main" "footer"`, menthe, lavande et pêche.

Versions retenues, vérifiées sur npm le 2026-10-08 : React 19.3, react-router 8.4, Vite 8.3, @vitejs/plugin-react 6.1. Le code est écrit en JavaScript (JSX), sans TypeScript, par simplicité.

## Conséquences

- Les captures des deux fronts confirment des rendus distincts sur un DOM identique.
- `@archi/core-ui` est consommé **en source** via le workspace npm au build. Une fois publié ([ADR 0010](0010-resolution-des-dependances-au-build.md)), il devra soit être précompilé, soit rester en source avec un contrat clair sur les versions de React.
- Les classes `app-*` et `api-card*` deviennent une API publique du socle, à faire évoluer avec compatibilité.
