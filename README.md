# Liro — Garde le fil. Va au bout.

Extension de lecture adaptative, locale et sans compte pour comprendre un texte puis aller au bout, à son rythme.

Liro est une extension Chrome/Edge (Manifest V3) qui aide à garder le fil et à aller au bout des textes du web, à son rythme. Elle adapte localement une page pour aider à commencer, suivre, décoder et reprendre. Elle s’adresse en priorité aux étudiants, jeunes adultes et actifs, notamment TDAH ou dys, sans exiger de diagnostic. Ce logiciel n’est pas un dispositif médical et ne formule aucune promesse de traitement, de compréhension ou de vitesse.

## Pourquoi Liro ?

Les outils d’aide à la lecture que j’avais identifiés pour les personnes dys ou TDAH ne couvraient pas un besoin précis : rendre utilisables les textes non sélectionnables, par exemple dans une image ou une page numérisée. Liro associe un OCR entièrement local aux aides de lecture pour extraire le texte d’une zone visible, le corriger puis le lire avec une présentation adaptée, sans transmettre le contenu à un service externe.

## Fonctionnalités

- calibrage visuel A/B en quatre choix concrets, sans profil médical ;
- carte locale du document, durée estimée et entrée par section ;
- corridor de lecture en étapes courtes avec contexte précédent/suivant et progression non culpabilisante ;
- encouragements chaleureux et désactivables aux jalons de 25, 50 et 75 % des textes d’au moins 20 étapes ;
- entrées combinables « commencer », « garder le fil », « décoder » et « reprendre » ;
- coach explicable qui propose une aide après deux retours rapprochés, sans jamais modifier seul l’affichage ;
- reprise privée pendant 30 jours : seuls des hashes et une position sont conservés, jamais l’URL ou le texte ;
- lecture d’une sélection ou extraction de l’article principal avec Mozilla Readability ;
- polices Atkinson Hyperlegible, Lexend et OpenDyslexic embarquées, réglages typographiques couplés et thèmes ;
- guide par paragraphe ou ligne, ancrages visuels optionnels et synthèse vocale synchronisée ;
- sélection vocale multi-navigateur : meilleure voix française naturelle exposée par le navigateur, avec choix manuel et voix locales ;
- capture d’une zone visible, OCR Tesseract français/anglais entièrement local et correction du résultat ;
- préférences dans `chrome.storage.local` ; aucun document n’est enregistré ni transmis.

## Installation et développement

Prérequis : Node.js 20 ou plus récent et npm.

```bash
npm install
npm run dev
npm run lint
npm run test
npm run test:e2e
npm run build
```

`npm install` copie dans `public/` les polices, les workers, les cœurs WebAssembly et les modèles OCR provenant des dépendances npm. Ils sont donc incorporés au build et aucun CDN n’est interrogé pendant l’utilisation. Le build de production est plus volumineux qu’une extension de lecture classique (environ 35 Mo, principalement pour Tesseract), mais il reste autonome et fonctionne hors ligne.

## Installer le build dans Chrome ou Edge

1. Exécuter `npm install`, puis `npm run build`.
2. Ouvrir `chrome://extensions` (Chrome) ou `edge://extensions` (Edge).
3. Activer **Mode développeur**.
4. Choisir **Charger l’extension non empaquetée**.
5. Sélectionner le dossier `.output/chrome-mv3` du projet.
6. Épingler Liro dans la barre d’outils, puis l’ouvrir sur une page web classique.

Les raccourcis proposés sont `Alt+Maj+L` pour ouvrir le contenu contextuel (sélection, sinon article principal) et `Alt+Maj+V` pour faire la même chose en démarrant immédiatement la voix. Ils peuvent être modifiés dans `chrome://extensions/shortcuts`.

## Utilisation

- **Lire la sélection** : sélectionner du texte, ouvrir le popup, puis choisir l’action.
- **Lire cette page** : extrait les titres, paragraphes, listes, citations et blocs de code du contenu principal.
- **Scanner une zone** : dessiner un rectangle sur la partie visible, attendre l’OCR, corriger le texte, puis l’ouvrir.
- Au premier usage, choisir les quatre présentations qui demandent le moins d’effort.
- Sur la carte, sélectionner le besoin du moment puis commencer au début ou à une section.
- Dans le corridor, placer le focus sur le passage courant : `Espace` lance/met en pause la voix, `←`/`Page précédente` revient au passage précédent, `→`/`Page suivante` avance, `?` ouvre l’aide et `Échap` ferme uniquement la couche active.
- La règle de lecture accepte `↑`/`↓` ligne par ligne, `Page précédente`/`Page suivante` par cinq lignes, et `Début`/`Fin` pour rejoindre les extrémités.
- Dans le sélecteur OCR, `Entrée` numérise toute la zone visible, `Échap` annule et la souris permet toujours de dessiner un rectangle précis.

## Accessibilité

Le lecteur est utilisable au clavier, avec focus visible, boucles de focus dans les fenêtres actives, restauration du focus à la fermeture et annonces de progression. Les thèmes clair, crème et sombre, le zoom 200 % et la réduction des mouvements sont couverts par les scénarios de test. L’aide intégrée (« Raccourcis clavier ») détaille les commandes disponibles.

## Permissions et justification

| Permission  | Justification                                                               |
| ----------- | --------------------------------------------------------------------------- |
| `activeTab` | Accéder uniquement à l’onglet sur lequel l’utilisateur vient d’ouvrir Liro. |
| `scripting` | Injecter le lecteur et le sélecteur de zone après une action explicite.     |
| `storage`   | Enregistrer seulement les préférences d’affichage, de voix et d’OCR.        |
| `offscreen` | Exécuter Tesseract dans une page d’extension locale compatible MV3.         |

Aucune permission d’hôte globale n’est déclarée. Les ressources de police sont exposées en lecture au Shadow DOM, mais cela n’accorde aucun accès permanent aux pages.

## Architecture

- `src/entrypoints/background.ts` : orchestration, injection, capture et page offscreen ;
- `src/entrypoints/injected.tsx` : lecteur Shadow DOM et sélection OCR ;
- `src/entrypoints/offscreen/` : recadrage et worker Tesseract local ;
- `src/features/` : extraction, segmentation, ancrage, TTS et réglages testables ;
- `src/components/` : lecteur, barre d’outils et vérification OCR ;
- `fixtures/` et `e2e/` : pages et scénarios Playwright.

Le contenu source passe par DOMPurify avant conversion. Le lecteur rend des blocs sémantiques, cache la variante visuelle aux technologies d’assistance et conserve une seule version accessible du texte. Les blocs de code ne sont jamais transformés. Le moteur Focus découpe localement les paragraphes aux limites de phrases et construit une carte à partir des titres. Le moteur Décodage applique seulement les préférences choisies par la personne.

La reprise est réservée aux articles. La clé de page, l’empreinte du document et l’empreinte du passage sont calculées en SHA-256 ; `chrome.storage.local` ne reçoit ni URL brute, ni titre, ni contenu. Les 50 reprises les plus récentes expirent après 30 jours et peuvent être désactivées ou effacées.

## Tests

- `npm run typecheck` : TypeScript strict ;
- `npm run lint` : ESLint ;
- `npm test` : segmentation, découpage adaptatif, coach, reprise privée, réglages/migration et assainissement ;
- `npm run test:e2e` : build puis scénarios Chromium avec les pages locales ;
- `npm run build` : bundle installable dans `.output/chrome-mv3`.

Les tests E2E lancent un serveur local de fixtures et Chromium ; aucun site externe ni donnée personnelle n’est requis. Les sorties `.output/`, `playwright-report/` et `test-results/` sont ignorées par Git.

## Limites connues du MVP

- Chrome interdit l’injection dans ses pages internes, le Chrome Web Store et certaines pages protégées.
- L’OCR ne traite que la zone visible et sa précision dépend de la résolution et du contraste ; il ne reconnaît ni écriture manuscrite ni tableaux complexes.
- Le premier OCR charge localement environ 30 Mo d’assets et peut prendre quelques secondes.
- La voix automatique s’adapte aux services exposés par le navigateur et le système : Denise sur Edge lorsqu’elle existe, une voix française naturelle sur Chrome, puis la meilleure voix locale disponible. Sans événement mot-à-mot fiable, Liro souligne la phrase entière.
- L’extraction Readability peut échouer sur des interfaces applicatives atypiques ; la sélection ou l’OCR restent disponibles.
- Firefox n’est pas livré dans ce MVP ; la logique métier évite toutefois les API Chrome hors de la couche navigateur.

## Suite proposée

Après retours utilisateurs : réduire la taille des cœurs OCR selon les navigateurs cibles, ajouter des tests manuels avec lecteurs d’écran (NVDA/JAWS/VoiceOver), valider Firefox desktop et améliorer la conservation des liens lors de l’extraction sans augmenter les permissions.

Voir [PRIVACY.md](./PRIVACY.md) et [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md).

## Statut du projet

Liro est un MVP en validation auprès de premiers testeurs. Les fonctions de confort peuvent faciliter la lecture selon les préférences de chacun ; elles ne constituent ni un traitement ni une promesse médicale. Les retours reproductibles (page, action, navigateur, sans texte privé) sont les plus utiles pour stabiliser l’extension.
