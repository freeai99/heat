# Jaipur Extreme Heat Early Warning & Human Thermal Stress Index

Team HELIX (118) · SIH26083 · Software · Disaster Management

Ward-level heat-health early warning and decision-support prototype for Jaipur, Rajasthan.
It answers "which areas are at greatest human heat risk, why, how severe, and what should
authorities do" — not just "how hot is it".

## Current status

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | React + TanStack Start UI shell, command-center design system | Done |
| 2 | Real Open-Meteo weather (current, hourly ±7 days, daily), WBGT/UTCI, persistence metrics, data-health + failsafe cache | Done |
| 3 | Jaipur ward GeoJSON + ward map | Done |
| 4 | Ward demographics + vulnerability scoring | Done |
| 5 | Multi-factor ward risk engine | Planned |
| 6 | Satellite LST — NASA MODIS MOD11A2 | Planned |
| 7 | Public-impact / news signal | Planned |
| 8–14 | Alerts, AI assistance, administration, demo and operational enhancements | Planned |

Ward-level final risk numbers are intentionally **not shown** until all required risk-engine
inputs are available. No values are fabricated anywhere.

## Architecture

- `src/lib/weather.functions.ts` — server function calling Open-Meteo once, cached in memory
  (10 min TTL) so every UI component reuses one upstream fetch. Falls back to the last cached
  bundle and reports `DEGRADED`; reports `OFFLINE` with no invented values when no cache exists.
- `src/lib/thermal.ts` — deterministic WBGT, estimated mean radiant temperature and UTCI
  approximation, with methodology strings surfaced in the UI.
- `src/lib/imd.functions.ts` — server-side IMD connection/status handler. Requires configured
  IMD credentials and never exposes the API key to browser code.
- `src/lib/demographics.ts` — demographic CSV/JSON parsing, validation, ward matching,
  vulnerability scoring and browser-local persistence.
- `src/lib/wards.ts` — ward GeoJSON validation, normalization, persistence and bundled Jaipur
  ward dataset handling.
- `src/types/weather.ts` — typed weather data contracts including source/kind/freshness metadata.
- `src/types/wards.ts` — typed ward geometry and dataset contracts.
- `src/types/demographics.ts` — typed ward demographic and vulnerability contracts.
- `src/routes/` — `/` dashboard, `/forecast` timeline, `/wards`, `/data-sources`,
  `/methodology`.
- `src/components/` — `AppShell`, `RiskBadge`, `SourceTag`, `WardMap`.

## Data classification

Every figure carries one of: LIVE, HISTORICAL, STATIC, DERIVED, MODEL/ESTIMATED, plus source and
timestamp.

Freshness:

- LIVE — retrieved less than 6 hours ago
- RECENT — retrieved less than 24 hours ago
- STALE — older than 24 hours
- ARCHIVED — static or historical dataset

Static datasets are not represented as live observations.

## Data sources

- Weather: [Open-Meteo](https://open-meteo.com/) (ECMWF/GFS), lat 26.91 / lon 75.79, Asia/Kolkata.
- Official Indian weather: IMD — server-side integration point implemented; credentials/configuration required.
- Satellite LST: NASA MODIS MOD11A2 — ingestion planned, not configured.
- Ward boundaries: verified Jaipur ward geometry is bundled and operator import is supported.
- Demographics / vulnerability: operator-imported CSV/JSON dataset with transparent vulnerability scoring.
- Public-impact signal: NewsAPI / public RSS — planned.
- AI: planned; no AI-generated risk values are used in the current implementation.

## Environment variables

All secrets stay server-side; none are read in browser code.

```env
OPENMETEO_API_URL=https://api.open-meteo.com/v1/forecast

IMD_API_URL=
IMD_API_KEY=
IMD_API_AUTH_SCHEME=Bearer

NEWS_API_KEY=
AI_API_KEY=
