# Lokalize — Oyun Metni Lokalizasyon Web Sitesi

Herkesin, kendi OpenRouter API key'iyle, oyun metinlerini 22 dile RAG destekli
bir AI Agent üzerinden lokalize edebildiği web sitesi. n8n'de kurulu
**"Lokalizasyon Web Projesi"** workflow'unu herkese açık bir arayüze bağlar.

---

## İçindekiler

1. [Projenin amacı](#projenin-amacı)
2. [Nasıl çalışır (uçtan uca akış)](#nasıl-çalışır-uçtan-uca-akış)
3. [Mimari](#mimari)
4. [Özellikler](#özellikler)
5. [Teknoloji yığını](#teknoloji-yığını)
6. [Proje yapısı](#proje-yapısı)
7. [Kurulum (yerel geliştirme)](#kurulum-yerel-geliştirme)
8. [Ortam değişkenleri](#ortam-değişkenleri)
9. [n8n tarafı — webhook sözleşmesi](#n8n-tarafı--webhook-sözleşmesi)
10. [Canlıya alma (deploy)](#canlıya-alma-deploy)
11. [Özelleştirme](#özelleştirme)
12. [Gizlilik ve güvenlik](#gizlilik-ve-güvenlik)
13. [Bilinen sınırlamalar](#bilinen-sınırlamalar)
14. [Sorun giderme](#sorun-giderme)
15. [Olası gelecek geliştirmeler](#olası-gelecek-geliştirmeler)

---

## Projenin amacı

Elde hazır bir n8n workflow'u vardı: Google Sheets'ten cümle alıp, Supabase
üzerinde RAG (Character Dictionary + Localization Memory) ile zenginleştirip,
bir AI Agent aracılığıyla 22 dile lokalize eden bir sistem. Bu workflow
sadece n8n arayüzünden, teknik bilgisi olan biri tarafından tetiklenebiliyordu.

Bu proje, o workflow'u **hiçbir teknik bilgisi olmayan herkesin** tarayıcıdan
kullanabileceği bir web sitesine dönüştürür:

- Kullanıcı kendi Excel dosyasını yükler
- Kendi OpenRouter API key'ini girer (kullanım maliyeti kullanıcıya ait olur)
- İstediği OpenRouter modelini seçer
- Sonucu tarayıcıda görür ve Excel olarak indirir

Site, n8n'i **"motor"** olarak kullanır — asıl AI/RAG mantığı hâlâ n8n'de
çalışır, site sadece kullanıcı dostu bir kapı görevi görür.

---

## Nasıl çalışır (uçtan uca akış)

```
1. Kullanıcı siteye girer
2. "Şablonu indir" der → ID/EN sütunlu örnek bir Excel dosyası iner
3. Kendi cümlelerini bu şablona göre doldurur (en fazla 25 satır)
4. Dosyayı siteye yükler
5. Bir OpenRouter modeli seçer (dropdown'dan veya elle yazarak)
6. Kendi OpenRouter API key'ini girer
7. "Lokalize Et" butonuna basar
   → Site, dosyayı sunucu tarafında okur ve doğrular:
     - ID ve EN sütunları var mı?
     - Boş satır var mı?
     - Tekrarlanan ID var mı?
     - 25 satır sınırı aşılmış mı?
   → Hatalıysa kullanıcıya anında, net bir Türkçe hata mesajı gösterilir,
     n8n'e hiç istek gitmez.
8. Doğrulama geçerse, site n8n'deki webhook'a bir POST isteği atar:
   { records: [{ID, EN}, ...], apiKey: "...", model: "..." }
9. n8n tarafında:
   a. Gelen veri n8n'in KENDİ doğrulama katmanından da geçer (savunma amaçlı,
      web sitesi atlanıp doğrudan webhook'a istek atılsa bile korunur)
   b. AI Agent, her cümle için:
      - Character Dictionary'den (Supabase RAG) karakter isimlerini çeker
      - Localization Memory'den (Supabase RAG) geçmiş çevirileri/terminolojiyi
        referans alır
      - Kullanıcının seçtiği modeli, kullanıcının kendi API key'iyle
        OpenRouter üzerinden çağırır
      - 22 dilde lokalize metin üretir (kelime kelime çeviri DEĞİL, gerçek
        lokalizasyon — ton, mizah, karakter kimliği korunarak)
   c. Sonuç, arşiv amaçlı Google Sheets'e de yazılır
   d. Sonuç, JSON olarak web sitesine geri döner
10. Site sonucu bir tabloda gösterir (dil sütunları arasında geçiş yapılabilir)
11. Kullanıcı "Excel olarak indir" der → 25 dil sütunlu (ID + EN + 22 dil)
    bir .xlsx dosyası iner
12. İşlem biter — yüklenen dosya, API key, hiçbir şey sunucuda kalmaz
```

**Zaman aşımı yok:** Adım 8-9 birkaç dakika ile yirmi dakika arası sürebilir
(cümle sayısına ve seçilen modele bağlı). Site bu süre boyunca kendi
tarafında bir kesme yapmaz, n8n cevap verene kadar bekler.

---

## Mimari

```
┌──────────────────────────┐          ┌─────────────────────────────────────┐
│      WEB SİTESİ           │          │   n8n — "Lokalizasyon Web Projesi"    │
│      (Next.js)            │          │                                        │
│                            │  HTTPS   │  [Webhook] ◄── POST                   │
│  app/page.tsx              │ ──────►  │      │                                │
│   - şablon indir            │  POST    │      ▼                                │
│   - dosya yükle             │  JSON    │  [Validate Input] (Code)              │
│   - model seç               │          │      │                                │
│   - API key gir             │          │      ▼                                │
│   - sonuç önizleme          │          │  [Veri Geçerli mi?] (IF)              │
│   - Excel indir             │          │   ├─ Hayır → [Respond Error] (400)    │
│                            │          │   └─ Evet                             │
│  app/api/                  │          │      ▼                                │
│   /template  → boş şablon   │          │  [object to string1] (Set)            │
│   /localize  → doğrulama +  │          │   → data, apiKey, model çıkarır       │
│               n8n'e proxy   │          │      ▼                                │
│   /export    → sonuç→Excel  │          │  [TEST 100 CÜMLE1] (AI Agent)          │
│                            │          │   ├─ OpenAI Chat Model                │
│  lib/                      │          │   │   (OpenRouter uyumlu, dinamik      │
│   constants.ts → dil/model  │  ◄────── │   │    key + dinamik model)           │
│   excel.ts → parse/validate │  JSON    │   ├─ Character Dictionary (RAG tool)  │
│                            │          │   └─ Localization Memory (RAG tool)   │
└──────────────────────────┘          │      ▼                                │
                                        │  [Loop Over Items1] → [Code in JS1]   │
                                        │      │           │                    │
                                        │      ▼           ▼                    │
                                        │  [Append row    [Aggregate Response]  │
                                        │   in sheet]           │                │
                                        │   (arşiv)             ▼                │
                                        │                [Respond to Webhook]   │
                                        └─────────────────────────────────────┘
```

**Önemli mimari kararlar:**

- **Senkron (asenkron değil):** Tek bir HTTP isteği baştan sona açık kalır.
  Basit ama uzun işlemlerde kırılgan (bkz. [Bilinen sınırlamalar](#bilinen-sınırlamalar)).
- **n8n motor, site kapı:** RAG, AI Agent mantığı hep n8n'de. Site bunu
  yeniden yazmaz, sadece sarar.
- **RAG bilgi tabanı ortak/paylaşımlı:** Character Dictionary ve Localization
  Memory tüm kullanıcılar için aynı — kullanıcı başına izole değil. Bu
  bilgi tabanını beslemek web sitesinden değil, n8n üzerinden elle yapılır.
- **Hiçbir kalıcı veri yok:** Dosya, API key, sonuç — hepsi tek isteğin
  ömrü kadar yaşar. Google Sheets'e yazılan arşiv dışında site tarafında
  hiçbir veritabanı yoktur.

---

## Özellikler

- ✅ Excel (.xlsx) şablon indirme
- ✅ Sunucu taraflı şablon doğrulama (sütun kontrolü, boş satır, tekrarlanan ID)
- ✅ OpenRouter model seçimi (hazır liste + özel model girme)
- ✅ Kullanıcının kendi API key'i ile çalışma (hiç saklanmaz)
- ✅ Zaman aşımı sınırı yok — n8n cevap verene kadar bekler
- ✅ Sonuç önizleme tablosu (dil sütunları arasında geçiş)
- ✅ Excel olarak sonuç indirme
- ✅ Net, Türkçe hata mesajları
- ✅ Mobilde de çalışan, tek sayfalık akış

---

## Teknoloji yığını

| Katman | Teknoloji |
|---|---|
| Framework | Next.js 16 (App Router) |
| Dil | TypeScript |
| Stil | Tailwind CSS v4 |
| Excel okuma/yazma | [SheetJS (xlsx)](https://www.npmjs.com/package/xlsx) |
| Backend | Next.js API Routes (Node.js runtime) |
| AI/RAG motoru | n8n (self-hosted) + Supabase (vector store) + OpenRouter |

---

## Proje yapısı

```
localization-web/
├── app/
│   ├── page.tsx                 # Tüm kullanıcı arayüzü (tek sayfa akışı)
│   ├── layout.tsx               # Kök layout, metadata
│   ├── globals.css              # Tasarım tokenları (renk, tipografi)
│   └── api/
│       ├── template/route.ts    # GET  → boş Excel şablonu üretir
│       ├── localize/route.ts    # POST → dosyayı doğrular, n8n'e proxy'ler
│       └── export/route.ts      # POST → sonuç JSON'unu Excel'e çevirir
├── lib/
│   ├── constants.ts             # Dil listesi, model listesi, limitler
│   └── excel.ts                 # Excel parse/validate/build fonksiyonları
├── server.js                    # (isteğe bağlı) Node'un 5dk'lık varsayılan
│                                 # sunucu zaman aşımını kapatan alternatif
│                                 # başlatıcı — npm run start:no-timeout
├── .env.example                 # Ortam değişkeni şablonu
├── package.json
└── README.md
```

---

## Kurulum (yerel geliştirme)

Node.js 20 veya üzeri gerekli.

```bash
cd localization-web
npm install
cp .env.example .env.local
```

`.env.local` içine n8n'deki Webhook node'unun **Production URL**'ini yapıştır
(bkz. [Ortam değişkenleri](#ortam-değişkenleri)).

```bash
npm run dev
```

Tarayıcıda `http://localhost:3000` adresini aç.

---

## Ortam değişkenleri

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `N8N_WEBHOOK_URL` | Evet | n8n'deki "Lokalizasyon Web Projesi" workflow'unun Webhook node'unun tam Production URL'i. n8n arayüzünde Webhook node'una tıklayıp kopyalanır. Örnek: `https://senin-n8n-domainin.com/webhook/lokalizasyon-localize` |

Bu değişken sadece **sunucu tarafında** kullanılır, tarayıcıya hiçbir şekilde
gönderilmez.

---

## n8n tarafı — webhook sözleşmesi

Web sitesi ile n8n arasındaki "anlaşma" (contract) budur. n8n workflow'u
değişirse, aşağıdaki format da buna göre güncellenmeli (ve `lib/constants.ts`
ile `lib/excel.ts` da eşleştirilmeli).

**İstek:**

```
POST https://senin-n8n-domainin/webhook/lokalizasyon-localize
Content-Type: application/json

{
  "records": [
    { "ID": 1, "EN": "Hello traveler, welcome to the village." },
    { "ID": 2, "EN": "The ancient sword glows in the moonlight." }
  ],
  "apiKey": "sk-or-v1-...",
  "model": "google/gemini-2.5-flash"
}
```

**Kısıtlar:** en fazla 25 kayıt, her kayıtta benzersiz `ID` ve boş olmayan `EN`.

**Başarılı cevap (200):**

```json
{
  "data": [
    {
      "ID": 1, "EN": "...", "TR": "...", "DE": "...", "AR": "...",
      "ZH_TW": "...", "FR": "...", "ES": "...", "IT": "...", "RU": "...",
      "PT": "...", "JA": "...", "KR": "...", "TH": "...", "VI": "...",
      "IN": "...", "PL": "...", "CS": "...", "HU": "...", "RO": "...",
      "ZH_CN": "...", "ML": "...", "NL": "...", "UK": "..."
    }
  ]
}
```

**Hata cevabı (400):**

```json
{ "success": false, "error": "..." }
```

n8n workflow'u içinde bu sözleşmeyi sağlayan node'lar:

- **Webhook** — isteği karşılar
- **Validate Input** (Code) — `apiKey`/`records` eksikse, 25'i aşıyorsa,
  ID/EN boşsa → hata üretir
- **Veri Geçerli mi?** (IF) — geçersizse `Respond Error`'a yönlendirir
- **object to string1** (Set) — `data`, `apiKey`, `model` alanlarını hazırlar
- **TEST 100 CÜMLE1** (AI Agent) — asıl lokalizasyon işini yapar
  - **OpenAI Chat Model (OpenRouter)** alt-node'u, credential'ındaki `apiKey`
    alanı `{{ $json.apiKey }}` ifadesiyle, `model` alanı `{{ $json.model }}`
    ifadesiyle **her istekte dinamik olarak** doldurulur. Base URL elle
    `https://openrouter.ai/api/v1` olarak ayarlıdır (OpenRouter, OpenAI
    uyumlu bir API sunduğu için bu şekilde çalışır).
  - `maxIterations: 60` — 25 cümle için gereken (cümle başına 2 zorunlu RAG
    sorgusu) adım sayısına yetecek şekilde ayarlanmıştır.
- **Aggregate Response** + **Respond to Webhook** — sonucu JSON olarak
  web sitesine döner

---

## Canlıya alma (deploy)

### ⚠️ Vercel / serverless platformlar UYGUN DEĞİL

İşlem 10+ dakika sürebiliyor; serverless platformlar fonksiyon çalışma
süresine sert bir üst sınır koyar ve bunu kod tarafından aşamazsın.

### Doğru yöntem: kendi VPS'inde çalıştırmak

n8n'i zaten kendi VPS'inde çalıştırdığın için, en tutarlı seçenek web
sitesini de aynı (ya da başka bir) VPS'te normal bir Node.js süreci olarak
çalıştırmak:

```bash
npm run build
npm start
# ya da kalıcı çalışması için pm2 ile:
pm2 start npm --name lokalize -- start
```

### nginx kullanıyorsan mutlaka ekle

nginx'in varsayılan zaman aşımı süresi genelde sadece 60 saniyedir. Bu
sitenin `location` bloğuna şunu eklemen **şart**:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_connect_timeout 3600s;
}
```

Sonra: `sudo systemctl reload nginx`

### `npm start` ile hâlâ ~5 dakikada kesiliyorsa

Node.js 18+, http sunucularına varsayılan olarak 5 dakikalık bir istek
zaman aşımı koyar. Bunu tamamen kapatan alternatif başlatma komutu:

```bash
npm run start:no-timeout
```

Bu komut `server.js` dosyasını kullanır ve Node'un bu varsayılanını kapatır.
Önce normal `npm start` ile dene, sorun yaşarsan bu alternatife geç.

---

## Özelleştirme

**Cümle limitini değiştirmek:** `lib/constants.ts` içindeki
`MAX_RECORDS_PER_REQUEST` değerini değiştir. **Not:** limiti önemli ölçüde
yükseltirsen (örn. 100+), n8n tarafında da AI Agent çağrısının parçalara
bölünmesi (batching) gerekebilir — aksi hâlde tek seferde çok fazla cümle,
kesilmiş/yarım çıktı riski taşır.

**Model listesini değiştirmek:** `lib/constants.ts` içindeki
`OPENROUTER_MODELS` dizisini düzenle. Her öğe `{ value, label }` şeklinde;
`value` gerçek OpenRouter model slug'ı olmalı (bkz.
[openrouter.ai/models](https://openrouter.ai/models)).

**Varsayılan modeli değiştirmek:** `lib/constants.ts` içindeki
`DEFAULT_MODEL` değerini değiştir. Bu değer, n8n workflow'undaki
`object to string1` node'unun fallback değeriyle (`|| 'google/gemini-2.5-flash'`)
de eşleşmeli.

**Tasarımı değiştirmek:** Renk ve tipografi tokenları `app/globals.css`
içindeki `:root` bloğunda (`--ink`, `--amber`, `--teal`, `--background`,
`--line`).

---

## Gizlilik ve güvenlik

- Yüklenen Excel dosyası, girilen API key ve model seçimi **hiçbir yerde
  kalıcı olarak saklanmaz.** Hepsi bir HTTP isteğinin ömrü boyunca sunucu
  belleğinde tutulur, cevap dönünce hiçbir iz kalmaz.
- API key, tarayıcıda `type="password"` alanında girilir, `localStorage`'a
  ya da `cookie`'ye yazılmaz.
- API key, n8n'e HTTPS üzerinden (n8n'in domain'i HTTPS ise) iletilir ve
  yalnızca o isteğin OpenRouter çağrısında kullanılır.
- Site, kullanıcı hesabı/kimlik doğrulaması gerektirmez — herkes anonim
  kullanır. Bu, kötüye kullanım (aşırı istek gönderme) karşısında ekstra
  koruma olmadığı anlamına gelir; gerekirse rate-limiting eklenmesi önerilir.

---

## Bilinen sınırlamalar

- **Senkron mimari:** Kullanıcı, işlem bitene kadar sayfada kalmalı. Sayfa
  kapatılır, sekme uyku moduna geçer veya ağ kesilirse, işlem tamamlanmış
  olsa bile kullanıcı sonucu göremez (n8n tarafında iş yine biter ve
  Google Sheets'e arşivlenir, ama web sitesi üzerinden erişilemez).
- **Cümle başına ortalama süre yüksek:** Her cümle için 2 zorunlu RAG
  sorgusu + 22 dilde üretim nedeniyle, 25 cümlelik bir istek 10+ dakika
  sürebilir.
- **RAG bilgi tabanı web sitesinden yönetilmiyor:** Character Dictionary ve
  Localization Memory'yi güncellemek için hâlâ n8n'e girmek gerekiyor.
- **Rate limiting yok:** Herkes anonim ve sınırsız istek atabilir (25
  cümle/istek sınırı dışında).
- **Tek dil RAG bağlamı:** Tüm kullanıcılar aynı paylaşımlı bilgi tabanını
  kullanır — çoklu proje/oyun desteği yoktur.

---

## Sorun giderme

| Belirti | Olası sebep | Çözüm |
|---|---|---|
| "Lokalizasyon motoruna bağlanılamadı" | `N8N_WEBHOOK_URL` yanlış, n8n kapalı, workflow pasif | n8n'de workflow'un **aktif** olduğunu ve URL'nin doğru kopyalandığını kontrol et |
| İşlem ~5 dakikada kesiliyor (site tarafında) | Node.js'in varsayılan `requestTimeout`'u | `npm run start:no-timeout` kullan |
| İşlem ~60 saniyede kesiliyor (VPS + nginx) | nginx'in varsayılan `proxy_read_timeout`'u | nginx config'e `proxy_read_timeout 3600s` ekle, reload et |
| n8n'de "Max iterations reached" hatası | AI Agent'ın izinli adım sayısı (`maxIterations`) çok fazla RAG sorgusuna yetmiyor | n8n'de agent node'unun `maxIterations` değerini artır |
| n8n'de "Incorrect API key... platform.openai.com" | Dil modeli node'u yanlışlıkla OpenAI'a gidiyor, OpenRouter'a değil | n8n'de credential'ın base URL'inin `https://openrouter.ai/api/v1` olduğunu doğrula |
| "Şablon hatalı: ID ve EN sütunları bulunmalı" | Yüklenen dosyanın başlık satırı yanlış/eksik | Siteden indirilen orijinal şablonu kullan, sütun adlarını değiştirme |
| "ID ... birden fazla satırda kullanılmış" | Excel'de tekrarlanan ID değeri var | Her satıra benzersiz bir ID ver |

---

## Olası gelecek geliştirmeler

Şu an bilinçli olarak basit tutulan, ama ileride ihtiyaç olursa eklenebilecek
geliştirmeler:

- **Asenkron mimari:** İstek anında bir "iş numarası" ile kabul edilir, site
  arka planda periyodik olarak durumu kontrol eder. Senkron mimarinin
  kırılganlığını (bkz. Bilinen sınırlamalar) tamamen ortadan kaldırır, ama
  ek bir kalıcı depolama (ör. Supabase'de bir "jobs" tablosu) gerektirir.
- **Cümle bazlı batching:** Büyük dosyaları n8n tarafında otomatik küçük
  parçalara bölüp arka arkaya işlemek — cümle limitini güvenle yükseltmeyi
  sağlar.
- **Basit admin paneli:** RAG bilgi tabanını (Character Dictionary,
  Localization Memory) web sitesinden, n8n'e hiç girmeden güncelleyebilme.
- **Rate limiting / basit kimlik doğrulama:** Kötüye kullanımı önlemek için.
