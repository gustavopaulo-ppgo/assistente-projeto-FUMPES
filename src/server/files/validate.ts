/**
 * Verificação de arquivos enviados: tamanho, extensão, assinatura binária
 * ("magic bytes") e conteúdo ativo. O tipo declarado pelo navegador NÃO é
 * considerado confiável.
 */

export interface AllowedType {
  ext: string
  mime: string
  label: string
}

export const ALLOWED_TYPES: AllowedType[] = [
  { ext: 'pdf', mime: 'application/pdf', label: 'PDF' },
  { ext: 'png', mime: 'image/png', label: 'Imagem PNG' },
  { ext: 'jpg', mime: 'image/jpeg', label: 'Imagem JPEG' },
  { ext: 'jpeg', mime: 'image/jpeg', label: 'Imagem JPEG' },
  { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word (DOCX)' },
  { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel (XLSX)' },
  { ext: 'csv', mime: 'text/csv', label: 'CSV' },
]

export const ACCEPT_ATTR = ALLOWED_TYPES.map((t) => `.${t.ext}`).join(',')

export type FileCheck =
  | { ok: true; ext: string; mime: string; safeName: string }
  | { ok: false; reason: string }

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b)

function latin1(bytes: Uint8Array, max = bytes.length): string {
  let s = ''
  const n = Math.min(bytes.length, max)
  for (let i = 0; i < n; i += 8192) s += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, n)))
  return s
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'arquivo'
  const cleaned = base
    .normalize('NFKC')
     
    .replace(/[\u0000-\u001F\u007F<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .trim()
  const trimmed = cleaned.length > 150 ? cleaned.slice(cleaned.length - 150) : cleaned
  return trimmed || 'arquivo'
}

/** Nome seguro para chave de armazenamento (ASCII). */
export function storageSafeName(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .slice(-100) || 'arquivo'
  )
}

export function validateUpload(name: string, bytes: Uint8Array, maxBytes: number): FileCheck {
  if (!bytes || bytes.length === 0) return { ok: false, reason: 'Arquivo vazio.' }
  if (bytes.length > maxBytes) {
    return { ok: false, reason: `Arquivo excede o limite de ${(maxBytes / 1024 / 1024).toFixed(0)} MB.` }
  }
  const safeName = sanitizeFileName(name)
  const parts = safeName.toLowerCase().split('.')
  if (parts.length < 2) return { ok: false, reason: 'Arquivo sem extensão.' }
  const ext = parts.pop()!
  // dupla extensão executável (ex.: relatorio.exe.pdf)
  if (parts.some((p) => ['exe', 'bat', 'cmd', 'js', 'vbs', 'ps1', 'sh', 'msi', 'scr', 'html', 'htm', 'svg'].includes(p))) {
    return { ok: false, reason: 'Nome de arquivo com extensão suspeita.' }
  }
  const type = ALLOWED_TYPES.find((t) => t.ext === ext)
  if (!type) {
    return { ok: false, reason: `Tipo não permitido. Aceitos: ${[...new Set(ALLOWED_TYPES.map((t) => t.label))].join(', ')}.` }
  }

  switch (type.mime) {
    case 'application/pdf': {
      if (!startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { ok: false, reason: 'Conteúdo não corresponde a um PDF válido.' }
      const body = latin1(bytes)
      if (/\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction\s*<<[^>]*\/JS)\b/.test(body)) {
        return { ok: false, reason: 'PDF com conteúdo ativo (JavaScript, ações automáticas ou arquivos embutidos) não é aceito.' }
      }
      break
    }
    case 'image/png':
      if (!startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ok: false, reason: 'Conteúdo não corresponde a uma imagem PNG.' }
      break
    case 'image/jpeg':
      if (!startsWith(bytes, [0xff, 0xd8, 0xff])) return { ok: false, reason: 'Conteúdo não corresponde a uma imagem JPEG.' }
      break
    case 'text/csv': {
      if (bytes.includes(0)) return { ok: false, reason: 'CSV contém dados binários.' }
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      } catch {
        return { ok: false, reason: 'CSV deve estar codificado em UTF-8.' }
      }
      break
    }
    default: {
      // DOCX / XLSX: pacote ZIP (OOXML)
      if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return { ok: false, reason: 'Conteúdo não corresponde a um documento Office (OOXML).' }
      const body = latin1(bytes)
      if (body.includes('vbaProject.bin')) return { ok: false, reason: 'Documentos com macros não são aceitos.' }
      const marker = ext === 'docx' ? 'word/' : 'xl/'
      if (!body.includes(marker)) return { ok: false, reason: 'Estrutura interna do documento Office inválida.' }
    }
  }
  return { ok: true, ext, mime: type.mime, safeName }
}
