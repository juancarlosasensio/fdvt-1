import { useEffect, useRef } from 'preact/hooks';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import locationsData from '../../data/locations.geojson';

// Fix broken default marker icons — reference PNGs from public/ to avoid Vite resolution issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: '/marker-icon.png',
  iconRetinaUrl: '/marker-icon-2x.png',
  shadowUrl: '/marker-shadow.png',
});

const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const DISPLAY_KEYS = ['PRIMARYADD', 'SITETYPE', 'TOWNNAME', 'COUNTY', 'STATE', 'ZIP'];

function buildPopup(props: Record<string, any>): string {
  const title = props.name ?? props.PRIMARYADD ?? 'Location';
  const rows = DISPLAY_KEYS
    .filter((k) => props[k] != null && typeof props[k] === 'string')
    .map((k) => `<tr><td style="padding:2px 6px 2px 0;color:#555">${k}</td><td style="padding:2px 0">${props[k]}</td></tr>`)
    .join('');
  return `<strong>${title}</strong>${rows ? `<table style="margin-top:4px;border-collapse:collapse">${rows}</table>` : ''}`;
}

interface Props {
  height?: string;
  zoom?: number;
  tileUrl?: string;
  attribution?: string;
}

export default function LocationMap({
  height = '500px',
  zoom = 13,
  tileUrl = OSM_TILE,
  attribution = OSM_ATTR,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current);
    L.tileLayer(tileUrl, { attribution }).addTo(map);

    const cluster = (L as any).markerClusterGroup({
      chunkedLoading: true,
      iconCreateFunction(c: any) {
        const count = c.getChildCount();
        let size: number;
        let color: string;
        if (count < 10) {
          size = 36; color = '#60a5fa';
        } else if (count < 40) {
          size = 44; color = '#2563eb';
        } else {
          size = 52; color = '#1e3a8a';
        }
        return L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${size < 44 ? 13 : 15}px;box-shadow:0 1px 4px rgba(0,0,0,.4)">${count}</div>`,
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });

    const nonPointLayers: L.Layer[] = [];

    for (const feature of (locationsData as GeoJSON.FeatureCollection).features) {
      if (!feature.geometry) continue;
      const popup = buildPopup((feature.properties ?? {}) as Record<string, any>);

      if (feature.geometry.type === 'Point') {
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
        cluster.addLayer(L.marker([lat, lng]).bindPopup(popup));
      } else {
        nonPointLayers.push(L.geoJSON(feature).bindPopup(popup));
      }
    }

    map.addLayer(cluster);
    nonPointLayers.forEach((l) => l.addTo(map));

    if (cluster.getLayers().length === 1 && (locationsData as GeoJSON.FeatureCollection).features[0]?.geometry?.type === 'Point') {
      const [lng, lat] = ((locationsData as GeoJSON.FeatureCollection).features[0].geometry as GeoJSON.Point).coordinates;
      map.setView([lat, lng], zoom);
    } else if (cluster.getLayers().length > 0) {
      map.fitBounds(cluster.getBounds());
    }

    return () => { map.remove(); };
  }, []);

  return <div ref={containerRef} style={{ height, width: '100%' }} />;
}
