// Bu dosya, `next start` yerine kullanılır ÇÜNKÜ Node.js'in http sunucusu
// varsayılan olarak `requestTimeout` (5 dakika) ve `headersTimeout` (60 sn)
// gibi sınırlar koyar. Lokalizasyon işlemi bunlardan çok daha uzun sürebildiği
// için bu sınırları burada açıkça KAPATIYORUZ (0 = sınırsız).
//
// Kullanım: `node server.js`  (bkz. package.json -> "start" script'i)
const { createServer } = require("node:http");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error("İstek işlenirken hata:", err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: false, error: "Sunucuda beklenmeyen bir hata oluştu." }));
      } else {
        res.end();
      }
    });
  });

  // Tek bir isteğin patlaması yüzünden TÜM sunucunun çökmesini engelle.
  process.on("uncaughtException", (err) => {
    console.error("Yakalanmamış istisna:", err);
  });
  process.on("unhandledRejection", (err) => {
    console.error("Yakalanmamış promise reddi:", err);
  });

  // Bu üçü olmadan Node, uzun süren lokalizasyon isteklerini kendi
  // varsayılan zaman aşımlarıyla erken keser.
  server.requestTimeout = 0; // varsayılan: 300000 ms (5 dk) -> sınırsız
  server.headersTimeout = 0; // varsayılan: 60000 ms -> sınırsız
  server.keepAliveTimeout = 0; // bağlantı boşta kalırsa da kapatma

  server.listen(port, () => {
    console.log(`> Lokalize hazır: http://localhost:${port} (istek zaman aşımı devre dışı)`);
  });
});
