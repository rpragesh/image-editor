/**
 * i18n entry point.
 *
 * Given a `RpEditorConfig.language` code, resolves to a `LocalePack`
 * containing all user-facing strings. English is the fallback for
 * unknown or missing codes.
 *
 * Locale codes are matched case-insensitively, and regional variants
 * (e.g. `de-DE`, `pt_BR`) are folded to their primary language tag
 * (`de`, `pt`). `sp` is accepted as an alias for `es`.
 */
import type { LanguageCode, LocalePack, LocalePackOverrides } from './types.js';
import { da } from './da.js';
import { de } from './de.js';
import { en } from './en.js';
import { es } from './es.js';
import { fr } from './fr.js';
import { it } from './it.js';
import { ko } from './ko.js';
import { nl } from './nl.js';
import { pl } from './pl.js';
import { pt } from './pt.js';
import { sv } from './sv.js';
import { th } from './th.js';
import { tr } from './tr.js';
import { vi } from './vi.js';
import { zh } from './zh.js';

const PACKS: Record<LanguageCode, LocalePack> = {
  da,
  de,
  en,
  es,
  fr,
  it,
  ko,
  nl,
  pl,
  pt,
  sv,
  th,
  tr,
  vi,
  zh,
};

const SUPPORTED = new Set<LanguageCode>(
  Object.keys(PACKS) as LanguageCode[],
);

/**
 * Resolve any user-provided string to a supported language code.
 * Returns `'en'` when the input is missing, malformed, or unknown.
 */
export function resolveLanguage(input?: string | null): LanguageCode {
  if (!input || typeof input !== 'string') return 'en';
  const primary = input.toLowerCase().trim().split(/[-_]/)[0];
  if (!primary) return 'en';
  // Accept 'sp' as a convenience alias for Spanish (ISO code is 'es').
  if (primary === 'sp') return 'es';
  return SUPPORTED.has(primary as LanguageCode)
    ? (primary as LanguageCode)
    : 'en';
}

/**
 * Fetch the resolved `LocalePack` for the given code. When the code
 * is missing or unknown, the English pack is returned.
 */
export function getLocalePack(input?: string | null): LocalePack {
  return PACKS[resolveLanguage(input)];
}

export type { LanguageCode, LocalePack, LocalePackOverrides };
