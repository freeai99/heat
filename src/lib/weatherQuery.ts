import { queryOptions } from "@tanstack/react-query";

import { getJaipurWeather } from "./weather.functions";
import { getImdStatus } from "./imd.functions";

export const weatherQueryOptions = queryOptions({
  queryKey: ["jaipur-weather"],
  queryFn: () => getJaipurWeather(),
  staleTime: 10 * 60 * 1000,
});

export const imdQueryOptions = queryOptions({
  queryKey: ["imd-status"],
  queryFn: () => getImdStatus(),
  staleTime: 10 * 60 * 1000,
});

export function formatIST(iso: string | null | undefined): string {
  if (!iso) return "unavailable";
  const d = new Date(iso.length <= 16 ? `${iso}:00+05:30` : iso);
  if (Number.isNaN(d.getTime())) return "unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

export function freshnessOf(iso: string | null | undefined) {
  if (!iso) return "STALE" as const;
  const ageH = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (ageH < 6) return "LIVE" as const;
  if (ageH < 24) return "RECENT" as const;
  return "STALE" as const;
}

export function fmt(v: number | null | undefined, unit = "", digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}${unit}`;
}
