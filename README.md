# Neon Rush

Un jeu de course arcade en français, développé avec React, TypeScript, Vite et Canvas 2D. Le jeu fonctionne dans le navigateur, sans serveur back-end.

## Lancer le jeu

```powershell
npm ci --legacy-peer-deps
npm run dev
```

Adresse locale : http://localhost:5174. Le port est fixé dans `vite.config.ts`.

## Commandes

- Flèches gauche / droite ou Q / D : changer de voie.
- Espace maintenu : boost. Relâcher pour récupérer après épuisement.
- P ou Échap : pause et reprise.
- Entrée : commencer ou rejouer.
- Sur mobile : boutons tactiles ou balayage horizontal du circuit.

## Règles

Trois difficultés : Balade, Arcade et Expert. La vitesse augmente à chaque secteur ; les quartiers changent de palette. Éviter les obstacles roses, collecter les cristaux verts et les boucliers bleus. Un bouclier dure six secondes et absorbe un seul impact.

Les cristaux rapportent de 50 à 200 points : le multiplicateur augmente tous les trois cristaux consécutifs et retombe si un cristal est manqué. Une esquive proche rapporte 25 points. Trois missions par partie rapportent chacune 300 points : collecter 8 cristaux, parcourir 1 000 mètres et réussir 4 esquives.

Le record personnel est conservé dans le stockage local du navigateur. La partie se met en pause lorsque la fenêtre perd le focus ou que l’onglet devient invisible.

## Vérifications

```powershell
npm run test
npm run build
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
```

La simulation est isolée dans `src/lib/neon-engine.ts`. Les tests couvrent notamment les collisions en changement de voie, les combos, les missions, les boucliers, le boost et les transitions de partie.
