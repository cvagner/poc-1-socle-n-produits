# ADR 0001 : consigner les décisions d'architecture en ADR

- **Statut** : accepté
- **Date** : 2026-10-08
- **Décideurs** : responsable du POC

## Contexte

Le POC doit éclairer le futur découpage d'un écosystème en tronc commun et services par client. Ses choix (découpage des sources, assemblage des images, topologies de déploiement) seront repris, contestés ou révisés au passage à l'échelle. Ils doivent rester lisibles avec leurs raisons et les options écartées, y compris pour les clients qui consulteront le socle.

## Options considérées

### A. ADR en Markdown dans le dépôt (format inspiré de MADR)

- Avantages : versionnés avec le code, relus en revue, consultables par quiconque lit le dépôt.
- Inconvénients : discipline de mise à jour (statut, remplacement).

### B. Pages de wiki

- Avantages : édition facile.
- Inconvénients : décorrélées des versions du code, droits d'accès distincts de ceux des dépôts.

### C. Aucune trace formalisée

- Avantages : aucun coût immédiat.
- Inconvénients : les raisons se perdent et les débats se rejouent.

## Décision

Option A. Les ADR sont rédigés en français, numérotés et rangés dans `docs/adr/`. Chacun comporte statut, date, contexte, options considérées, décision et conséquences. Les plans de construction sont conservés dans `docs/plan_NN_<sujet>.md` (`plan_00_initial.md`, `plan_01_gateway.md`…).

## Conséquences

- Toute décision structurante du POC fait l'objet d'un ADR. Une décision révisée donne un nouvel ADR, et l'ancien passe au statut « remplacé par ADR n ».
- Lors de la séparation des dépôts ([ADR 0002](0002-decoupage-en-futurs-depots.md)), les ADR rejoindront le dépôt `socle`, consultable par tous les clients.
