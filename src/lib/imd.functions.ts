import { createServerFn } from "@tanstack/react-start";

export interface ImdStatus {
  configured: boolean;
  ok: boolean;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  message: string;
  warning: string | null;
}

/**
 * Real IMD connector. Requires IMD_API_URL + IMD_API_KEY to be set server-side.
 * Neither is fabricated: with no configured access, this honestly reports
 * "not connected" rather than showing invented weather data.
 */
export const getImdStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<ImdStatus> => {
    const apiUrl = process.env["IMD_API_URL"];
    const apiKey = process.env["IMD_API_KEY"];
    const meta = {
      source: "India Meteorological Department (IMD)",
      sourceUrl: "https://mausam.imd.gov.in/",
      retrievedAt: new Date().toISOString(),
    };

    if (!apiUrl || !apiKey) {
      return {
        ...meta,
        configured: false,
        ok: false,
        message: "IMD: Not connected",
        warning: null,
      };
    }

    try {
      const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!res.ok) throw new Error(`IMD responded ${res.status}`);
      const json = (await res.json()) as Record<string, unknown>;
      return {
        ...meta,
        configured: true,
        ok: true,
        message: "IMD: Live",
        warning: typeof json["heatWarning"] === "string" ? (json["heatWarning"] as string) : null,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      return {
        ...meta,
        configured: true,
        ok: false,
        message: `IMD: Configured but unreachable (${msg})`,
        warning: null,
      };
    }
  },
);
