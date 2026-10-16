/**
 * Email design.
 *
 * Every message is wrapped in the same ivory-on-white shell: serif headings,
 * hairline blush rules, a single mulberry button, and a quiet footer. Email
 * clients are conservative, so headings fall back through Georgia and the
 * layout is a single 560px table.
 */

export type EmailDesign = {
  preheader?: string
  heading: string
  /** Plain-text paragraphs; blank lines separate them. */
  body: string
  cta?: { label: string; url: string }
  /** Small print under the button — receipts, policy notes. */
  footnote?: string
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function paragraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function textToHtml(body: string): string {
  return paragraphs(body)
    .map(
      (part) =>
        `<p style="margin:0 0 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3b3536;">${escapeHtml(part).replaceAll('\n', '<br />')}</p>`,
    )
    .join('')
}

export function renderEmailHtml(design: EmailDesign): string {
  const preheader = design.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(design.preheader)}</div>`
    : ''
  const cta = design.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="border-radius:999px;background:#7a3e4d;">
         <a href="${escapeHtml(design.cta.url)}" style="display:inline-block;padding:13px 30px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:0.04em;color:#fbf7f4;text-decoration:none;border-radius:999px;">${escapeHtml(design.cta.label)}</a>
       </td></tr></table>`
    : ''
  const footnote = design.footnote
    ? `<p style="margin:0 0 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#8a7e7a;">${escapeHtml(design.footnote)}</p>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(design.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#fbf7f4;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf7f4;">
    <tr>
      <td align="center" style="padding:28px 16px 40px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding:0 4px 18px;">
              <span style="font-family:Georgia,'Times New Roman',serif;font-size:24px;letter-spacing:-0.01em;color:#3b3536;">Maison Rêve</span>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border:1px solid #eadcd6;border-radius:14px;padding:36px 36px 28px;">
              <h1 style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:27px;font-weight:500;line-height:1.25;color:#3b3536;">${escapeHtml(design.heading)}</h1>
              <div style="height:1px;background:#f3e1e1;margin:18px 0 22px;"></div>
              ${textToHtml(design.body)}
              ${cta}
              ${footnote}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 6px 0;">
              <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:#8a7e7a;">
                Maison Rêve · 418 Newbury Street, Floor 3 · Boston, MA 02115<br />
                studio@maisonreve.com · (617) 555-0148
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function renderEmailText(design: EmailDesign): string {
  const lines = [design.heading, '', ...paragraphs(design.body)]
  if (design.cta) lines.push('', `${design.cta.label}: ${design.cta.url}`)
  if (design.footnote) lines.push('', design.footnote)
  lines.push('', '—', 'Maison Rêve · 418 Newbury Street, Floor 3 · Boston, MA 02115', 'studio@maisonreve.com · (617) 555-0148')
  return lines.join('\n')
}
