<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes" />

  <xsl:template match="/">
    <html lang="uk">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sitemap - Радіо Сміхун</title>
        <style>
          :root { color-scheme: dark; }
          * { box-sizing: border-box; }
          body { margin: 0; background: #111827; color: #fff; font-family: 'Segoe UI', Roboto, sans-serif; }
          header { padding: 32px 24px 16px; }
          h1 { margin: 0 0 4px; font-size: 28px; font-weight: 800; letter-spacing: 0.02em; }
          header p { margin: 0; color: rgba(255,255,255,0.5); font-size: 14px; }
          .wrap { overflow-x: auto; padding: 0 24px 32px; }
          table { width: 100%; border-collapse: collapse; min-width: 640px; }
          th, td { text-align: left; padding: 10px 16px; font-size: 14px; white-space: nowrap; }
          thead th { color: rgba(255,255,255,0.5); text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.12); }
          tbody tr:nth-child(odd) { background: rgba(255,255,255,0.03); }
          tbody tr:hover { background: rgba(59,130,246,0.12); }
          td.loc { white-space: normal; word-break: break-all; }
          a { color: #60a5fa; text-decoration: none; font-weight: 600; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <header>
          <h1>Sitemap</h1>
          <p><xsl:value-of select="count(sitemap:urlset/sitemap:url)" /> адрес - для пошукових ботів це той самий файл у форматі XML, це подання лише для людей</p>
        </header>
        <div class="wrap">
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Change freq</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sitemap:urlset/sitemap:url">
                <tr>
                  <td class="loc">
                    <a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc" /></a>
                  </td>
                  <td><xsl:value-of select="sitemap:changefreq" /></td>
                  <td><xsl:value-of select="sitemap:priority" /></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
