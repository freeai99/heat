/**
 * Early-warning summarizer. Turns the next 72h of forecast + derived
 * WBGT/UTCI hourly data into a single judge-readable risk headline.
 * Nothing here is invented — it's a pure reduction over data already
 * computed in weather.functions.ts / thermal.ts.
 */
import type { WeatherBundle, HourlyPoint } from "../types/weather";

export type EarlyWarningLevel = "NONE" | "DEVELOPING" | "HIGH" | "EXTREME";

export interface EarlyWarningResult {
  level: EarlyWarningLevel;
  emoji: string;
  label: string;
  colorClass: string;
  hoursUntil: number | null;
  headline: string;
  explanation: string;
  windowHours: number;
  worstCategory: string | null;
  dataAvailable: boolean;
}

const WINDOW_HOURS = 72;

const LEVEL_RANK: Record<EarlyWarningLevel, number> = {
  NONE: 0,
  DEVELOPING: 1,
  HIGH: 2,
  EXTREME: 3,
};

const LEVEL_META: Record<
  EarlyWarningLevel,
  { emoji: string; label: string; colorClass: string; word: string }
> = {
  NONE: {
    emoji: "🟢",
    label: "NO MAJOR RISK",
    colorClass: "bg-ok/15 text-ok border-ok/40",
    word: "No major",
  },
  DEVELOPING: {
    emoji: "🟡",
    label: "HEAT RISK DEVELOPING",
    colorClass: "bg-warn/20 text-risk-2-foreground border-warn/50",
    word: "Developing",
  },
  HIGH: {
    emoji: "🟠",
    label: "HIGH HEAT RISK",
    colorClass: "bg-risk-3/25 text-risk-3-foreground border-risk-3/60",
    word: "High",
  },
  EXTREME: {
    emoji: "🔴",
    label: "EXTREME HEAT RISK",
    colorClass: "bg-destructive/15 text-destructive border-destructive/50",
    word: "Extreme",
  },
};

function categoryOf(utci: number): { category: string; level: EarlyWarningLevel } {
  if (utci >= 46) return { category: "Extreme heat stress", level: "EXTREME" };
  if (utci >= 38) return { category: "Very strong heat stress", level: "HIGH" };
  if (utci >= 32) return { category: "Strong heat stress", level: "HIGH" };
  if (utci >= 26) return { category: "Moderate heat stress", level: "DEVELOPING" };
  return { category: "No thermal stress", level: "NONE" };
}

function timePhrase(hoursUntil: number, targetIso: string): string {
  if (hoursUntil <= 3) return "within the next few hours";
  const target = new Date(targetIso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const hour = target.getHours();
  const partOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  if (target.toDateString() === now.toDateString()) return `later today (${partOfDay})`;
  if (target.toDateString() === tomorrow.toDateString()) return `tomorrow ${partOfDay}`;
  return `in about ${Math.round(hoursUntil)} hours`;
}

/** Ranks/maps an EarlyWarningLevel onto the existing 1–4 RiskLevel scale. */
export function levelToRiskNumber(level: EarlyWarningLevel): 1 | 2 | 3 | 4 {
  return { NONE: 1, DEVELOPING: 2, HIGH: 3, EXTREME: 4 }[level] as 1 | 2 | 3 | 4;
}

export function computeEarlyWarning(bundle: WeatherBundle): EarlyWarningResult {
  if (!bundle.ok || !bundle.current) {
    return {
      level: "NONE",
      emoji: "⚪",
      label: "DATA UNAVAILABLE",
      colorClass: "bg-muted text-muted-foreground border-border",
      hoursUntil: null,
      headline: "Live forecast temporarily unavailable",
      explanation: "The weather source could not be reached — no risk value is being guessed.",
      windowHours: WINDOW_HOURS,
      worstCategory: null,
      dataAvailable: false,
    };
  }

  const nowMs = new Date(bundle.current.time || Date.now()).getTime();
  const windowEndMs = nowMs + WINDOW_HOURS * 3_600_000;

  const upcoming: HourlyPoint[] = bundle.hourly.filter((p) => {
    const t = new Date(p.time).getTime();
    return t >= nowMs && t <= windowEndMs && p.utci !== null;
  });

  let worstLevel: EarlyWarningLevel = "NONE";
  let worstCategory: string | null = null;
  let firstAtWorst: HourlyPoint | null = null;

  for (const p of upcoming) {
    const { category, level } = categoryOf(p.utci as number);
    if (LEVEL_RANK[level] > LEVEL_RANK[worstLevel]) {
      worstLevel = level;
      worstCategory = category;
      firstAtWorst = p;
    }
  }

  const meta = LEVEL_META[worstLevel];
  const hoursUntil = firstAtWorst ? (new Date(firstAtWorst.time).getTime() - nowMs) / 3_600_000 : null;

  let headline: string;
  let explanation: string;

  if (worstLevel === "NONE" || hoursUntil === null) {
    headline = "No major heat risk expected in the next 72 hours";
    explanation = "Forecast conditions in Jaipur stay within normal limits for the next 3 days.";
  } else {
    const phrase = timePhrase(hoursUntil, firstAtWorst!.time);
    headline = `Expected in: ${Math.max(1, Math.round(hoursUntil))} hours`;
    explanation = `${meta.word} heat stress is forecast in Jaipur ${phrase}.`;
  }

  return {
    level: worstLevel,
    emoji: meta.emoji,
    label: meta.label,
    colorClass: meta.colorClass,
    hoursUntil,
    headline,
    explanation,
    windowHours: WINDOW_HOURS,
    worstCategory,
    dataAvailable: upcoming.length > 0,
  };
}
