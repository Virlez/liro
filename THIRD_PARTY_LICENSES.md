# Licences tierces

Le code propre à Liro est fourni dans ce dépôt à des fins de développement du MVP. Les dépendances conservent leurs licences respectives :

| Composant                                        | Licence                                        | Usage                       |
| ------------------------------------------------ | ---------------------------------------------- | --------------------------- |
| WXT                                              | MIT                                            | Construction de l’extension |
| React / React DOM                                | MIT                                            | Interfaces utilisateur      |
| Mozilla Readability                              | Apache-2.0                                     | Extraction d’article        |
| DOMPurify                                        | Apache-2.0 ou MPL-2.0                          | Assainissement HTML         |
| Tesseract.js / tesseract.js-core                 | Apache-2.0                                     | OCR local                   |
| Données Tesseract `fra` et `eng`                 | Apache-2.0                                     | Modèles OCR locaux          |
| Atkinson Hyperlegible                            | SIL Open Font License 1.1                      | Police embarquée            |
| Lexend                                           | SIL Open Font License 1.1                      | Police embarquée            |
| OpenDyslexic                                     | SIL Open Font License 1.1                      | Police embarquée            |
| TypeScript, Vitest, Playwright, ESLint, Prettier | licences indiquées par leurs distributions npm | Outils de développement     |

Les textes de licence faisant autorité sont disponibles dans chaque paquet sous `node_modules/<paquet>/LICENSE*` après `npm install`. Les fichiers de police ne sont ni renommés comme famille ni modifiés ; seuls les sous-ensembles latins nécessaires sont copiés dans le build.
