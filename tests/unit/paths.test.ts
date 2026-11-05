import { describe, expect, it } from 'vitest';
import { basename, dirname, isExternal, relativePath, resolvePath, splitExt, splitFragment } from '../../src/epub/paths';

describe('zip paths', () => {
  it('resolves hrefs against a folder', () => {
    expect(resolvePath('OEBPS/text/', '../images/a%20b.jpg')).toBe('OEBPS/images/a b.jpg');
    expect(resolvePath('OEBPS/', 'text/ch1.xhtml#note')).toBe('OEBPS/text/ch1.xhtml');
    expect(resolvePath('', '/root.xhtml')).toBe('root.xhtml');
    expect(resolvePath('OEBPS/', './a/./b.css?v=2')).toBe('OEBPS/a/b.css');
  });

  it('writes the relative href back', () => {
    expect(relativePath('OEBPS/text/', 'OEBPS/images/a b.jpg')).toBe('../images/a%20b.jpg');
    expect(relativePath('OEBPS/', 'OEBPS/text/ch1.xhtml')).toBe('text/ch1.xhtml');
    expect(relativePath('', 'OEBPS/content.opf')).toBe('OEBPS/content.opf');
    expect(relativePath('OEBPS/text/', 'OEBPS/text/ch2.xhtml')).toBe('ch2.xhtml');
  });

  it('splits names', () => {
    expect(dirname('a/b/c.xhtml')).toBe('a/b/');
    expect(basename('a/b/c.xhtml')).toBe('c.xhtml');
    expect(splitExt('c.tar.gz')).toEqual(['c.tar', 'gz']);
    expect(splitFragment('a.xhtml#x')).toEqual(['a.xhtml', '#x']);
    expect(isExternal('https://example.org')).toBe(true);
    expect(isExternal('mailto:a@b.c')).toBe(true);
    expect(isExternal('../a.xhtml')).toBe(false);
  });
});
