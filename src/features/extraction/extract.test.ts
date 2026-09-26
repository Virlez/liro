import { describe, expect, it } from 'vitest';
import {
  cloneComposedDocument,
  extractArticleDocumentFrom,
  htmlToBlocks,
  sanitizeSourceHtml,
  selectPrimaryArticleRoot,
} from './extract';

describe('assainissement et conversion', () => {
  it('supprime scripts et gestionnaires événementiels', () => {
    const clean = sanitizeSourceHtml(
      '<p onclick="alert(1)">Texte</p><script>window.pwned=1</script>',
    );
    expect(clean).toContain('<p>Texte</p>');
    expect(clean).not.toMatch(/script|onclick/u);
  });

  it('supprime les URL dangereuses', () => {
    const clean = sanitizeSourceHtml('<a href="javascript:alert(1)">Lien</a>');
    expect(clean).toBe('<a>Lien</a>');
  });

  it('conserve le HTML sémantique autorisé', () => {
    const clean = sanitizeSourceHtml(
      '<article><h2>Titre</h2><blockquote>Citation</blockquote><ul><li>Point</li></ul></article>',
    );
    expect(clean).toContain('<h2>Titre</h2>');
    expect(clean).toContain('<blockquote>Citation</blockquote>');
    expect(clean).toContain('<li>Point</li>');
  });

  it('convertit titres, paragraphes, listes, citations et code', () => {
    const blocks = htmlToBlocks(
      '<h2>Titre</h2><p>Texte</p><ul><li>Point</li></ul><blockquote>Citation</blockquote><pre>const x = 1</pre>',
    );
    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'list-item',
      'quote',
      'code',
    ]);
    expect(blocks[0]).toMatchObject({ level: 2, originalText: 'Titre' });
  });

  it('aplatit un Shadow DOM ouvert et choisit le premier article substantiel', () => {
    const source = new DOMParser().parseFromString(
      `<!doctype html><html lang="fr"><head><title>Article dynamique</title></head><body>
        <article id="principal"><news-body></news-body></article>
        <article id="recommandation">
          <p>Autres articles recommandés avec un paragraphe suffisamment long pour être candidat.</p>
          <p>Cette recommandation ne doit jamais remplacer le contenu principal de la page.</p>
        </article>
      </body></html>`,
      'text/html',
    );
    const host = source.querySelector('news-body')!;
    host.attachShadow({ mode: 'open' }).innerHTML = `
      <h2>Le vrai intertitre</h2>
      <p>Le premier paragraphe du véritable article se trouve dans un composant Web dynamique.</p>
      <p>Le deuxième paragraphe contient la suite indispensable que le lecteur doit conserver.</p>
      <p>Le troisième paragraphe confirme que tout le corps de l’article a bien été extrait.</p>`;

    const composed = cloneComposedDocument(source);
    expect(composed.querySelector('#principal')?.textContent).toContain('véritable article');
    expect(selectPrimaryArticleRoot(composed)?.id).toBe('principal');

    const result = extractArticleDocumentFrom(source, 'https://example.com/article');
    const text = result?.blocks.map((block) => block.originalText).join(' ');
    expect(text).toContain('premier paragraphe du véritable article');
    expect(text).toContain('troisième paragraphe');
    expect(text).not.toContain('Autres articles recommandés');
  });
});
