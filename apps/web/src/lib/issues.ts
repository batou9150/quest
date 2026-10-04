import type { core } from 'zod';
import i18n from '../i18n';

/**
 * Validation issues as one readable line, e.g. "Title: Too small…".
 * `fieldName` turns an issue path into a translated field name; zod's own messages follow the site language (see i18n/index.ts).
 */
export function formatIssues(issues: readonly core.$ZodIssue[], fieldName: (path: readonly PropertyKey[]) => string | undefined): string {
  return issues
    .map((issue) => {
      const path = issue.path;
      const field = fieldName(path) ?? (path.map(String).join('.') || '—');
      return i18n.t('common.issue', { field, message: issue.message });
    })
    .join(' · ');
}
