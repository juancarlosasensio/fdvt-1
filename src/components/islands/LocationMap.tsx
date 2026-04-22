import { useEffect, useRef } from 'preact/hooks';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import locationsData from '../../data/locations.geojson';

// Fix broken default marker icons with Vite/webpack bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
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

    const features: L.Layer[] = [];

    for (const feature of (locationsData as GeoJSON.FeatureCollection).features) {
      if (!feature.geometry) continue;
      const popup = buildPopup((feature.properties ?? {}) as Record<string, any>);

      if (feature.geometry.type === 'Point') {
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
        features.push(L.marker([lat, lng]).bindPopup(popup));
      } else {
        features.push(L.geoJSON(feature).bindPopup(popup));
      }
    }

    const group = L.featureGroup(features).addTo(map);

    if (features.length === 1 && (locationsData as GeoJSON.FeatureCollection).features[0]?.geometry?.type === 'Point') {
      const [lng, lat] = ((locationsData as GeoJSON.FeatureCollection).features[0].geometry as GeoJSON.Point).coordinates;
      map.setView([lat, lng], zoom);
    } else if (features.length > 0) {
      map.fitBounds(group.getBounds());
    }

    return () => { map.remove(); };
  }, []);

  return <div ref={containerRef} style={{ height, width: '100%' }} />;
}
