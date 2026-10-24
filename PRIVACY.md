# Politique de confidentialité de Liro

Dernière mise à jour : 25 octobre 2026.

Liro fonctionne sans compte, sans serveur applicatif, sans publicité et sans télémétrie.

## Données traitées

Selon l’action demandée, l’extension traite temporairement : le texte sélectionné, le contenu principal de la page, l’adresse et le titre de la page, une capture de la zone visible choisie, le texte produit par l’OCR et le texte envoyé à la voix système.

Les actions de lecture (progression et retours entre les étapes) sont utilisées localement pour afficher la progression et proposer les aides du coach. La reprise utilise uniquement les articles ouverts volontairement dans Liro ; l’extension ne surveille pas l’historique général du navigateur. Dans les catégories du Chrome Web Store, ces traitements relèvent du contenu des sites Web, de l’activité de l’utilisateur et des informations de navigation, même lorsqu’ils restent sur l’appareil.

## Lieu du traitement

L’extraction, le nettoyage et l’OCR ont lieu sur l’appareil de l’utilisateur. Readability, DOMPurify, Tesseract.js et les modèles français/anglais sont intégrés à l’extension. Liro n’envoie lui-même ni texte, ni capture, ni résultat OCR à Internet. En mode automatique, la synthèse vocale choisit la meilleure voix française naturelle exposée par le navigateur, puis une voix locale en repli. Une voix marquée comme service en ligne — notamment Microsoft Denise, Microsoft Henri ou une voix Google — peut faire traiter le texte prononcé par son fournisseur selon ses propres conditions. Une voix indiquée comme locale reste traitée sur l’appareil.

## Données stockées

Les préférences (calibrage, taille des étapes, contexte, coach, encouragements, police, taille, espacements, thème, guide, voix, vitesse et langue OCR) sont conservées dans `chrome.storage.local`.

Si l’option de reprise est activée, Liro conserve pour les articles uniquement : un hash SHA-256 de l’adresse normalisée, une empreinte du document, une empreinte du passage, le numéro de l’étape, le nombre d’étapes et la date. L’adresse brute, le titre et le texte ne sont jamais stockés. Les reprises sont limitées aux 50 plus récentes et supprimées après 30 jours.

Le texte des pages, les sélections, les captures et les résultats OCR ne sont pas enregistrés. Les images temporaires sont libérées après traitement ou annulation.

## Effacer les préférences et les reprises

Le panneau Réglages permet de désactiver la reprise et d’effacer toutes les positions enregistrées. Supprimer Liro depuis la page des extensions efface également son stockage local. Pour tout réinitialiser sans désinstaller, ouvrir les outils de développement de l’extension et exécuter `chrome.storage.local.clear()`.

## Partage et vente

Le développeur ne reçoit, ne vend ni ne loue les données personnelles ou les contenus de lecture. Liro ne les transmet pas à un serveur applicatif ; une voix de synthèse en ligne peut toutefois transmettre le texte à son fournisseur, comme indiqué plus haut. Aucun cookie de suivi n’est créé.

Les données sont utilisées uniquement pour les fonctions de lecture demandées, conformément aux règles d’utilisation limitée des données du Chrome Web Store. Elles ne servent ni à la publicité, ni à la détermination de la solvabilité ou à l’octroi de prêts.

## Portée

Liro est un outil de confort de lecture. Ce n’est pas un dispositif médical et il ne fournit aucun diagnostic, traitement ou conseil médical.
