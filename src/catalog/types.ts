export type SourceId = 'google' | 'openlibrary' | 'isbndb' | 'custom';

export const SOURCE_NAMES: Record<SourceId, string> = {
  google: 'Google Books',
  openlibrary: 'Open Library',
  isbndb: 'ISBNdb',
  custom: 'Custom catalog',
};

/** One catalog record, in the shape of the imprint. */
export interface CatalogRecord {
  source: SourceId;
  title: string;
  creator: string;
  identifier: string;
  publisher: string;
  date: string;
  language: string;
  subjects: string[];
  description: string;
  coverUrl: string;
}

export interface CatalogKeys {
  googleApiKey: string;
  isbndbApiKey: string;
  customCatalogUrl: string;
  customCatalogKey: string;
}
