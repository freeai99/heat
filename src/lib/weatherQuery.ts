import { queryOptions } from "@tanstack/react-query";

import { getImdStatus } from "./imd.functions";
import { getJaipurWeather } from "./weather.functions";

export const weatherQueryOptions = queryOptions({
  queryKey: ["jaipur-weather"],
  queryFn: () => getJaipurWeather(),
  staleTime: 10 * 60 * 1000,
});

export const imdQueryOptions = queryOptions({
  queryKey: ["imd-status"],
  queryFn: () => getImdStatus(),
  staleTime: 10 * 60 * 1000,
  retry: 1,
});

export function formatIST(iso: string | null | undefined): string {
  if (!iso) return "unavailable";

  const d = new Date(iso.length <= 16 ? `${iso}:00+05:30` : iso);

  if (Number.isNaN(d.getTime())) {
    return "unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

export function freshnessOf(
  iso: string | null | undefined,
):
  | "LIVE"
  | "RECENT"
  | "STALE" {
  if (!iso) return "STALE";

  const timestamp = new Date(iso).getTime();

  if (Number.isNaN(timestamp)) {
    return "STALE";
  }

  const ageH = (Date.now() - timestamp) / 3_600_000;

  if (ageH < 6) return "LIVE";
  if (ageH < 24) return "RECENT";

  return "STALE";
}

export function fmt(
  value: number | null | undefined,
  unit = "",
  digits = 1,
): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return `${value.toFixed(digits)}${unit}`;
}
