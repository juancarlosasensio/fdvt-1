// @ts-check
import { defineConfig } from 'astro/config';

import preact from '@astrojs/preact';

// https://astro.build/config
export default defineConfig({
  integrations: [preact()],
  vite: {
    plugins: [{
      name: 'vite-plugin-geojson',
      transform(src, id) {
        if (id.endsWith('.geojson')) return { code: `export default ${src}`, map: null };
      },
    }],
  },
});