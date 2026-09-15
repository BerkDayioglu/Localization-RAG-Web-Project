import { NextRequest, NextResponse } from "next/server";
import { parseAndValidateUpload } from "@/lib/excel";

// Bu route hiçbir veriyi diske yazmaz: dosya ve API key sadece bu isteğin
// yaşam süresi boyunca bellekte tutulur, cevap dönünce hiçbir iz kalmaz.
//
// KASITLI OLARAK bir zaman aşımı (timeout) SINIRI KOYMUYORUZ: n8n webhook'u
// cevap verene kadar bu istek açık kalır, ne kadar sürerse sürsün bekler.
// Kullanıcı yalnızca n8n/ağ tarafında gerçekten bir bağlantı hatası veya
// zaman aşımı olursa bir hata mesajı görür — biz kendimiz erken kesmeyiz.
//
// ÖNEMLİ (self-host): Node.js'in kendi varsayılan sunucu zaman aşımları
// (requestTimeout, headersTimeout) bunu geçersiz kılabilir. Bunun için
// projeye eklenen `server.js` dosyasıyla çalıştır (bkz. README), plain
// `next start` DEĞİL.
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
  const model = formData.get("model");

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
  if (typeof model !== "string" || model.trim().length === 0) {
    return NextResponse.json({ success: false, error: "Model seçilmedi." }, { status: 400 });
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
      body: JSON.stringify({
        records: validation.records,
        apiKey: apiKey.trim(),
        model: model.trim(),
      }),
      // Kasıtlı olarak signal/timeout YOK — n8n cevap verene kadar bekleriz.
    });
  } catch {
    // fetch sadece gerçek bir ağ hatasında (bağlantı koptu, n8n'e ulaşılamadı,
    // n8n kendi tarafında zaman aşımına uğradı vb.) buraya düşer.
    return NextResponse.json(
      {
        success: false,
        error:
          "Lokalizasyon motoruna bağlanılamadı ya da işlem sırasında bağlantı zaman aşımına uğradı. Lütfen tekrar deneyin.",
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
