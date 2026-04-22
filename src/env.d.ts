/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
declare module '*.geojson' { const value: any; export default value; }
declare module 'leaflet.markercluster';
