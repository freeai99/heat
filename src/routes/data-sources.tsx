import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { AppShell } from "../components/AppShell";
import {
  formatIST,
  freshnessOf,
  imdQueryOptions,
  weatherQueryOptions,
} from "../lib/weatherQuery";
import { loadDemographicsDataset } from "../lib/demographics";

export const Route = createFileRoute("/data-sources")({
  head: () => ({
    meta: [
      { title: "Data Sources & Data Health | Jaipur Heat EWS" },
      {
        name: "description",
        content:
          "Every dataset behind the Jaipur heat early warning prototype: source, status, freshness and what is not yet connected.",
      },
      {
        property: "og:title",
        content: "Data Sources & Data Health — Jaipur Heat EWS",
      },
      {
        property: "og:description",
        content:
          "Transparent source, status and freshness for weather, satellite, ward, demographic and news datasets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),

  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(weatherQueryOptions),
      context.queryClient.ensureQueryData(imdQueryOptions),
    ]),

  component: DataSourcesPage,
});

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "Connected" || status === "Loaded"
      ? "bg-ok/15 text-ok"
      : status === "Degraded"
        ? "bg-warn/20 text-risk-3-foreground"
        : status === "Unavailable"
          ? "bg-destructive/15 text-destructive"
          : "bg-muted text-muted-foreground";

  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-bold ${tone}`}
    >
      {status}
    </span>
  );
}

function DataSourcesPage() {
  const { data: weather } =
    useSuspenseQuery(weatherQueryOptions);

  const { data: imd } =
    useSuspenseQuery(imdQueryOptions);

  const [demographics, setDemographics] =
    useState<ReturnType<typeof loadDemographicsDataset>>(null);

  useEffect(() => {
    setDemographics(loadDemographicsDataset());
  }, []);

  const imdStatus = !imd.configured
    ? "Not configured"
    : imd.ok
      ? "Connected"
      : "Degraded";

  const demographicsStatus = demographics
    ? "Loaded"
    : "Not loaded";

  const demographicsUpdated = demographics
    ? formatIST(demographics.importedAt)
    : "—";

  const rows = [
    {
      name: "Weather (primary)",
      provider: "Open-Meteo Forecast API",
      url: "https://open-meteo.com/",
      kind: "Live forecast/observation blend",
      status:
        weather.status === "GOOD"
          ? "Connected"
          : weather.status === "DEGRADED"
            ? "Degraded"
            : "Unavailable",
      updated: formatIST(weather.meta.retrievedAt),
      freshness: freshnessOf(weather.meta.retrievedAt),
    },
    {
      name: "Official Indian weather",
      provider:
        "India Meteorological Department (IMD)",
      url: "https://mausam.imd.gov.in/",
      kind: "Official observation / warning",
      status: imdStatus,
      updated: imd.ok
        ? formatIST(imd.retrievedAt)
        : "—",
      freshness: imd.ok
        ? freshnessOf(imd.retrievedAt)
        : "—",
    },
    {
      name: "Satellite land surface temperature",
      provider:
        "NASA MODIS MOD11A2 (8-day composite)",
      url: "https://lpdaac.usgs.gov/products/mod11a2v061/",
      kind: "Static composite — not live temperature",
      status: "Not configured",
      updated: "—",
      freshness: "—",
    },
    {
      name: "Ward boundaries",
      provider:
        "Bundled / operator-supplied Jaipur ward GeoJSON",
      url: "",
      kind: "Static verified geometry",
      status: "Loaded",
      updated: "—",
      freshness: "ARCHIVED",
    },
    {
      name: "Demographics / vulnerability",
      provider:
        "Operator-imported Census / municipal dataset",
      url: "",
      kind: "Static dataset — browser-local",
      status: demographicsStatus,
      updated: demographicsUpdated,
      freshness: demographics
        ? "ARCHIVED"
        : "—",
    },
    {
      name: "Public-impact signal",
      provider: "NewsAPI / public RSS",
      url: "https://newsapi.org/",
      kind: "Supporting evidence only",
      status: "Not configured",
      updated: "—",
      freshness: "—",
    },
    {
      name: "Human thermal stress (WBGT, UTCI)",
      provider:
        "Server-side deterministic calculation",
      url: "",
      kind: "Derived from live weather inputs",
      status: weather.derived
        ? "Connected"
        : "Unavailable",
      updated: weather.derived
        ? formatIST(weather.derived.calculatedAt)
        : "—",
      freshness: weather.derived
        ? "LIVE"
        : "—",
    },
  ];

  return (
    <AppShell>
      <h2 className="font-display text-2xl font-semibold">
        Data Sources &amp; Data Health
      </h2>

      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Nothing in this application is invented. Sources
        that are not yet connected are shown as such rather
        than filled with placeholder values.
      </p>

      <div className="panel mt-4 overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {[
                "Dataset",
                "Provider",
                "Type",
                "Status",
                "Last updated",
                "Freshness",
              ].map((heading) => (
                <th
                  key={heading}
                  className="label-caps px-4 py-2"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.name}
                className="border-b border-border/60 last:border-0 align-top"
              >
                <td className="px-4 py-3 font-semibold">
                  {row.name}
                </td>

                <td className="px-4 py-3">
                  {row.url ? (
                    <a
                      className="text-accent underline underline-offset-2"
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {row.provider}
                    </a>
                  ) : (
                    row.provider
                  )}
                </td>

                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {row.kind}
                </td>

                <td className="px-4 py-3">
                  <StatusPill status={row.status} />
                </td>

                <td className="num-md px-4 py-3 text-xs">
                  {row.updated}
                </td>

                <td className="num-md px-4 py-3 text-xs">
                  {row.freshness}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel mt-4 p-4">
        <h3 className="text-lg font-semibold">
          Freshness definitions
        </h3>

        <ul className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          <li>LIVE — retrieved less than 6 hours ago</li>
          <li>RECENT — retrieved less than 24 hours ago</li>
          <li>STALE — older than 24 hours</li>
          <li>
            ARCHIVED — historical or static dataset by design
          </li>
        </ul>
      </div>

      <div className="panel mt-4 p-4">
        <h3 className="text-lg font-semibold">
          Failsafe behaviour
        </h3>

        <p className="mt-1 text-sm text-muted-foreground">
          If Open-Meteo fails, the system attempts the
          configured official provider, then falls back to
          the last cached retrieval and marks itself{" "}
          <strong>DEGRADED — cached weather</strong>. If no
          cached value exists, the interface shows{" "}
          <strong>Data unavailable</strong> instead of a
          substituted number.
        </p>
      </div>
    </AppShell>
  );
}
