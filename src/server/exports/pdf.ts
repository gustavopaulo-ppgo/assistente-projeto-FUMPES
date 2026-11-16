import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Block, DocModel } from './model'

/** Fontes padrão do PDF usam WinAnsi: substitui caracteres não suportados. */
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')
const REPLACEMENTS: Record<string, string> = { '≠': '!=', '≤': '<=', '≥': '>=', '→': '->', '←': '<-', '✓': 'OK', '✔': 'OK', '✗': 'X', '\t': '    ' }
export function winAnsi(text: string): string {
  let out = ''
  for (const ch of text.normalize('NFC')) {
    const code = ch.codePointAt(0)!
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch)) out += ch
    else out += REPLACEMENTS[ch] ?? (code < 0x20 ? '' : '?')
  }
  return out
}

const A4 = { w: 595.28, h: 841.89 }
const M = { top: 70, bottom: 60, left: 56, right: 56 }
const CONTENT_W = A4.w - M.left - M.right
const PRIMARY = rgb(0.12, 0.23, 0.37)
const GRAY = rgb(0.4, 0.4, 0.4)

interface Fonts {
  regular: PDFFont
  bold: PDFFont
  italic: PDFFont
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = []
  for (const para of winAnsi(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (!words.length) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      // palavra maior que a largura: quebra por caracteres
      let w = word
      while (font.widthOfTextAtSize(w, size) > width) {
        let i = w.length
        while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i--
        lines.push(w.slice(0, i))
        w = w.slice(i)
      }
      line = w
    }
    lines.push(line)
  }
  return lines
}

async function embedLogo(pdf: PDFDocument, dataUrl: string | null) {
  if (!dataUrl) return null
  try {
    const [meta, b64] = dataUrl.split(',')
    const bytes = Uint8Array.from(Buffer.from(b64, 'base64'))
    return meta.includes('png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
  } catch {
    return null
  }
}

export async function renderPdf(model: DocModel): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(winAnsi(model.title))
  pdf.setProducer('Sistema Inteligente FUNPES')
  pdf.setCreator('Sistema Inteligente FUNPES')
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  }
  const logo = await embedLogo(pdf, model.logoDataUrl)

  // ---------------- capa
  const cover = pdf.addPage([A4.w, A4.h])
  let cy = A4.h - 110
  if (logo) {
    const s = logo.scaleToFit(140, 90)
    cover.drawImage(logo, { x: (A4.w - s.width) / 2, y: cy - s.height + 30, width: s.width, height: s.height })
    cy -= s.height + 10
  }
  const centered = (page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = rgb(0, 0, 0)) => {
    for (const [i, line] of wrap(text, font, size, CONTENT_W).entries()) {
      page.drawText(line, { x: (A4.w - font.widthOfTextAtSize(line, size)) / 2, y: y - i * size * 1.3, size, font, color })
    }
    return y - wrap(text, font, size, CONTENT_W).length * size * 1.3
  }
  for (const line of model.cover.lines.slice(0, 2)) cy = centered(cover, line, cy, fonts.bold, 12, PRIMARY) - 4
  cy = centered(cover, model.cover.title, A4.h / 2 + 90, fonts.bold, 22, PRIMARY) - 10
  if (model.cover.subtitle) cy = centered(cover, model.cover.subtitle, cy, fonts.regular, 12, GRAY) - 24
  centered(cover, model.cover.project, cy, fonts.bold, 16)
  let ly = 150
  for (const line of model.cover.lines.slice(2)) {
    centered(cover, line, ly, fonts.regular, 10, GRAY)
    ly -= 15
  }

  // ---------------- conteúdo
  let page: PDFPage = pdf.addPage([A4.w, A4.h])
  let y = A4.h - M.top
  let tocIndex: number | null = null
  const headings: { text: string; level: number; page: number }[] = []
  const newPage = () => {
    page = pdf.addPage([A4.w, A4.h])
    y = A4.h - M.top
  }
  const ensure = (h: number) => {
    if (y - h < M.bottom) newPage()
  }
  const drawLines = (lines: string[], font: PDFFont, size: number, x: number, lineH: number) => {
    for (const line of lines) {
      ensure(lineH)
      page.drawText(line, { x, y: y - size, size, font })
      y -= lineH
    }
  }

  const renderBlock = (block: Block) => {
    switch (block.type) {
      case 'toc':
        tocIndex = pdf.getPageCount() - 1
        return
      case 'pagebreak':
        if (y < A4.h - M.top) newPage()
        return
      case 'heading': {
        const size = block.level === 1 ? 14 : 11.5
        ensure(size * 3)
        y -= block.level === 1 ? 10 : 4
        headings.push({ text: block.text, level: block.level, page: pdf.getPageCount() - 1 })
        for (const line of wrap(block.text, fonts.bold, size, CONTENT_W)) {
          page.drawText(line, { x: M.left, y: y - size, size, font: fonts.bold, color: PRIMARY })
          y -= size * 1.4
        }
        if (block.level === 1) page.drawLine({ start: { x: M.left, y: y + 2 }, end: { x: A4.w - M.right, y: y + 2 }, thickness: 0.6, color: PRIMARY })
        y -= 6
        return
      }
      case 'paragraph': {
        const size = 10
        if (block.label) {
          ensure(size * 2.4)
          page.drawText(winAnsi(block.label), { x: M.left, y: y - size, size, font: fonts.bold })
          y -= size * 1.5
        }
        if (block.text) drawLines(wrap(block.text, block.italic ? fonts.italic : fonts.regular, size, CONTENT_W), block.italic ? fonts.italic : fonts.regular, size, M.left, size * 1.45)
        y -= 6
        return
      }
      case 'list': {
        const size = 10
        for (const item of block.items) {
          const lines = wrap(item, fonts.regular, size, CONTENT_W - 14)
          ensure(size * 1.45)
          page.drawText('•', { x: M.left + 2, y: y - size, size, font: fonts.regular })
          drawLines(lines, fonts.regular, size, M.left + 14, size * 1.45)
          y -= 2
        }
        y -= 4
        return
      }
      case 'table': {
        const size = 8
        const lineH = size * 1.3
        const pad = 3
        const totalW = (block.widths ?? block.headers.map(() => 1)).reduce((a, b) => a + b, 0)
        const widths = (block.widths ?? block.headers.map(() => 1)).map((w) => (w / totalW) * CONTENT_W)
        const drawRow = (cells: string[], header: boolean) => {
          const font = header ? fonts.bold : fonts.regular
          const wrapped = cells.map((c, i) => wrap(c ?? '', font, size, widths[i] - pad * 2))
          const h = Math.max(...wrapped.map((l) => l.length)) * lineH + pad * 2
          if (y - h < M.bottom) {
            newPage()
            if (!header) drawRow(block.headers, true)
          }
          let x = M.left
          for (const [i, lines] of wrapped.entries()) {
            page.drawRectangle({
              x,
              y: y - h,
              width: widths[i],
              height: h,
              borderColor: rgb(0.7, 0.7, 0.7),
              borderWidth: 0.5,
              color: header ? rgb(0.9, 0.92, 0.95) : undefined,
            })
            lines.forEach((line, li) => page.drawText(line, { x: x + pad, y: y - pad - size - li * lineH + 1, size, font }))
            x += widths[i]
          }
          y -= h
        }
        ensure(lineH * 4)
        drawRow(block.headers, true)
        for (const row of block.rows) drawRow(row, false)
        y -= 10
        return
      }
    }
  }
  for (const block of model.blocks) renderBlock(block)

  // ---------------- sumário (inserido após a capa)
  const offset = tocIndex !== null ? 1 : 0
  if (tocIndex !== null) {
    const toc = pdf.insertPage(tocIndex, [A4.w, A4.h])
    let ty = A4.h - M.top
    toc.drawText('Sumário', { x: M.left, y: ty - 16, size: 16, font: fonts.bold, color: PRIMARY })
    ty -= 40
    for (const h of headings) {
      if (ty < M.bottom) break
      const pageNo = String(h.page + offset + 1)
      const font = h.level === 1 ? fonts.bold : fonts.regular
      const indent = h.level === 1 ? 0 : 14
      const text = wrap(h.text, font, 10, CONTENT_W - 60)[0]
      toc.drawText(text, { x: M.left + indent, y: ty, size: 10, font })
      toc.drawText(pageNo, { x: A4.w - M.right - fonts.regular.widthOfTextAtSize(pageNo, 10), y: ty, size: 10, font: fonts.regular })
      ty -= h.level === 1 ? 17 : 14
    }
  }

  // ---------------- cabeçalho, rodapé, numeração e marca d'água
  const pages = pdf.getPages()
  const total = pages.length
  pages.forEach((p, i) => {
    if (model.cover.draft) {
      p.drawText('MINUTA', { x: 150, y: 300, size: 90, font: fonts.bold, color: rgb(0.85, 0.85, 0.85), rotate: degrees(40), opacity: 0.35 })
    }
    if (i === 0) return
    p.drawText(winAnsi(model.header).slice(0, 100), { x: M.left, y: A4.h - 40, size: 8, font: fonts.regular, color: GRAY })
    p.drawLine({ start: { x: M.left, y: A4.h - 46 }, end: { x: A4.w - M.right, y: A4.h - 46 }, thickness: 0.4, color: GRAY })
    p.drawText(winAnsi(model.footer).slice(0, 110), { x: M.left, y: 30, size: 7.5, font: fonts.regular, color: GRAY })
    const num = `Página ${i + 1} de ${total}`
    p.drawText(winAnsi(num), { x: A4.w - M.right - fonts.regular.widthOfTextAtSize(winAnsi(num), 8), y: 30, size: 8, font: fonts.regular, color: GRAY })
  })
  return pdf.save()
}
