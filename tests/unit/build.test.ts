import { describe, expect, it } from 'vitest';
import { buildEpub } from '../../src/epub/build';
import { markdownToXhtml, splitManuscript, textToXhtml } from '../../src/epub/markdown';
import { newDraft } from '../../src/epub/draft';
import { openEpub } from '../../src/epub/open';
import { EMPTY_META } from '../../src/epub/types';
import { validate } from '../../src/epub/validate';
import { wellFormedError } from '../../src/epub/xml';

describe('markdown', () => {
  it('writes well-formed XHTML', () => {
    const out = markdownToXhtml(`# A <title> & more

Some *em*, **strong**, \`code\` and a [link](https://example.org?a=1&b=2).

- one
- two

1. first

> A quote
> that wraps

---

\`\`\`
<raw> & code
\`\`\``);
    expect(out).toContain('<h1>A &lt;title&gt; &amp; more</h1>');
    expect(out).toContain('<em>em</em>');
    expect(out).toContain('<strong>strong</strong>');
    expect(out).toContain('<ul><li>one</li><li>two</li></ul>');
    expect(out).toContain('<ol><li>first</li></ol>');
    expect(out).toContain('<blockquote><p>A quote that wraps</p></blockquote>');
    expect(out).toContain('<pre><code>&lt;raw&gt; &amp; code</code></pre>');
    expect(wellFormedError(`<div>${out}</div>`)).toBeNull();
  });

  it('splits a manuscript at its headings', () => {
    expect(splitManuscript('Foreword text\n\n# One\nBody\n\n# Two\nMore').map((c) => c.title)).toEqual(['Opening', 'One', 'Two']);
    expect(splitManuscript('## A\nx\n## B\ny').map((c) => c.title)).toEqual(['A', 'B']);
    expect(splitManuscript('No headings at all')).toEqual([{ title: 'Chapter 1', body: 'No headings at all' }]);
    expect(splitManuscript('   ')).toEqual([]);
  });

  it('turns plain text into paragraphs', () => {
    expect(textToXhtml('One\nline.\n\nTwo & three', 'Notes')).toBe('<h1>Notes</h1>\n<p>One line.</p>\n<p>Two &amp; three</p>');
  });
});

describe('the builder', () => {
  it('makes an EPUB 3 that passes validation', () => {
    const data = buildEpub({
      meta: { ...EMPTY_META, title: 'Notes', creator: 'A. Writer', series: 'Field notes', seriesIndex: '3' },
      chapters: splitManuscript('# One\nFirst.\n\n# Two\nSecond.').map((c) => ({ title: c.title, body: markdownToXhtml(c.body) })),
    });
    const edition = openEpub(data);
    expect(edition.version).toBe('3.0');
    expect(edition.chapters.map((c) => c.title)).toEqual(['One', 'Two']);
    expect(edition.meta.series).toBe('Field notes');
    expect(edition.meta.identifier).toMatch(/^urn:uuid:/);
    expect(validate(edition, newDraft(edition))).toEqual([]);
  });
});
