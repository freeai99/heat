import type { Ward } from "../types/wards";
import type { WeatherBundle } from "../types/weather";
import type { WardDemographics } from "../types/demographics";
import { getWardDemographics, calculateVulnerability } from "./demographics";

export type WardRiskLevel = "LOW" | "MODERATE" | "HIGH" | "EXTREME";

export interface WardRisk {
  wardId: string;
  wardNumber: string | null;
  wardName: string | null;
  thermalHazard: number;
  vulnerability: number;
  vulnerabilitySource: "demographics" | "properties" | "default";
  riskScore: number;
  level: WardRiskLevel;
  wbgt: number | null;
  utci: number | null;
  explanation: string;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function riskLevel(score: number): WardRiskLevel {
  if (score >= 75) return "EXTREME";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MODERATE";
  return "LOW";
}

/**
 * Converts the current thermal indicators into a 0–100 hazard score.
 *
 * WBGT:
 * < 26   -> low
 * 26–28  -> moderate
 * 28–31  -> high
 * > 31   -> extreme
 *
 * UTCI is also incorporated because it represents human thermal stress.
 */
function calculateThermalHazard(weather: WeatherBundle): number {
  const wbgt = weather.derived?.wbgt;
  const utci = weather.derived?.utci;
  if (wbgt === null || wbgt === undefined || utci === null || utci === undefined) {
    return 0;
  }
  const wbgtScore = clamp(((wbgt - 22) / 12) * 100);
  const utciScore = clamp(((utci - 18) / 30) * 100);
  return Math.round(wbgtScore * 0.45 + utciScore * 0.55);
}

/**
 * Fallback vulnerability source: reads a value directly off the ward's
 * GeoJSON feature properties, for wards whose boundary file already carries
 * a vulnerability field. Used only when no demographics dataset record
 * matches the ward.
 */
function vulnerabilityFromWardProperties(ward: Ward): number | null {
  const properties = ward.properties;
  const possibleKeys = [
    "vulnerability",
    "vulnerability_score",
    "vulnerabilityScore",
    "risk_vulnerability",
    "vulnerability_pct",
  ];
  for (const key of possibleKeys) {
    const value = properties[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return clamp(value);
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return clamp(parsed);
      }
    }
  }
  return null;
}

/**
 * Resolves ward vulnerability with a clear priority order:
 * 1. Matched demographics record (operator-imported or built-in dataset).
 * 2. A vulnerability value embedded directly in the ward's GeoJSON properties.
 * 3. Neutral default (50) — used only when nothing else is available, so an
 *    unmeasured ward is never silently treated as low or high risk.
 */
function resolveVulnerability(
  ward: Ward,
  demographics: WardDemographics[],
): { value: number; source: WardRisk["vulnerabilitySource"] } {
  const record = getWardDemographics(demographics, ward);
  if (record) {
    const { score } = calculateVulnerability(record);
    if (score !== null) {
      return { value: score, source: "demographics" };
    }
  }

  const fromProperties = vulnerabilityFromWardProperties(ward);
  if (fromProperties !== null) {
    return { value: fromProperties, source: "properties" };
  }

  return { value: 50, source: "default" };
}

export function calculateWardRisk(
  ward: Ward,
  weather: WeatherBundle,
  demographics: WardDemographics[] = [],
): WardRisk {
  const thermalHazard = calculateThermalHazard(weather);
  const { value: vulnerability, source: vulnerabilitySource } = resolveVulnerability(
    ward,
    demographics,
  );
  const riskScore = Math.round(
    thermalHazard * 0.6 +
      vulnerability * 0.4,
  );
  const level = riskLevel(riskScore);
  let explanation = "";
  if (level === "EXTREME") {
    explanation =
      "Extreme calculated heat-health risk from high thermal stress and ward vulnerability.";
  } else if (level === "HIGH") {
    explanation =
      "High calculated risk from significant thermal stress combined with population vulnerability.";
  } else if (level === "MODERATE") {
    explanation =
      "Moderate calculated risk based on current thermal conditions and ward vulnerability.";
  } else {
    explanation =
      "Low calculated heat-health risk under the current thermal conditions.";
  }

  if (vulnerabilitySource === "default") {
    explanation +=
      " Vulnerability is a neutral placeholder — no demographics data is loaded for this ward.";
  }

  return {
    wardId: ward.id,
    wardNumber: ward.wardNumber,
    wardName: ward.name,
    thermalHazard,
    vulnerability,
    vulnerabilitySource,
    riskScore,
    level,
    wbgt: weather.derived?.wbgt ?? null,
    utci: weather.derived?.utci ?? null,
    explanation,
  };
}

export function calculateAllWardRisks(
  wards: Ward[],
  weather: WeatherBundle,
  demographics: WardDemographics[] = [],
): Record<string, WardRisk> {
  return Object.fromEntries(
    wards.map((ward) => [
      ward.id,
      calculateWardRisk(ward, weather, demographics),
    ]),
  );
}
