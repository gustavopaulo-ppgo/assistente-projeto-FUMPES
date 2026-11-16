import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { Block, DocModel } from './model'

 
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

function blockToDocx(block: Block): (Paragraph | Table | TableOfContents)[] {
  switch (block.type) {
    case 'toc':
      return [
        new Paragraph({ text: 'Sumário', heading: HeadingLevel.TITLE }),
        new TableOfContents('Sumário', { hyperlink: true, headingStyleRange: '1-2' }),
        new Paragraph({ children: [new TextRun({ text: '(Atualize o sumário no editor: clique com o botão direito > Atualizar campo.)', italics: true, size: 16 })] }),
      ]
    case 'pagebreak':
      return [new Paragraph({ children: [new PageBreak()] })]
    case 'heading':
      return [new Paragraph({ text: clean(block.text), heading: block.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } })]
    case 'paragraph': {
      const out: Paragraph[] = []
      if (block.label) out.push(new Paragraph({ children: [new TextRun({ text: clean(block.label), bold: true })], spacing: { before: 120 } }))
      if (block.text) {
        for (const para of clean(block.text).split('\n')) {
          out.push(new Paragraph({ children: [new TextRun({ text: para, italics: block.italic })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 100 } }))
        }
      }
      return out
    }
    case 'list':
      return block.items.map((item) => new Paragraph({ text: clean(item), bullet: { level: 0 } }))
    case 'table': {
      const total = (block.widths ?? block.headers.map(() => 1)).reduce((a, b) => a + b, 0)
      const pct = (block.widths ?? block.headers.map(() => 1)).map((w) => Math.round((w / total) * 100))
      const border = { style: BorderStyle.SINGLE, size: 4, color: 'B0B0B0' }
      const cell = (text: string, i: number, header: boolean) =>
        new TableCell({
          width: { size: pct[i], type: WidthType.PERCENTAGE },
          shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: 'E6EBF2' } : undefined,
          borders: { top: border, bottom: border, left: border, right: border },
          children: [new Paragraph({ children: [new TextRun({ text: clean(text ?? ''), bold: header, size: 17 })] })],
        })
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: block.headers.map((h, i) => cell(h, i, true)) }),
            ...block.rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i, false)) })),
          ],
        }),
        new Paragraph({ text: '' }),
      ]
    }
  }
}

export async function renderDocx(model: DocModel): Promise<Uint8Array> {
  const coverChildren: Paragraph[] = []
  if (model.logoDataUrl) {
    const [meta, b64] = model.logoDataUrl.split(',')
    coverChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: meta.includes('png') ? 'png' : 'jpg', data: Buffer.from(b64, 'base64'), transformation: { width: 120, height: 80 } })],
      }),
    )
  }
  for (const line of model.cover.lines.slice(0, 2)) {
    coverChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: clean(line), bold: true, size: 24, color: '1F3A5F' })] }))
  }
  coverChildren.push(
    new Paragraph({ text: '', spacing: { before: 2400 } }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: clean(model.cover.title), bold: true, size: 40, color: '1F3A5F' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: clean(model.cover.subtitle), size: 24, color: '666666' })], spacing: { after: 400 } }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: clean(model.cover.project), bold: true, size: 30 })] }),
    ...(model.cover.draft
      ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: 'MINUTA — documento sujeito a revisão', bold: true, color: 'B00020', size: 24 })] })]
      : []),
    new Paragraph({ text: '', spacing: { before: 2400 } }),
    ...model.cover.lines.slice(2).map((l) => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: clean(l), size: 20, color: '666666' })] })),
    new Paragraph({ children: [new PageBreak()] }),
  )

  const doc = new Document({
    creator: 'Sistema Inteligente FUNPES',
    title: clean(model.title),
    features: { updateFields: true },
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [
      {
        headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: clean(model.header), size: 16, color: '666666' })] })] }) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${clean(model.footer)} — Página `, size: 16, color: '666666' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '666666' }),
                ],
              }),
            ],
          }),
        },
        children: [...coverChildren, ...model.blocks.flatMap(blockToDocx)],
      },
    ],
  })
  return new Uint8Array(await Packer.toBuffer(doc))
}
