import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useStore, getState, statusOf } from '../../lib/store';
import { fieldsForLists } from '../../lib/filters';
import { Empty } from '../ui';
import { MapPin } from 'lucide-react';
import type { ViewProps } from '../../pages/LocationPage';

const pin = (color: string) => L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [22, 22], iconAnchor: [11, 22],
});

export default function MapView({ tasks, listIds }: ViewProps) {
  useStore((s) => s.data.field);
  const locFields = fieldsForLists(listIds).filter((f) => f.type === 'location');
  const points = tasks.flatMap((t) => locFields.map((f) => ({ t, v: t.fields?.[f.id] })).filter((x) => x.v && (x.v.lat || x.v.lng)));
  if (!locFields.length) return <Empty icon={<MapPin size={36} />} title="Add a Location Custom Field" body="Map view plots tasks using a Location Custom Field. Open the location's settings → Custom Fields → New field → Location, then set addresses on tasks." />;
  const center: [number, number] = points.length ? [points.reduce((a, p) => a + p.v.lat, 0) / points.length, points.reduce((a, p) => a + p.v.lng, 0) / points.length] : [20, 0];
  return (
    <div className="h-full relative">
      <MapContainer center={center} zoom={points.length ? 4 : 2} style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {points.map(({ t, v }, i) => (
          <Marker key={t.id + i} position={[v.lat, v.lng]} icon={pin(statusOf(t)?.color || '#6E56CF')}>
            <Popup><div className="text-[13px]"><b>{t.name}</b><div className="text-xs text-gray-500">{v.address}</div><button className="mt-1 text-xs text-blue-600" onClick={() => getState().openTask(t.id)}>Open task</button></div></Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="absolute top-3 right-3 z-[500] pop px-3 py-2 text-xs">{points.length} of {tasks.length} tasks have a location</div>
    </div>
  );
}
