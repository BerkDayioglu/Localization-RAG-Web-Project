import { NextRequest, NextResponse } from "next/server";
import { parseAndValidateUpload } from "@/lib/excel";

// Bu route hiçbir veriyi diske yazmaz: dosya ve API key sadece bu isteğin
// yaşam süresi boyunca bellekte tutulur, cevap dönünce hiçbir iz kalmaz.
export async function POST(req: NextRequest) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { success: false, error: "Sunucu yapılandırması eksik: N8N_WEBHOOK_URL tanımlı değil." },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "İstek okunamadı." }, { status: 400 });
  }

  const file = formData.get("file");
  const apiKey = formData.get("apiKey");

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Excel dosyası bulunamadı." }, { status: 400 });
  }
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return NextResponse.json({ success: false, error: "OpenRouter API key girilmedi." }, { status: 400 });
  }
  if (!apiKey.trim().startsWith("sk-or-")) {
    return NextResponse.json(
      { success: false, error: 'Bu bir geçerli OpenRouter API key\'ine benzemiyor (genelde "sk-or-" ile başlar).' },
      { status: 400 },
    );
  }

  const buffer = await file.arrayBuffer();
  const validation = parseAndValidateUpload(buffer);
  if (!validation.ok) {
    return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
  }

  let n8nResponse: Response;
  try {
    n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records: validation.records, apiKey: apiKey.trim() }),
      // 25 cümle sınırıyla bile AI Agent'ın işi birkaç dakika sürebilir.
      signal: AbortSignal.timeout(4 * 60 * 1000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return NextResponse.json(
      {
        success: false,
        error: timedOut
          ? "İşlem çok uzun sürdü ve zaman aşımına uğradı. Lütfen daha az cümleyle tekrar deneyin."
          : "Lokalizasyon motoruna ulaşılamadı. Lütfen daha sonra tekrar deneyin.",
      },
      { status: 504 },
    );
  }

  let payload: unknown;
  try {
    payload = await n8nResponse.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Lokalizasyon motorundan geçersiz bir cevap geldi." },
      { status: 502 },
    );
  }

  if (!n8nResponse.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : "Lokalizasyon sırasında bir hata oluştu.";
    return NextResponse.json({ success: false, error: message }, { status: n8nResponse.status });
  }

  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    return NextResponse.json(
      { success: false, error: "Lokalizasyon motorundan beklenmeyen bir veri formatı geldi." },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, results: data });
}
