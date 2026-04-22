# Claude Notes

## Leaflet islands

Leaflet accesses `window` on import and breaks SSR. Always use `client:only="preact"` — never `client:load`, `client:idle`, or `client:visible`.
