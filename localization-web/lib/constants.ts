// n8n workflow'unun "TEST 100 CÜMLE1" agent'ının ürettiği dil sütunları,
// n8n workflow'u değişirse burası da güncellenmeli.
export const LANGUAGE_COLUMNS = [
  "TR", "DE", "AR", "ZH_TW", "FR", "ES", "IT", "RU", "PT", "JA", "KR",
  "TH", "VI", "IN", "PL", "CS", "HU", "RO", "ZH_CN", "ML", "NL", "UK",
] as const;

export const OUTPUT_COLUMNS = ["ID", "EN", ...LANGUAGE_COLUMNS] as const;

export const MAX_RECORDS_PER_REQUEST = 25;

export const LANGUAGE_LABELS: Record<string, string> = {
  EN: "İngilizce",
  TR: "Türkçe",
  DE: "Almanca",
  AR: "Arapça",
  ZH_TW: "Çince (Geleneksel)",
  FR: "Fransızca",
  ES: "İspanyolca",
  IT: "İtalyanca",
  RU: "Rusça",
  PT: "Portekizce",
  JA: "Japonca",
  KR: "Korece",
  TH: "Tayca",
  VI: "Vietnamca",
  IN: "Endonezce",
  PL: "Lehçe",
  CS: "Çekçe",
  HU: "Macarca",
  RO: "Romence",
  ZH_CN: "Çince (Basitleştirilmiş)",
  ML: "Malayca",
  NL: "Felemenkçe",
  UK: "Ukraynaca",
};

export type InputRecord = { ID: number | string; EN: string };
export type OutputRecord = { ID: number | string; EN: string } & Record<string, string>;
