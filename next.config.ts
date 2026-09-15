import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// Cloudflare Workers'da `next dev` ile yerel geliştirme sırasında
// Cloudflare binding'lerine (env değişkenleri vb.) erişim sağlar.
// `wrangler dev` / prod build'i etkilemez.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
