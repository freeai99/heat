export type VulnerabilityLevel =
  | "Low"
  | "Moderate"
  | "High"
  | "Very High";

export interface WardDemographics {
  wardNo: number;
  wardName?: string;

  population?: number;

  elderlyPct?: number;
  childrenPct?: number;
  outdoorWorkersPct?: number;
  lowIncomePct?: number;
  disabilityPct?: number;
  noCoolingPct?: number;

  vulnerabilityScore?: number;

  source?: string;
  updatedAt?: string;
}

export interface DemographicsDataset {
  fileName: string;
  sourceLabel: string;
  importedAt: string;
  records: WardDemographics[];
}

export interface DemographicsValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  records: WardDemographics[];
}

export interface VulnerabilityResult {
  score: number | null;
  level: VulnerabilityLevel | null;
  indicatorsUsed: number;
  indicatorsMissing: number;
}

export interface DemographicsSummary {
  totalRecords: number;
  matchedWards: number;
  unmatchedRecords: number;
  wardsWithoutDemographics: number;
  scoredWards: number;
  population: number | null;
  indicatorsAvailable: string[];
}
