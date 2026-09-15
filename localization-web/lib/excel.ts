import * as XLSX from "xlsx";
import { InputRecord, MAX_RECORDS_PER_REQUEST, OUTPUT_COLUMNS, OutputRecord } from "./constants";

export type ValidationResult =
  | { ok: true; records: InputRecord[] }
  | { ok: false; error: string };

/**
 * Kullanıcının yüklediği Excel dosyasını okur ve şablona uygunluğunu kontrol eder.
 * Beklenen şablon: "ID" ve "EN" başlıklı iki sütun.
 */
export function parseAndValidateUpload(fileBuffer: ArrayBuffer): ValidationResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(fileBuffer, { type: "array" });
  } catch {
    return { ok: false, error: "Dosya okunamadı. Lütfen geçerli bir .xlsx dosyası yükleyin." };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { ok: false, error: "Excel dosyasında hiç sayfa (sheet) bulunamadı." };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rows.length === 0) {
    return { ok: false, error: "Excel dosyası boş görünüyor. Şablonu indirip cümlelerinizi ekleyin." };
  }

  const firstRow = rows[0];
  const headers = Object.keys(firstRow);
  const hasId = headers.some((h) => h.trim().toUpperCase() === "ID");
  const hasEn = headers.some((h) => h.trim().toUpperCase() === "EN");

  if (!hasId || !hasEn) {
    return {
      ok: false,
      error:
        'Şablon hatalı: dosyada "ID" ve "EN" başlıklı sütunlar bulunmalı. Lütfen örnek şablonu indirip onun üzerinden devam edin.',
    };
  }

  if (rows.length > MAX_RECORDS_PER_REQUEST) {
    return {
      ok: false,
      error: `En fazla ${MAX_RECORDS_PER_REQUEST} cümle yükleyebilirsiniz. Yüklenen dosyada ${rows.length} satır var.`,
    };
  }

  const idKey = headers.find((h) => h.trim().toUpperCase() === "ID")!;
  const enKey = headers.find((h) => h.trim().toUpperCase() === "EN")!;

  const seenIds = new Set<string>();
  const records: InputRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawId = row[idKey];
    const rawEn = row[enKey];
    const rowNumber = i + 2; // +2: 1-index + başlık satırı

    if (rawId === "" || rawId === undefined || rawId === null) {
      return { ok: false, error: `${rowNumber}. satırda ID alanı boş.` };
    }
    if (typeof rawEn !== "string" || rawEn.trim() === "") {
      return { ok: false, error: `${rowNumber}. satırda EN alanı boş.` };
    }

    const idStr = String(rawId).trim();
    if (seenIds.has(idStr)) {
      return { ok: false, error: `ID "${idStr}" birden fazla satırda kullanılmış. ID'ler benzersiz olmalı.` };
    }
    seenIds.add(idStr);

    records.push({ ID: rawId as number | string, EN: rawEn.trim() });
  }

  return { ok: true, records };
}

/** Boş şablon Excel dosyasını (ID, EN sütunları + örnek satır) üretir. */
export function buildTemplateWorkbook(): Buffer {
  const data = [
    { ID: 1, EN: "Hello traveler, welcome to the village." },
    { ID: 2, EN: "The ancient sword glows in the moonlight." },
  ];
  const sheet = XLSX.utils.json_to_sheet(data);
  sheet["!cols"] = [{ wch: 8 }, { wch: 60 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Lokalizasyon Şablonu");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

/** Sonuç kayıtlarını (ID, EN + 23 dil) indirilebilir bir Excel dosyasına çevirir. */
export function buildResultWorkbook(records: OutputRecord[]): Buffer {
  const ordered = records.map((r) => {
    const row: Record<string, unknown> = {};
    for (const col of OUTPUT_COLUMNS) {
      row[col] = r[col] ?? "";
    }
    return row;
  });
  const sheet = XLSX.utils.json_to_sheet(ordered, { header: [...OUTPUT_COLUMNS] });
  sheet["!cols"] = OUTPUT_COLUMNS.map((c) => ({ wch: c === "ID" ? 8 : 28 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Lokalize Edilmiş");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
