import type {
  DemographicsDataset,
  DemographicsSummary,
  DemographicsValidationResult,
  VulnerabilityLevel,
  VulnerabilityResult,
  WardDemographics,
} from "../types/demographics";
import type { Ward } from "../types/wards";

const STORAGE_KEY = "helix.wardDemographics.v1";

const WEIGHTS = {
  elderlyPct: 0.2,
  childrenPct: 0.15,
  outdoorWorkersPct: 0.2,
  lowIncomePct: 0.2,
  disabilityPct: 0.1,
  noCoolingPct: 0.15,
} as const;

type NumericField =
  | "population"
  | "elderlyPct"
  | "childrenPct"
  | "outdoorWorkersPct"
  | "lowIncomePct"
  | "disabilityPct"
  | "noCoolingPct"
  | "vulnerabilityScore";

const FIELD_ALIASES: Record<string, NumericField | "wardNo" | "wardName" | "source" | "updatedAt"> = {
  ward_no: "wardNo",
  ward_number: "wardNo",
  wardnumber: "wardNo",
  ward_num: "wardNo",
  wardno: "wardNo",
  ward: "wardNo",
  no: "wardNo",
  number: "wardNo",

  ward_name: "wardName",
  wardname: "wardName",
  name: "wardName",
  label: "wardName",

  population: "population",
  pop: "population",
  total_population: "population",

  elderly_pct: "elderlyPct",
  elderly_percent: "elderlyPct",
  elderly: "elderlyPct",
  older_adults_pct: "elderlyPct",

  children_pct: "childrenPct",
  children_percent: "childrenPct",
  children: "childrenPct",

  outdoor_workers_pct: "outdoorWorkersPct",
  outdoor_worker_pct: "outdoorWorkersPct",
  outdoor_workers: "outdoorWorkersPct",
  outdoor_worker: "outdoorWorkersPct",

  low_income_pct: "lowIncomePct",
  low_income_percent: "lowIncomePct",
  low_income: "lowIncomePct",

  disability_pct: "disabilityPct",
  disability_percent: "disabilityPct",
  disability: "disabilityPct",

  no_cooling_pct: "noCoolingPct",
  no_cooling_percent: "noCoolingPct",
  no_cooling: "noCoolingPct",
  no_cooling_access: "noCoolingPct",

  vulnerability_score: "vulnerabilityScore",
  vulnerability: "vulnerabilityScore",

  source: "source",
  source_label: "source",

  updated_at: "updatedAt",
  updated: "updatedAt",
};

const NUMERIC_FIELDS: NumericField[] = [
  "population",
  "elderlyPct",
  "childrenPct",
  "outdoorWorkersPct",
  "lowIncomePct",
  "disabilityPct",
  "noCoolingPct",
  "vulnerabilityScore",
];

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value
    .trim()
    .replace(/,/g, "")
    .replace(/%$/, "");

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeWardNumber(value: unknown): number | undefined {
  const parsed = parseNumber(value);

  if (parsed === undefined) {
    return undefined;
  }

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function normalizeRecord(
  raw: Record<string, unknown>,
  rowNumber: number,
  errors: string[],
): WardDemographics | null {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    const alias = FIELD_ALIASES[normalizeKey(key)];

    if (alias) {
      normalized[alias] = value;
    }
  }

  const wardNo = normalizeWardNumber(normalized.wardNo);

  if (wardNo === undefined) {
    errors.push(`Row ${rowNumber}: valid ward number is required.`);
    return null;
  }

  const result: WardDemographics = {
    wardNo,
  };

  if (
    normalized.wardName !== undefined &&
    String(normalized.wardName).trim()
  ) {
    result.wardName = String(normalized.wardName).trim();
  }

  for (const field of NUMERIC_FIELDS) {
    const value = normalized[field];

    if (value === undefined || value === null || value === "") {
      continue;
    }

    const parsed = parseNumber(value);

    if (parsed === undefined) {
      errors.push(`Row ${rowNumber}: ${field} must be numeric.`);
      continue;
    }

    if (field === "population") {
      if (parsed < 0) {
        errors.push(`Row ${rowNumber}: population cannot be negative.`);
        continue;
      }
    }

    if (
      field !== "population" &&
      parsed < 0
    ) {
      errors.push(`Row ${rowNumber}: ${field} cannot be below 0.`);
      continue;
    }

    if (
      field !== "population" &&
      parsed > 100
    ) {
      errors.push(`Row ${rowNumber}: ${field} cannot exceed 100.`);
      continue;
    }

    result[field] = parsed;
  }

  if (normalized.source) {
    result.source = String(normalized.source).trim();
  }

  if (normalized.updatedAt) {
    result.updatedAt = String(normalized.updatedAt).trim();
  }

  return result;
}

function validateDuplicateWards(records: WardDemographics[]): string[] {
  const counts = new Map<number, number>();

  for (const record of records) {
    counts.set(
      record.wardNo,
      (counts.get(record.wardNo) ?? 0) + 1,
    );
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([wardNo]) => `Duplicate ward number: ${wardNo}.`);
}

function csvLineParser(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }

      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());

  return values;
}

export function parseDemographicsCsv(
  text: string,
): DemographicsValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return {
      ok: false,
      errors: ["CSV must contain a header row and at least one data row."],
      warnings,
      records: [],
    };
  }

  const headers = csvLineParser(lines[0]!);

  if (headers.length === 0) {
    return {
      ok: false,
      errors: ["CSV header row is empty."],
      warnings,
      records: [],
    };
  }

  const records: WardDemographics[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const values = csvLineParser(lines[index]!);

    const raw: Record<string, unknown> = {};

    headers.forEach((header, headerIndex) => {
      raw[header] = values[headerIndex] ?? "";
    });

    const record = normalizeRecord(raw, index + 1, errors);

    if (record) {
      records.push(record);
    }
  }

  const duplicates = validateDuplicateWards(records);
  errors.push(...duplicates);

  return {
    ok: errors.length === 0 && records.length > 0,
    errors,
    warnings,
    records,
  };
}

export function parseDemographicsJson(
  raw: unknown,
): DemographicsValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let items: unknown[];

  if (Array.isArray(raw)) {
    items = raw;
