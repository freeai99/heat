import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  calculateVulnerability,
  clearDemographicsDataset,
  getWardDemographics,
  loadDemographicsDataset,
  parseDemographicsCsv,
  parseDemographicsJson,
  saveDemographicsDataset,
  summarizeDemographics,
} from "../lib/demographics";

import type {
  DemographicsDataset,
} from "../types/demographics";

import { AppShell } from "../components/AppShell";
import { SourceTag } from "../components/SourceTag";
import {
  builtInWardDataset,
  clearWardDataset,
  loadWardDataset,
  saveWardDataset,
  validateWardGeoJSON,
} from "../lib/wards";
import type { Ward, WardDataset } from "../types/wards";

const WardMap = lazy(() => import("../components/WardMap"));

export const Route = createFileRoute("/wards")({
  head: () => ({
    meta: [
      { title: "Ward Boundaries & Map — Jaipur Heat EWS" },
      {
        name: "description",
        content:
          "Import verified Jaipur ward boundary GeoJSON, validate it, and view wards on the real municipal boundary map.",
      },
      { property: "og:title", content: "Ward Boundaries & Map — Jaipur Heat EWS" },
      {
        property: "og:description",
        content:
          "Validated ward geometry import and map view for Jaipur ward-level heat risk analysis.",
      },
    ],
  }),
  component: WardsPage,
});

function formatArea(km2: number): string {
  return km2 >= 10 ? km2.toFixed(1) : km2.toFixed(2);
}

function WardsPage() {
  const [dataset, setDataset] = useState<WardDataset | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [demographics, setDemographics] =
  useState<DemographicsDataset | null>(null);

const [demographicErrors, setDemographicErrors] =
  useState<string[]>([]);

const [demographicWarnings, setDemographicWarnings] =
  useState<string[]>([]);

const demographicFileRef =
  useRef<HTMLInputElement>(null);

const [demographicSourceLabel, setDemographicSourceLabel] =
  useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
  setDataset(loadWardDataset() ?? builtInWardDataset());
  setDemographics(loadDemographicsDataset());
}, []);

  async function handleFile(file: File) {
    setErrors([]);
    setWarnings([]);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setErrors(["The selected file is not valid JSON."]);
      return;
    }
    const result = validateWardGeoJSON(parsed);
    setWarnings(result.warnings);
    if (!result.ok) {
      setErrors(result.errors.slice(0, 12));
      return;
    }
    const next: WardDataset = {
      fileName: file.name,
      sourceLabel: sourceLabel.trim() || "Operator-supplied file (provenance not recorded)",
      importedAt: new Date().toISOString(),
      wards: result.wards,
    };
    saveWardDataset(next);
    setDataset(next);
    setSelectedId(null);
  }
  async function handleDemographicsFile(file: File) {
  setDemographicErrors([]);
  setDemographicWarnings([]);

  try {
    const extension = file.name
      .split(".")
      .pop()
      ?.toLowerCase();

    let result;

    if (extension === "csv") {
      result = parseDemographicsCsv(await file.text());
    } else if (extension === "json") {
      const parsed = JSON.parse(await file.text());
      result = parseDemographicsJson(parsed);
    } else {
      setDemographicErrors([
        "Only CSV and JSON demographic files are supported.",
      ]);
      return;
    }

    setDemographicWarnings(result.warnings);

    if (!result.ok) {
      setDemographicErrors(
        result.errors.slice(0, 20),
      );
      return;
    }

    const next: DemographicsDataset = {
      fileName: file.name,
      sourceLabel:
        demographicSourceLabel.trim() ||
        "Operator-supplied demographic dataset",
      importedAt: new Date().toISOString(),
      records: result.records,
    };

    saveDemographicsDataset(next);
    setDemographics(next);
  } catch (error) {
    setDemographicErrors([
      error instanceof Error
        ? `Unable to import demographic file: ${error.message}`
        : "Unable to import demographic file.",
    ]);
  }
}

  const wards: Ward[] = dataset?.wards ?? [];
  const selected = wards.find((w) => w.id === selectedId) ?? null;
  const totalArea = wards.reduce((sum, w) => sum + w.areaKm2, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="panel p-4 sm:p-5">
          <h2 className="font-display text-lg font-semibold">Ward boundaries</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Ward-level analysis requires an authoritative ward boundary file. No ward polygons are
            invented by this system: until a verified GeoJSON file is imported, only the real Jaipur
            municipal boundary is shown.
          </p>
          <SourceTag
            kind="STATIC"
            source="Jaipur municipal boundary — OpenStreetMap relation 14277849 (ODbL)"
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="panel overflow-hidden p-2">
            <div className="h-[420px] w-full sm:h-[520px]">
              <ClientOnly
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Loading map…
                  </div>
                }
              >
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Loading map…
                    </div>
                  }
                >
                  <WardMap wards={wards} selectedId={selectedId} onSelect={(w) => setSelectedId(w.id)} />
                </Suspense>
              </ClientOnly>
            </div>
          </section>

          <section className="panel space-y-4 p-4 sm:p-5">
            <div>
              <h3 className="font-display text-base font-semibold">Import ward GeoJSON</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Expects a WGS84 (EPSG:4326) FeatureCollection of Polygon/MultiPolygon ward features.
                Ward number, name and zone are read from the file&apos;s own properties.
              </p>
            </div>

            <label className="block text-xs font-medium">
              Source / provenance
              <input
                value={sourceLabel}
                onChange={(e) => setSourceLabel(e.target.value)}
                placeholder="e.g. JMC ward delimitation 2023"
                className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
              />
            </label>

            <input
              ref={fileRef}
              type="file"
              accept=".json,.geojson,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
              className="block w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground"
            />

            {errors.length > 0 ? (
              <ul className="space-y-1 rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
            {warnings.length > 0 ? (
              <ul className="space-y-1 rounded border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}

            {dataset ? (
              <div className="space-y-1 border-t border-border pt-3 text-xs">
                <p>
                  <span className="font-semibold">{dataset.wards.length}</span> wards ·{" "}
                  {formatArea(totalArea)} km² total
                </p>
                <p className="text-muted-foreground">File: {dataset.fileName}</p>
                <p className="text-muted-foreground">Source: {dataset.sourceLabel}</p>
                <p className="text-muted-foreground">
                  Imported: {new Date(dataset.importedAt).toLocaleString("en-IN")}
                </p>
                <button
                  onClick={() => {
                    clearWardDataset();
                    setDataset(null);
                    setSelectedId(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="mt-2 rounded border border-input px-2 py-1 text-xs font-medium hover:bg-accent"
                >
                  Remove dataset
                </button>
              </div>
            ) : (
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                No ward dataset loaded. Ward risk scoring stays disabled until verified geometry is
                imported.
              </p>
            )}

            {selected ? (
              <div className="rounded border border-border p-2 text-xs">
                <p className="font-semibold">
                  {selected.name ?? "Unnamed ward"}
                  {selected.wardNumber ? ` · Ward ${selected.wardNumber}` : ""}
                </p>
                <p className="text-muted-foreground">Zone: {selected.zone ?? "Not provided"}</p>
                <p className="text-muted-foreground">
                  Area: {formatArea(selected.areaKm2)} km² (derived) · Centroid{" "}
                  {selected.centroid[1].toFixed(4)}, {selected.centroid[0].toFixed(4)}
                </p>
              </div>
            ) : null}
          </section>
        </div>

        <section className="panel p-4 sm:p-5">
          <h3 className="font-display text-base font-semibold">Ward register</h3>
          {wards.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing to list yet — import a verified ward boundary file to populate this register.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Ward no.</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Zone</th>
                    <th className="py-2 pr-3 text-right">Area (km²)</th>
                  </tr>
                </thead>
                <tbody>
                  {wards.map((ward) => (
                    <tr
                      key={ward.id}
                      onClick={() => setSelectedId(ward.id)}
                      className={`cursor-pointer border-b border-border/60 hover:bg-accent/50 ${
                        ward.id === selectedId ? "bg-accent" : ""
                      }`}
                    >
                      <td className="py-1.5 pr-3 font-mono text-xs">
                        {ward.wardNumber ?? "Not provided"}
                      </td>
                      <td className="py-1.5 pr-3">{ward.name ?? "Not provided"}</td>
                      <td className="py-1.5 pr-3">{ward.zone ?? "Not provided"}</td>
                      <td className="py-1.5 pr-3 text-right font-mono text-xs">
                        {formatArea(ward.areaKm2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <SourceTag
            kind={wards.length === 0 ? "STATIC" : "DERIVED"}
            source={
              dataset
                ? `Ward attributes as supplied in ${dataset.fileName}; area and centroid derived from the geometry`
                : "Awaiting operator-supplied ward boundary dataset"
            }
            timestamp={dataset ? new Date(dataset.importedAt).toLocaleString("en-IN") : null}
          />
        </section>
      </div>
    </AppShell>
  );
}
