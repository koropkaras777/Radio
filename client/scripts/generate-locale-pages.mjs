import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT     = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST     = join(ROOT, 'dist');
const I18N_DIR = join(ROOT, 'src', 'i18n');

const SITE_URL        = 'https://radiosmihun.com';
const DEFAULT_LOCALE  = 'uk';
const RTL_LOCALES     = new Set(['ar', 'he']);

const OG_LOCALE = {
  uk: 'uk_UA', en: 'en_US', pl: 'pl_PL', de: 'de_DE', es: 'es_ES', it: 'it_IT',
  fr: 'fr_FR', pt: 'pt_PT', nl: 'nl_NL', tr: 'tr_TR', ja: 'ja_JP', he: 'he_IL',
  ru: 'ru_RU', zh: 'zh_CN', ko: 'ko_KR', hi: 'hi_IN', ar: 'ar_AR',
};

// ─── Locale data ────────────────────────────────────────────────────────────
const locales = readdirSync(I18N_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const radioStrings = Object.fromEntries(
  locales.map((locale) => [locale, JSON.parse(readFileSync(join(I18N_DIR, locale, 'radio.json'), 'utf8'))])
);

const localeUrl = (locale) => (locale === DEFAULT_LOCALE ? `${SITE_URL}/` : `${SITE_URL}/${locale}/`);

// ─── SEO block per locale ───────────────────────────────────────────────────
function buildSeoBlock(locale) {
  const { radioNameDay, radioNameNight, seoTagline, seoDescription } = radioStrings[locale];
  const title       = `${radioNameDay} - ${seoTagline}`;
  const description = `${radioNameDay} - ${seoDescription}`;
  const url          = localeUrl(locale);

  const hreflangs = locales
    .map((l) => `    <link rel="alternate" hreflang="${l}" href="${localeUrl(l)}" />`)
    .join('\n');

  return `    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="keywords" content="${radioNameDay}, ${radioNameNight}, ${seoTagline}" />

    <link rel="canonical" href="${url}" />
${hreflangs}
    <link rel="alternate" hreflang="x-default" href="${SITE_URL}/" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${radioNameDay}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE_URL}/icon-smihun-192.png" />
    <meta property="og:locale" content="${OG_LOCALE[locale] || locale}" />

    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${SITE_URL}/icon-smihun-192.png" />

    <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "RadioStation", "name": "${radioNameDay}", "alternateName": ["${radioNameNight}"], "url": "${url}", "logo": "${SITE_URL}/icon-smihun-192.png", "inLanguage": "${locale}" }
    </script>`;
}

// ─── Render one HTML file per locale ────────────────────────────────────────
const template = readFileSync(join(DIST, 'index.html'), 'utf8');
const [headRaw, tail1] = template.split('<!-- ─── SEO (generated per locale by scripts/generate-locale-pages.mjs) ─── -->');
const [, tail]          = tail1.split('<!-- ─── /SEO ─── -->');
const head = headRaw.replace(/[ \t]+$/, '');

for (const locale of locales) {
  const dir = RTL_LOCALES.has(locale) ? ' dir="rtl"' : '';
  const html = `${head.replace('<html lang="uk">', `<html lang="${locale}"${dir}>`)}${buildSeoBlock(locale)}${tail}`;

  const outDir = locale === DEFAULT_LOCALE ? DIST : join(DIST, locale);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);
}

console.log(`✔ generated ${locales.length} locale pages (${locales.join(', ')})`);

// ─── Sitemap ─────────────────────────────────────────────────────────────────
const guestUrl = (locale) => (locale === DEFAULT_LOCALE ? `${SITE_URL}/guest` : `${SITE_URL}/${locale}/guest`);

const alternates = (urlOf) => locales
  .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${urlOf(l)}" />`)
  .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${urlOf(DEFAULT_LOCALE)}" />`)
  .join('\n');

const sitemapUrls = [
  ...locales.map((locale) => `  <url>\n    <loc>${localeUrl(locale)}</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n${alternates(localeUrl)}\n  </url>`),
  ...locales.map((locale) => `  <url>\n    <loc>${guestUrl(locale)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.3</priority>\n${alternates(guestUrl)}\n  </url>`),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapUrls.join('\n')}
</urlset>
`;

writeFileSync(join(DIST, 'sitemap.xml'), sitemap);
console.log('✔ generated sitemap.xml');
