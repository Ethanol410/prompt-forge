import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * CSP stricte (règle de sécurité non négociable). Injectée uniquement dans le build de production :
 * - en dev, Vite injecte des scripts inline (HMR / React Refresh) qu'une CSP stricte casserait ;
 * - `connect-src` est limité à Anthropic (D2) + endpoints locaux (Ollama / LM Studio).
 * En production réelle, cette CSP devrait AUSSI être posée en en-tête HTTP au niveau du serveur/CDN.
 */
function strictCspPlugin(): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    // `data:` requis : Vite inline certaines sous-polices (@fontsource) en data-URI au build.
    // Une police data-URI est inerte (aucune exécution) → la CSP reste stricte.
    "font-src 'self' data:",
    "connect-src 'self' https://api.anthropic.com https://openrouter.ai https://us.i.posthog.com https://us-assets.i.posthog.com http://localhost:* http://127.0.0.1:*",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // `frame-ancestors` est ignoré en <meta> ; l'anti-clickjacking est posé en en-tête HTTP
    // (X-Frame-Options: DENY) via vercel.json.
  ].join('; ');

  return {
    name: 'promptforge-strict-csp',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // ctx.server est présent en dev ; absent au build → on n'injecte qu'au build.
        if (ctx.server) return html;
        return html.replace(
          '</head>',
          `  <meta http-equiv="Content-Security-Policy" content="${csp}" />\n  </head>`,
        );
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), strictCspPlugin()],
  server: { port: 5173 },
});
