<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xhtml="http://www.w3.org/1999/xhtml"
                exclude-result-prefixes="sm xhtml">
  <!--
    Sitemap görüntü stylesheet — tarayicilar XML'i bunla render eder,
    Google/Bing/ChatGPT bot'lari XSL'i tamamen ignore edip saf XML olarak parse eder.
    Yani SEO etki yok, sadece operator için güzel görüntü.
  -->
  <xsl:output method="html" indent="yes" encoding="UTF-8" doctype-system="about:legacy-compat"/>

  <xsl:template match="/">
    <html lang="tr">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>CAFEPASTE Sitemap</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
            background: #fafafa;
            color: #1a1a1a;
            padding: 32px 16px;
            line-height: 1.5;
          }
          .container { max-width: 1100px; margin: 0 auto; }
          header { margin-bottom: 24px; }
          h1 {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #0c0c0c;
            margin-bottom: 6px;
          }
          .meta { font-size: 13px; color: #737373; }
          .meta strong { color: #C41E2A; font-weight: 600; }
          .help {
            margin: 20px 0;
            padding: 14px 18px;
            background: #fff;
            border: 1px solid #e5e5e5;
            border-left: 3px solid #C41E2A;
            border-radius: 8px;
            font-size: 14px;
            color: #404040;
          }
          .help strong { color: #111; }
          table {
            width: 100%;
            background: #fff;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            border-collapse: separate;
            border-spacing: 0;
            overflow: hidden;
            font-size: 14px;
          }
          th {
            background: #fbfaf9;
            text-align: left;
            padding: 12px 16px;
            font-weight: 600;
            color: #111;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-bottom: 1px solid #e5e5e5;
          }
          td {
            padding: 10px 16px;
            border-bottom: 1px solid #f5f5f5;
            color: #404040;
            vertical-align: top;
          }
          tr:last-child td { border-bottom: none; }
          tr:hover td { background: #fafafa; }
          td.url { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px; color: #1a1a1a; word-break: break-all; }
          td.url a { color: #1a1a1a; text-decoration: none; }
          td.url a:hover { color: #C41E2A; text-decoration: underline; }
          td.right { text-align: right; }
          .pill {
            display: inline-block;
            padding: 2px 8px;
            font-size: 11px;
            font-weight: 600;
            background: #f5f5f5;
            border-radius: 4px;
            color: #525252;
          }
          .pill.high { background: #fef2f2; color: #C41E2A; }
          @media (max-width: 720px) {
            th, td { padding: 8px 10px; font-size: 12.5px; }
            td.url { font-size: 11.5px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <h1>CAFEPASTE Sitemap</h1>
            <div class="meta">
              <strong><xsl:value-of select="count(sm:urlset/sm:url)"/></strong> URL
              · Bu liste arama motorlari ve AI engine'ler icin
              · Operator goruntusu (XSL ile render edildi, ham XML degil)
            </div>
          </header>

          <div class="help">
            <strong>Not:</strong> Bu sayfayi Bing Webmaster Tools veya Google Search Console'a submit ederken
            "<code>https://cafepaste.com/sitemap.xml</code>" URL'sini direkt yapistir.
            Arama motorlari XSL'i ignore edip ham XML olarak parse eder.
          </div>

          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Son Güncelleme</th>
                <th>Öncelik</th>
                <th>Sıklık</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sm:urlset/sm:url">
                <tr>
                  <td class="url">
                    <a href="{sm:loc}" target="_blank">
                      <xsl:value-of select="sm:loc"/>
                    </a>
                  </td>
                  <td><xsl:value-of select="sm:lastmod"/></td>
                  <td>
                    <xsl:choose>
                      <xsl:when test="number(sm:priority) &gt;= 0.9">
                        <span class="pill high"><xsl:value-of select="sm:priority"/></span>
                      </xsl:when>
                      <xsl:otherwise>
                        <span class="pill"><xsl:value-of select="sm:priority"/></span>
                      </xsl:otherwise>
                    </xsl:choose>
                  </td>
                  <td><xsl:value-of select="sm:changefreq"/></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
