/**
 * Minimal class joiner.
 *
 * Deliberately not clsx + tailwind-merge. Magic UI components ship expecting
 * that pair, but pulling in two dependencies to concatenate strings fails the
 * "no unused deps" rule, and tailwind-merge only earns its keep when a
 * component carries default utilities a caller needs to override.
 *
 * The adapted components here carry no default colour utilities at all, so
 * there is nothing to merge away and a plain join is correct. If a component
 * is ever added that does need real conflict resolution, install the pair then
 * rather than pretending this function does something it does not.
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}
