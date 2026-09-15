"use client";

import { useRef, useState } from "react";
import { LANGUAGE_COLUMNS, LANGUAGE_LABELS, OutputRecord } from "@/lib/constants";

type Status = "idle" | "loading" | "error" | "success";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<OutputRecord[] | null>(null);
  const [previewLang, setPreviewLang] = useState<string>("TR");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = file !== null && apiKey.trim().length > 0 && status !== "loading";

  async function handleSubmit() {
    if (!file) return;
    setStatus("loading");
    setError(null);
    setResults(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("apiKey", apiKey.trim());

    try {
      const res = await fetch("/api/localize", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setStatus("error");
        setError(json.error ?? "Bilinmeyen bir hata oluştu.");
        return;
      }
      setResults(json.results);
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
    }
  }

  async function handleDownload() {
    if (!results) return;
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lokalize-edilmis.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetAll() {
    setFile(null);
    setApiKey("");
    setStatus("idle");
    setError(null);
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex-1">
      <header className="border-b border-line">
        <div className="mx-auto max-w-[720px] px-6 py-10">
          <p className="font-mono text-xs tracking-wide text-teal">oyun metni lokalizasyon aracı</p>
          <h1 className="mt-2 font-display italic text-4xl text-ink">Lokalize</h1>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-ink/70">
            Cümlelerinizi yükleyin, kendi OpenRouter anahtarınızla 22 dile aynı anda çevrilsin —
            karakter isimleri ve geçmiş çeviriler referans alınarak.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-6 py-10">
        {status !== "success" && (
          <ol className="space-y-6">
            <StepCard n={1} title="Şablonu indir">
              <p className="text-sm text-ink/70">
                Cümlelerinizi <span className="font-mono">ID</span> ve{" "}
                <span className="font-mono">EN</span> sütunlarına göre dolduracağınız Excel şablonu.
              </p>
              <a
                href="/api/template"
                className="mt-3 inline-flex w-fit items-center gap-2 rounded-sm border border-ink/20 px-4 py-2 text-sm font-medium text-ink transition hover:border-ink hover:bg-ink hover:text-background"
              >
                lokalizasyon-sablonu.xlsx indir
              </a>
            </StepCard>

            <StepCard n={2} title="Doldurduğunuz dosyayı yükleyin">
              <p className="text-sm text-ink/70">En fazla 25 cümle, tek dosya, .xlsx formatında.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-3 block w-full cursor-pointer rounded-sm border border-dashed border-ink/30 bg-background/60 px-4 py-3 text-sm text-ink/80 file:mr-4 file:rounded-sm file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-background"
              />
              {file && <p className="mt-2 text-xs text-teal">{file.name} seçildi</p>}
            </StepCard>

            <StepCard n={3} title="OpenRouter API anahtarınızı girin">
              <p className="text-sm text-ink/70">
                Anahtarınız hiçbir yerde saklanmaz; yalnızca bu işlem için kullanılır.
              </p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-..."
                className="mt-3 w-full rounded-sm border border-ink/20 bg-background px-4 py-2.5 font-mono text-sm text-ink placeholder:text-ink/30 focus:border-ink focus:outline-none"
              />
            </StepCard>

            <StepCard n={4} title="Lokalize et">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex w-fit items-center gap-2 rounded-sm bg-amber px-5 py-2.5 text-sm font-semibold text-ink transition disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/40"
              >
                {status === "loading" ? "İşleniyor…" : "Lokalize Et"}
              </button>
              {status === "loading" && (
                <p className="mt-3 text-xs text-ink/60">
                  Cümleleriniz 22 dile çevriliyor, karakter sözlüğü ve geçmiş çeviriler kontrol
                  ediliyor. Bu birkaç dakika sürebilir, sayfayı kapatmayın.
                </p>
              )}
              {status === "error" && error && (
                <p className="mt-3 rounded-sm border border-red-900/20 bg-red-900/5 px-3 py-2 text-sm text-red-800">
                  {error}
                </p>
              )}
            </StepCard>
          </ol>
        )}

        {status === "success" && results && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-xs tracking-wide text-teal">tamamlandı</p>
                <h2 className="mt-1 font-display text-2xl text-ink">
                  {results.length} cümle lokalize edildi
                </h2>
              </div>
              <button
                onClick={handleDownload}
                className="rounded-sm bg-ink px-4 py-2.5 text-sm font-semibold text-background"
              >
                Excel olarak indir
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {LANGUAGE_COLUMNS.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setPreviewLang(lang)}
                  className={`rounded-sm px-2.5 py-1 font-mono text-xs transition ${
                    previewLang === lang
                      ? "bg-ink text-background"
                      : "bg-ink/5 text-ink/60 hover:bg-ink/10"
                  }`}
                  title={LANGUAGE_LABELS[lang]}
                >
                  {lang}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-sm border border-line">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-ink/5 font-mono text-xs uppercase tracking-wide text-ink/50">
                    <th className="px-4 py-2.5 font-medium">ID</th>
                    <th className="px-4 py-2.5 font-medium">EN</th>
                    <th className="px-4 py-2.5 font-medium">{previewLang}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 align-top font-mono text-xs text-ink/50">{row.ID}</td>
                      <td className="px-4 py-3 align-top text-ink/80">{row.EN}</td>
                      <td className="px-4 py-3 align-top text-ink">{row[previewLang] ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={resetAll} className="text-sm text-ink/50 underline underline-offset-4">
              Yeni bir dosya lokalize et
            </button>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-line">
        <div className="mx-auto max-w-[720px] px-6 py-6 text-xs text-ink/40">
          Yüklenen dosyalar ve API anahtarları sunucuda saklanmaz.
        </div>
      </footer>
    </div>
  );
}

function StepCard({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 rounded-sm border border-line bg-white/40 p-5">
      <span className="font-display text-xl italic text-amber">{n}</span>
      <div className="flex flex-1 flex-col items-start gap-1">
        <h3 className="font-medium text-ink">{title}</h3>
        {children}
      </div>
    </li>
  );
}
