import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Resolves the deployed site origin from explicit config or hosting env vars
 * so social crawlers (WhatsApp, Facebook, Telegram) receive an absolute og:image URL.
 */
function resolveSiteUrl(env) {
  const raw =
    env.VITE_SITE_URL ||
    env.SITE_URL ||
    env.VERCEL_PROJECT_PRODUCTION_URL ||
    env.VERCEL_URL ||
    env.URL ||
    env.CF_PAGES_URL ||
    '';

  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function socialMetaPlugin(siteUrl) {
  return {
    name: 'social-meta-absolute-urls',
    transformIndexHtml(html) {
      if (!siteUrl) return html;

      const thumbUrl = `${siteUrl}/thumb.jpg`;
      const extraTags = [
        `    <link rel="canonical" href="${siteUrl}/" />`,
        `    <meta property="og:url" content="${siteUrl}/" />`,
        ...(thumbUrl.startsWith('https://')
          ? [`    <meta property="og:image:secure_url" content="${thumbUrl}" />`]
          : []),
      ].join('\n');

      return html
        .replaceAll('content="/thumb.jpg"', `content="${thumbUrl}"`)
        .replace('</head>', `${extraTags}\n  </head>`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const siteUrl = resolveSiteUrl(env);

  return {
    plugins: [
      react(),
      tailwindcss(),
      socialMetaPlugin(siteUrl),
    ],
    server: {
      host: true,
      port: 3000,
      watch: {
        ignored: ['**/public/**', '**/.git/**'],
      },
    },
  };
});
