import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CircleAlert, Clock, Database, MapPin, ChevronDown, ChevronUp } from "lucide-react";

import { AppShell } from "../components/AppShell";
import { RISK_META, RiskBadge, type RiskLevel } from "../components/RiskBadge";
import { SourceTag } from "../components/SourceTag";
import { fmt, formatIST, weatherQueryOptions, imdQueryOptions } from "../lib/weatherQuery";
import { computeEarlyWarning, levelToRiskNumber } from "../lib/earlyWarning";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jaipur Extreme Heat Early Warning System | Team HELIX" },
      {
        name: "description",
        content:
          "Know about dangerous heat before it happens — ward-level heat-health early warning for Jaipur.",
      },
      { property: "og:title", content: "Jaipur Extreme Heat Early Warning System" },
      {
        property: "og:description",
        content:
          "From heat forecast to human risk — an AI-assisted, ward-level heat-health decision-support prototype for Jaipur.",
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
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(weatherQueryOptions);
  const { data: imd } = useSuspenseQuery(imdQueryOptions);
  const [showDetails, setShowDetails] = useState(false);

  const warning = computeEarlyWarning(data);
  const riskLevel = levelToRiskNumber(warning.level) as RiskLevel;
  const c = data.current;
  const d = data.derived;
  const p = data.persistence;

  return (
    <AppShell>
      {/* MAIN MESSAGE */}
      <p className="mb-3 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground sm:text-left">
        Know about dangerous heat before it happens.
      </p>

      {/* 1 — TOP HERO CARD */}
      <section className={`panel border-2 p-5 sm:p-6 ${warning.colorClass}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="label-caps">🌡️ Heatwave Early Warning</p>
            <h1 className="font-display mt-1 text-3xl font-bold sm:text-4xl">
              {warning.emoji} {warning.label}
            </h1>
            <p className="num-md mt-2 text-lg">{warning.headline}</p>
            <p className="mt-1 max-w-xl text-sm">{warning.explanation}</p>
          </div>
          <div className="grid shrink-0 gap-1 text-xs">
            <SourceRow label="Open-Meteo" ok={data.status !== "OFFLINE"} degraded={data.status === "DEGRADED"} />
            <SourceRow label="IMD" ok={imd.ok} notConnected={!imd.configured} />
            <p className="mt-1 text-[11px] opacity-80">
              Last updated: {formatIST(data.meta.retrievedAt)}
            </p>
          </div>
        </div>
      </section>

      {/* 3 — SIMPLE FLOW */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FlowCard title="Heatwave Warning" step={1}>
          <p className="text-2xl">{warning.emoji}</p>
          <p className="mt-1 font-semibold">{warning.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{warning.headline}</p>
        </FlowCard>

        <FlowCard title="72-Hour Outlook" step={2}>
          <p className="num-xl">{fmt(p?.forecastPeakTemperature ?? null, "°C")}</p>
          <p className="text-xs text-muted-foreground">Highest forecast temperature</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {p?.heatwaveDurationDays ? `${p.heatwaveDurationDays} hot day(s) ahead` : "No hot-day streak forecast"}
          </p>
        </FlowCard>

        <FlowCard title="Highest-Risk Wards" step={3}>
          <p className="text-sm text-muted-foreground">
            Ward-level risk needs verified ward + vulnerability data (Phases 4–6) before it can be shown
            honestly — nothing is guessed.
          </p>
          <a href="/wards" className="mt-2 inline-block text-xs font-semibold text-accent underline">
            View ward boundaries →
          </a>
        </FlowCard>

        <FlowCard title="Recommended Action" step={4}>
          <RiskBadge level={riskLevel} />
          <p className="mt-2 text-xs text-muted-foreground">{RISK_META[riskLevel].guidance}</p>
        </FlowCard>
      </div>

      {/* View details toggle */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => setShowDetails((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showDetails ? "Hide technical details" : "View details (WBGT, UTCI, vulnerability, satellite, AI)"}
        </button>
      </div>

      {/* ORIGINAL DETAILED DASHBOARD — unchanged, only hidden by default */}
      {showDetails ? (
        <>
          <section className="panel mt-4 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-semibold sm:text-3xl">
                  From Heat Forecast to Human Risk
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This prototype combines weather, human thermal stress, urban heat, vulnerability and
                  real-world impact signals to support timely disaster-response decisions.
                </p>
              </div>
              <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                <Meta icon={Clock} label="Last updated" value={formatIST(data.meta.retrievedAt)} />
                <Meta icon={Database} label="Weather source" value={data.meta.source} />
                <Meta
                  icon={CircleAlert}
                  label="Risk calculation"
                  value={d ? formatIST(d.calculatedAt) : "not available"}
                />
                <Meta icon={MapPin} label="Location" value={data.meta.location.name} />
                <div className="col-span-2">
                  <span className="label-caps">Data health</span>
                  <span
                    className={`ml-2 rounded px-2 py-0.5 text-xs font-bold ${
                      data.status === "GOOD"
                        ? "bg-ok/15 text-ok"
                        : data.status === "DEGRADED"
                          ? "bg-warn/20 text-risk-3-foreground"
                          : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {data.status}
                  </span>
                </div>
              </dl>
            </div>
            {data.message ? (
              <p className="mt-3 rounded border border-warn/40 bg-warn/10 p-2 text-xs font-medium">
                {data.message}
              </p>
            ) : null}
          </section>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Kpi
              title="Current air temperature"
              value={fmt(c?.temperature2m ?? null, "°C")}
              sub={`Feels-like ${fmt(c?.apparentTemperature ?? null, "°C")} · RH ${fmt(c?.relativeHumidity2m ?? null, "%", 0)} · Wind ${fmt(c?.windSpeed10m ?? null, " km/h", 0)}`}
              kind="LIVE"
              source="Open-Meteo"
              timestamp={formatIST(c?.time)}
            />
            <Kpi
              title="Human heat stress"
              value={d ? `WBGT ${fmt(d.wbgt, "°C")}` : "—"}
              sub={d ? `UTCI ${fmt(d.utci, "°C")} · ${d.heatStressCategory}` : "Inputs unavailable"}
              kind="DERIVED"
              source="Calculated from live Open-Meteo inputs"
              timestamp={d ? formatIST(d.calculatedAt) : null}
            />
            <Kpi
              title="Mean radiant temperature"
              value={d ? fmt(d.meanRadiantTemperature, "°C") : "—"}
              sub="Estimated — direct MRT measurement is unavailable"
              kind="MODEL"
              source="Radiation-based approximation"
              timestamp={d ? formatIST(d.calculatedAt) : null}
            />
            <Kpi
              title="Forecast peak temperature"
              value={fmt(p?.forecastPeakTemperature ?? null, "°C")}
              sub="Highest daily maximum in the next 7 forecast days"
              kind="MODEL"
              source="Open-Meteo forecast"
              timestamp={formatIST(data.meta.retrievedAt)}
            />
            <Kpi
              title="Heatwave duration"
              value={p ? `${p.heatwaveDurationDays} d` : "—"}
              sub={`Consecutive forecast days ≥ ${p?.hotDayThresholdC ?? 40}°C from today (prototype threshold)`}
              kind="DERIVED"
              source="Derived from Open-Meteo daily forecast"
              timestamp={formatIST(data.meta.retrievedAt)}
            />
            <Kpi
              title="Night-time minimum (last 24 h)"
              value={fmt(p?.nighttimeMinTemperature ?? null, "°C")}
              sub={`Consecutive hot hours now: ${p?.consecutiveHotHours ?? "—"}`}
              kind="DERIVED"
              source="Derived from Open-Meteo hourly series"
              timestamp={formatIST(data.meta.retrievedAt)}
            />
          </div>

          <section className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="panel p-4 lg:col-span-2">
              <h3 className="text-lg font-semibold">Ward-level risk layer</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ward risk scoring requires verified Jaipur Municipal Corporation ward boundaries and
                vulnerability datasets. No ward geometry or demographic data has been imported yet, so
                no ward risk figures are shown — inventing them would breach the project&apos;s data
                rules.
              </p>
              <div className="mt-3 rounded border border-dashed border-border bg-muted/50 p-6 text-center">
                <p className="text-sm font-semibold">Ward dataset not loaded</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Highest-risk ward, high/extreme ward counts and the Jaipur map become available after
                  Phase 3 (ward GeoJSON import) and Phase 6 (vulnerability import).
                </p>
              </div>
            </div>
            <div className="panel p-4">
              <h3 className="text-lg font-semibold">Risk classification</h3>
              <p className="label-caps mt-1">Prototype risk classification</p>
              <ul className="mt-3 space-y-3">
                {([1, 2, 3, 4] as RiskLevel[]).map((level) => (
                  <li key={level}>
                    <RiskBadge level={level} />
                    <p className="mt-1 text-xs text-muted-foreground">{RISK_META[level].guidance}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Not official IMD categories. Thresholds will be administrator-configurable.
              </p>
            </div>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

function SourceRow({
  label,
  ok,
  degraded,
  notConnected,
}: {
  label: string;
  ok: boolean;
  degraded?: boolean;
  notConnected?: boolean;
}) {
  const text = notConnected
    ? `${label}: Not connected`
    : ok
      ? `${label} ✓ Live`
      : degraded
        ? `${label}: Degraded`
        : `${label}: Unavailable`;
  return <p className="font-semibold">{text}</p>;
}

function FlowCard({ title, step, children }: { title: string; step: number; children: ReactNode }) {
  return (
    <article className="panel p-4">
      <p className="label-caps">
        Step {step} · {title}
      </p>
      <div className="mt-2">{children}</div>
    </article>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <div>
        <dt className="label-caps">{label}</dt>
        <dd className="num-md text-xs">{value}</dd>
      </div>
    </div>
  );
}

function Kpi({
  title,
  value,
  sub,
  kind,
  source,
  timestamp,
}: {
  title: string;
  value: string;
  sub: string;
  kind: "LIVE" | "DERIVED" | "MODEL";
  source: string;
  timestamp?: string | null | undefined;
}) {
  return (
    <article className="panel p-4">
      <h3 className="label-caps">{title}</h3>
      <p className="num-xl mt-1">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      <SourceTag kind={kind} source={source} timestamp={timestamp} />
    </article>
  );
}
