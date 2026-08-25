# Politique de confidentialité — Selector Generator

Dernière mise à jour : 2026-08-25.

## Résumé

Selector Generator ne collecte, ne transmet et ne partage aucune donnée. Tout le
traitement a lieu localement, dans votre navigateur, sur la page que vous inspectez.
L'extension ne contient aucun appel réseau, aucun serveur, aucun service d'analyse
ou de suivi tiers.

## Ce que fait l'extension

Quand vous cliquez sur "Inspecter" puis sur un élément d'une page, l'extension lit
la structure DOM de cette page (balises, attributs, classes) dans le seul but de
calculer un sélecteur CSS pour l'élément choisi. Ce calcul se fait entièrement dans
le script de contenu injecté dans la page — aucune de ces données ne quitte votre
navigateur.

## Données stockées localement

Une seule préférence est enregistrée, via `browser.storage.local` (stockage local du
navigateur, jamais synchronisé vers un serveur externe) :

- `devMode` : un booléen indiquant si le "mode développeur" est activé, pour que ce
  réglage survive à la fermeture du panneau latéral.

Aucune autre donnée (contenu de page, sélecteurs générés, historique de navigation)
n'est conservée au-delà de la session d'inspection en cours.

## Permissions demandées et pourquoi

- **`activeTab`** : permet d'injecter le script d'inspection sur l'onglet actif
  lorsque vous déclenchez une inspection.
- **`<all_urls>` (host permissions)** : le script de contenu doit pouvoir s'exécuter
  sur n'importe quel site pour que l'outil fonctionne partout où vous en avez besoin
  — il ne lit que le DOM de la page affichée, et seulement pour générer un sélecteur.
- **`storage`** : sert uniquement à mémoriser le réglage "mode développeur" décrit
  ci-dessus.
- **`sidePanel`** (Chrome uniquement) : permet d'afficher l'interface dans le
  panneau latéral du navigateur.

## Aucun partage avec des tiers

L'extension ne contient aucun SDK publicitaire, aucun outil d'analyse (Google
Analytics ou équivalent) et n'effectue aucune requête réseau sortante.

## Contact

Pour toute question sur cette politique, ouvrez une issue sur le dépôt du projet.
