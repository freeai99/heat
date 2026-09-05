import type { Ward } from "../types/wards";
import type { WeatherBundle } from "../types/weather";

export type WardRiskLevel = "LOW" | "MODERATE" | "HIGH" | "EXTREME";

export interface WardRisk {
  wardId: string;
  wardNumber: string | null;
  wardName: string | null;

  thermalHazard: number;
  vulnerability: number;
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
 * Extract vulnerability from a ward's properties.
 *
 * This supports the demographic dataset without requiring the map
 * component to know how the demographic data was imported.
 */
function vulnerabilityFromWardProperties(ward: Ward): number {
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

  /*
   * No vulnerability data available yet.
   *
   * We deliberately use 50 rather than pretending that the ward has
   * either zero or maximum vulnerability.
   */
  return 50;
}

export function calculateWardRisk(
  ward: Ward,
  weather: WeatherBundle,
): WardRisk {
  const thermalHazard = calculateThermalHazard(weather);

  const vulnerability = vulnerabilityFromWardProperties(ward);

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

  return {
    wardId: ward.id,
    wardNumber: ward.wardNumber,
    wardName: ward.name,
    thermalHazard,
    vulnerability,
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
): Record<string, WardRisk> {
  return Object.fromEntries(
    wards.map((ward) => [
      ward.id,
      calculateWardRisk(ward, weather),
    ]),
  );
}
