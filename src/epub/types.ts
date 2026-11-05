import type { Files } from './archive';

/** The Dublin Core fields Colophon edits. */
export interface Meta {
  title: string;
  /** Authors, comma-separated. */
  creator: string;
  identifier: string;
  language: string;
  publisher: string;
  /** "2024" or "2024-04-15". */
  date: string;
  series: string;
  seriesIndex: string;
  subjects: string[];
  description: string;
}

export const EMPTY_META: Meta = {
  title: '',
  creator: '',
  identifier: '',
  language: 'en',
  publisher: '',
  date: '',
  series: '',
  seriesIndex: '',
  subjects: [],
  description: '',
};

export interface ManifestItem {
  id: string;
  href: string;
  /** Zip path the href resolves to. */
  path: string;
  mediaType: string;
  properties: string[];
  exists: boolean;
}

export interface Chapter {
  /** Manifest id. */
  id: string;
  /** Zip path when opened. */
  path: string;
  /** The first heading, or the <title>, or "Chapter n". */
  title: string;
  words: number;
  linear: boolean;
}

/** One line of the table of contents. Depth 0 is the top level. */
export interface TocEntry {
  label: string;
  /** Zip path, with an optional "#fragment". */
  target: string;
  depth: number;
}

export interface Cover {
  id: string;
  href: string;
  path: string;
  mediaType: string;
  bytes: Uint8Array;
  width: number;
  height: number;
  /** <meta name="cover" content="id"> (EPUB 2). */
  epub2: boolean;
  /** properties="cover-image" (EPUB 3). */
  epub3: boolean;
}

/** EPUB Accessibility 1.1 discovery metadata (schema.org properties). */
export interface A11yMeta {
  accessModes: string[];
  accessModeSufficient: string[];
  features: string[];
  hazards: string[];
  summary: string;
  conformsTo: string;
}

export interface ContainerFacts {
  mimetypeExists: boolean;
  mimetypeValid: boolean;
  /** The mimetype entry is the first in the zip and stored uncompressed. */
  mimetypeFirst: boolean;
  containerValid: boolean;
}

/** An EPUB as opened: the files and what Colophon read from them. Never mutated. */
export interface Edition {
  fileName: string;
  fileSize: number;
  files: Files;
  facts: ContainerFacts;
  opfPath: string;
  opfDir: string;
  opfXml: string;
  version: string;
  uniqueIdentifierId: string;
  meta: Meta;
  manifest: ManifestItem[];
  /** Spine idrefs, including ones the manifest does not list. */
  spine: { idref: string; linear: boolean }[];
  chapters: Chapter[];
  cover: Cover | null;
  /** Files in the archive that the manifest does not list. */
  orphans: string[];
  navPath: string;
  ncxPath: string;
  toc: TocEntry[];
  a11y: A11yMeta;
  totalWords: number;
}

/** A chapter's place in the edited reading order. */
export interface ChapterDraft {
  id: string;
  /** Zip path when opened. */
  path: string;
  /** New file name (no folder). Equal to the current name when unchanged. */
  fileName: string;
  /** False for spine items outside the main flow (a cover page, notes). */
  linear: boolean;
}

/**
 * Everything the reader has changed. Applied to the Edition when binding;
 * plain data, so it can be stored and restored.
 */
export interface Draft {
  meta: Meta;
  chapters: ChapterDraft[];
  /** The edited table of contents, or null to keep the archive's. */
  toc: TocEntry[] | null;
  /** A replacement cover image. */
  cover: { bytes: Uint8Array; mediaType: string; width: number; height: number } | null;
  /** Write both the EPUB 2 and EPUB 3 cover tags. */
  dualCoverTags: boolean;
  /** Zip paths to leave out. */
  removed: string[];
  /** Manifest ids to drop (items whose files are missing). */
  droppedItems: string[];
  /** Replacement text for files, by zip path (validation and accessibility fixes). */
  patched: Record<string, string>;
  /** Accessibility metadata to write, or null to keep the archive's. */
  a11y: A11yMeta | null;
}
