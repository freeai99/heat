import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
} from "react-leaflet";
import type {
  FeatureCollection,
  Geometry,
} from "geojson";

import boundary from "../data/jaipur-boundary.json";
import type { Ward } from "../types/wards";
import type { WardRisk } from "../lib/wardRisk";
import { boundsOf } from "../lib/wards";

const JAIPUR_CENTER: [number, number] = [
  26.9124,
  75.7873,
];

function FitBounds({
  wards,
}: {
  wards: Ward[];
}) {
  const map = useMap();

  useEffect(() => {
    const bounds = boundsOf(wards);

    if (bounds) {
      map.fitBounds(bounds, {
        padding: [16, 16],
      });
    }
  }, [map, wards]);

  return null;
}

function riskColor(level?: WardRisk["level"]): string {
  switch (level) {
    case "EXTREME":
      return "#dc2626";

    case "HIGH":
      return "#ea580c";

    case "MODERATE":
      return "#eab308";

    case "LOW":
      return "#16a34a";

    default:
      return "#94a3b8";
  }
}

export default function WardMap({
  wards,
  risks,
  selectedId,
  onSelect,
}: {
  wards: Ward[];
  risks?: Record<string, WardRisk>;
  selectedId?: string | null;
  onSelect?: (ward: Ward) => void;
}) {
  const selectedRef = useRef(selectedId);

  selectedRef.current = selectedId;

  const wardCollection = useMemo<
    FeatureCollection<Geometry>
  >(
    () => ({
      type: "FeatureCollection",

      features: wards.map((ward) => ({
        type: "Feature",

        properties: {
          id: ward.id,

          label:
            ward.name ??
            ward.wardNumber ??
            ward.id,

          wardNumber: ward.wardNumber,

          risk: risks?.[ward.id]?.riskScore ?? null,

          level:
            risks?.[ward.id]?.level ?? null,
        },

        geometry: ward.geometry as Geometry,
      })),
    }),
    [wards, risks],
  );

  return (
    <MapContainer
      center={JAIPUR_CENTER}
      zoom={11}
      scrollWheelZoom={true}
      style={{
        height: "100%",
        width: "100%",
      }}
      className="rounded-md"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <GeoJSON
        data={
          boundary as unknown as FeatureCollection<Geometry>
        }
        style={{
          color: "#475569",
          weight: 2,
          fillOpacity: 0.02,
          dashArray: "4 3",
        }}
      />

      {wards.length > 0 ? (
        <>
          <GeoJSON
            key={`${wards.length}-${wards[0]?.id ?? ""}-${selectedId ?? ""}-${JSON.stringify(
              risks,
            )}`}
            data={wardCollection}
            style={(feature) => {
              const id = String(
                feature?.properties?.["id"] ?? "",
              );

              const risk = risks?.[id];

              const isSelected =
                id === selectedRef.current;

              return {
                color: isSelected
                  ? "#111827"
                  : "#ffffff",

                weight: isSelected
                  ? 3
                  : 1,

                fillColor: riskColor(
                  risk?.level,
                ),

                fillOpacity: isSelected
                  ? 0.75
                  : 0.55,
              };
            }}
            onEachFeature={(feature, layer) => {
              const id = String(
                feature.properties?.["id"] ?? "",
              );

              const label = String(
                feature.properties?.["label"] ??
                  "Ward",
              );

              const risk = risks?.[id];

              const tooltip = risk
                ? `
                  <div style="min-width:140px">
                    <strong>${label}</strong>
                    <br/>
                    Risk: <strong>${risk.riskScore}/100</strong>
                    <br/>
                    Level: <strong>${risk.level}</strong>
                    <br/>
                    WBGT: ${risk.wbgt ?? "—"} °C
                    <br/>
                    UTCI: ${risk.utci ?? "—"} °C
                  </div>
                `
                : `
                  <strong>${label}</strong>
                  <br/>
                  Risk calculation unavailable
                `;

              layer.bindTooltip(tooltip, {
                sticky: true,
              });

              layer.on("click", () => {
                const ward = wards.find(
                  (w) => w.id === id,
                );

                if (ward && onSelect) {
                  onSelect(ward);
                }
              });
            }}
          />

          <FitBounds wards={wards} />
        </>
      ) : null}
    </MapContainer>
  );
}
