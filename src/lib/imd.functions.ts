import { createServerFn } from "@tanstack/react-start";

export type ImdConnectionStatus =
  | "connected"
  | "degraded"
  | "not_configured";

export interface ImdStatus {
  configured: boolean;
  ok: boolean;
  status: ImdConnectionStatus;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  message: string;
  warning: string | null;
  error?: string;
}

const SOURCE = "India Meteorological Department (IMD)";
const SOURCE_URL = "https://mausam.imd.gov.in/";

/**
 * Safely extracts a heat-warning string from several reasonable response
 * shapes without treating an arbitrary API response as valid.
 */
function extractHeatWarning(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const root = payload as Record<string, unknown>;

  const directCandidates = [
    root["heatWarning"],
    root["heat_warning"],
    root["heatwarning"],
    root["warning"],
    root["warningText"],
    root["warning_text"],
    root["alert"],
    root["alertText"],
    root["alert_text"],
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  const nestedKeys = ["data", "result", "response", "weather", "warnings"];

  for (const key of nestedKeys) {
    const nested = root[key];

    if (typeof nested === "object" && nested !== null) {
      const warning = extractHeatWarning(nested);

      if (warning) {
        return warning;
      }
    }

    if (Array.isArray(nested)) {
      for (const item of nested) {
        const warning = extractHeatWarning(item);

        if (warning) {
          return warning;
        }
      }
    }
  }

  return null;
}

/**
 * IMD connector.
 *
 * IMPORTANT:
 * - API credentials are server-side only.
 * - No weather values are fabricated.
 * - Missing credentials = not_configured.
 * - Failed request = degraded.
 * - Successful HTTP response = connected.
 */
export const getImdStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<ImdStatus> => {
    const apiUrl = process.env["IMD_API_URL"];
    const apiKey = process.env["IMD_API_KEY"];
    const authScheme = process.env["IMD_API_AUTH_SCHEME"] ?? "Bearer";

    const retrievedAt = new Date().toISOString();

    const meta = {
      source: SOURCE,
      sourceUrl: SOURCE_URL,
      retrievedAt,
    };

    if (!apiUrl || !apiKey) {
      return {
        ...meta,
        configured: false,
        ok: false,
        status: "not_configured",
        message: "IMD: Not configured",
        warning: null,
      };
    }

    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `${authScheme} ${apiKey}`,
        },
      });

      if (!response.ok) {
        return {
          ...meta,
          configured: true,
          ok: false,
          status: "degraded",
          message: `IMD: Configured but unavailable (${response.status})`,
          warning: null,
          error: `IMD responded with HTTP ${response.status}`,
        };
      }

      let payload: unknown;

      try {
        payload = await response.json();
      } catch {
        return {
          ...meta,
          configured: true,
          ok: false,
          status: "degraded",
          message: "IMD: Invalid JSON response",
          warning: null,
          error: "The IMD endpoint returned a response that could not be parsed as JSON.",
        };
      }

      const warning = extractHeatWarning(payload);

      return {
        ...meta,
        configured: true,
        ok: true,
        status: "connected",
        message: warning
          ? "IMD: Live"
          : "IMD: Connected — no heat warning field detected",
        warning,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown network error";

      return {
        ...meta,
        configured: true,
        ok: false,
        status: "degraded",
        message: "IMD: Configured but unreachable",
        warning: null,
        error: message,
      };
    }
  },
);
