# Lokalize — Oyun Metni Lokalizasyon Web Sitesi

Bu proje, "Lokalizasyon Web Projesi" adlı n8n workflow'unu herkesin kullanabileceği
bir web sitesine dönüştürür. Next.js (App Router) ile yazıldı.

## Nasıl çalışır

1. Kullanıcı şablonu indirir (ID, EN sütunlu Excel)
2. Doldurduğu dosyayı yükler (en fazla 25 satır)
3. Kendi OpenRouter API key'ini girer
4. Site, dosyayı okuyup doğrular, sonra n8n'deki webhook'a gönderir
5. n8n, AI Agent ile 22 dile lokalize eder, sonucu JSON olarak geri döner
6. Site sonucu ekranda tablo olarak gösterir, Excel olarak indirilebilir

Hiçbir dosya veya API key sunucuda kalıcı olarak saklanmaz — her şey tek bir
isteğin ömrü boyunca bellekte tutulur.

## Kurulum (bilgisayarında çalıştırmak için)

Node.js 20+ kurulu olmalı (https://nodejs.org).

```bash
cd localization-web
npm install
cp .env.example .env.local
```

`.env.local` dosyasını aç ve `N8N_WEBHOOK_URL` değerine n8n'deki Webhook
node'unun **Production URL**'ini yapıştır. Bunu n8n arayüzünde ilgili workflow'u
açıp Webhook node'una tıklayarak bulabilirsin. Örnek:

```
N8N_WEBHOOK_URL=https://senin-n8n-domainin.com/webhook/lokalizasyon-localize
```

Ardından:

```bash
npm run dev
```

Tarayıcıda http://localhost:3000 adresini aç.

## Canlıya alma (deploy)

En kolay yol **Vercel**:

1. Bu projeyi bir GitHub reposuna yükle
2. https://vercel.com adresinde "New Project" ile o reposu bağla
3. "Environment Variables" kısmına `N8N_WEBHOOK_URL` değerini ekle
4. Deploy et — birkaç dakika içinde herkesin erişebileceği bir link alırsın

## Önemli notlar / bilinmesi gerekenler

- **n8n sunucunun her zaman açık ve erişilebilir olması lazım.** Web sitesi
  her istekte n8n'deki webhook'a bağlanıyor; n8n kapalıysa veya workflow pasifse
  site çalışmaz.
- **25 cümle sınırı** kasıtlı: AI Agent'ın tek seferde çok fazla cümle işlemesi
  zaman aşımı veya yarım kalmış (kesilmiş) çıktı riski taşıyor. Bu sınırı
  `lib/constants.ts` içindeki `MAX_RECORDS_PER_REQUEST` değerinden
  değiştirebilirsin, ama yükseltirsen n8n tarafında da işlemi parçalara bölmek
  (batching) gerekebilir.
- **RAG bilgi tabanı (Character Dictionary + Localization Memory)** bu web
  sitesinden yönetilmiyor — bu kasıtlı bir tasarım kararı. Onu hâlâ n8n
  üzerinden, elle besliyorsun.
- İşlem büyük dosyalarda birkaç dakika sürebilir; `app/api/localize/route.ts`
  içinde 4 dakikalık bir zaman aşımı ayarlı, gerekirse artırabilirsin.

## Proje yapısı

```
app/
  page.tsx                 → tüm kullanıcı arayüzü (tek sayfa akışı)
  api/template/route.ts    → boş Excel şablonunu üretir
  api/localize/route.ts    → yüklenen dosyayı doğrular, n8n'e gönderir
  api/export/route.ts      → sonucu Excel dosyasına çevirir
lib/
  constants.ts             → dil listesi, limitler
  excel.ts                 → Excel okuma/yazma/doğrulama mantığı
```
