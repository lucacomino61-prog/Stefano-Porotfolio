# Vendored fonts

Both faces are licensed under the **SIL Open Font License 1.1**, which permits
redistribution as part of a software package. They are vendored here rather
than fetched from Google Fonts at build time, which removes an external
dependency from the build and means no request leaves the origin at runtime.

| File | Family | Author | Licence |
| --- | --- | --- | --- |
| `Archivo-Variable.woff2` | [Archivo](https://fonts.google.com/specimen/Archivo) | Omnibus-Type | [OFL 1.1](https://openfontlicense.org/) |
| `MartianMono-Variable.woff2` | [Martian Mono](https://fonts.google.com/specimen/Martian+Mono) | Evil Martians | [OFL 1.1](https://openfontlicense.org/) |

Both are the **latin** subset only, which covers every character this site
needs: Albanian's ç and ë and all Italian accents live in U+0000–00FF, as does
the typographic apostrophe.

Archivo is used with its width axis (`wdth` 62–125), which must be declared on
the `@font-face` via `declarations` in `next/font/local` or the browser ignores
`font-stretch` entirely. Martian Mono has `adjustFontFallback` off on purpose:
adjusting a monospace against Arial's metrics shifts the tabular columns it
exists to align.

Under the OFL these files may be redistributed and modified, but not sold on
their own, and the licence must travel with them.
