import { useMemo } from "react";
import { MapContainer, TileLayer, Rectangle, Tooltip } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslation } from "react-i18next";

/**
 * VO-11 : sélecteur cartographique complémentaire au <Select> de zone.
 * Les zones du référentiel portent une bbox (bbox_lng_min/lat_min/lng_max/lat_max,
 * cf. src/engines/loader.ts) qui n'était jusqu'ici jamais exploitée dans l'UI.
 * Ce composant dessine un rectangle par zone sur une carte OpenStreetMap ;
 * cliquer un rectangle sélectionne la zone (même effet que choisir dans le <Select>).
 */

export interface ZoneOption {
  code: string;
  label: string;
  bbox_lng_min?: number | null;
  bbox_lat_min?: number | null;
  bbox_lng_max?: number | null;
  bbox_lat_max?: number | null;
}

type ZoneWithBbox = ZoneOption & {
  bbox_lng_min: number;
  bbox_lat_min: number;
  bbox_lng_max: number;
  bbox_lat_max: number;
};

const MOROCCO_CENTER: [number, number] = [31.5, -6.5];
const MOROCCO_ZOOM = 5;
const SELECTED_COLOR = "#C0552F";
const DEFAULT_COLOR = "#94a3b8";

function hasBbox(z: ZoneOption): z is ZoneWithBbox {
  return (
    typeof z.bbox_lng_min === "number" &&
    typeof z.bbox_lat_min === "number" &&
    typeof z.bbox_lng_max === "number" &&
    typeof z.bbox_lat_max === "number"
  );
}

export function ZoneMapPicker({
  zones,
  value,
  onChange,
}: {
  zones: ZoneOption[];
  value: string;
  onChange: (code: string) => void;
}) {
  const { t } = useTranslation();
  const zonesWithBbox = useMemo(() => zones.filter(hasBbox), [zones]);

  if (zonesWithBbox.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        {t("wizard.mapNoZones")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border" style={{ height: 320 }}>
      <MapContainer
        center={MOROCCO_CENTER}
        zoom={MOROCCO_ZOOM}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {zonesWithBbox.map((z) => {
          const bounds: LatLngBoundsExpression = [
            [z.bbox_lat_min, z.bbox_lng_min],
            [z.bbox_lat_max, z.bbox_lng_max],
          ];
          const selected = z.code === value;
          return (
            <Rectangle
              key={z.code}
              bounds={bounds}
              pathOptions={{
                color: selected ? SELECTED_COLOR : DEFAULT_COLOR,
                weight: selected ? 3 : 1.5,
                fillOpacity: selected ? 0.35 : 0.12,
              }}
              eventHandlers={{ click: () => onChange(z.code) }}
            >
              <Tooltip sticky>{z.label}</Tooltip>
            </Rectangle>
          );
        })}
      </MapContainer>
    </div>
  );
}
