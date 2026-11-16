/**
 * Minimização de dados e defesa contra prompt injection.
 */

/** Remove dados pessoais identificáveis antes de enviar a provedores externos (LGPD). */
export function redactPersonalData(text: string): string {
  return text
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF REMOVIDO]')
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[CNPJ REMOVIDO]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[E-MAIL REMOVIDO]')
    .replace(/(\(\d{2}\)\s?|\b\d{2}\s)?\b9?\d{4}-\d{4}\b/g, '[TELEFONE REMOVIDO]')
    .replace(/\b(RG|R\.G\.)\s*:?\s*[\d.-]{5,}\b/gi, '[RG REMOVIDO]')
    .replace(/\b(prontu[áa]rio|matr[íi]cula do interno|infopen)\s*:?\s*[\w./-]+/gi, '[IDENTIFICADOR DE CUSTODIADO REMOVIDO]')
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(todas\s+)?(as\s+)?(instru[çc][õo]es|regras)/i,
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /desconsidere\s+(as\s+)?(instru[çc][õo]es|regras)/i,
  /(voc[êe]\s+agora\s+[ée]|you\s+are\s+now|act\s+as|aja\s+como)/i,
  /(prompt\s+do\s+sistema|system\s+prompt|instru[çc][õo]es\s+(centrais|do\s+sistema))/i,
  /(aprove|aprovar|autorize|libere)\s+(o\s+)?(projeto|recurso|pagamento|despesa)/i,
  /(revele|mostre|liste)\s+.*(outros\s+usu[áa]rios|outros\s+projetos|senhas?|chaves?|tokens?)/i,
  /<\/?(dados|system|instru[çc][õo]es)[^>]*>/i,
]

export function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text))
}

/**
 * Prepara texto não confiável para inclusão no prompt: remove caracteres de
 * controle, neutraliza delimitadores e limita o tamanho.
 */
export function neutralize(text: string, max = 4000): string {
  return (
    text
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
      .replace(/<\s*\/?\s*(dados_do_projeto|mensagem_do_servidor|system|instrucoes)[^>]*>/gi, '[delimitador removido]')
      .slice(0, max)
  )
}

/** Números presentes em um texto (para verificar se a IA introduziu dados novos). */
export function extractNumbers(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/[.,]/g, '')).filter((n) => n.length > 0 && !/^0+$/.test(n))
}

export function introducesNewNumbers(output: string, sources: string): boolean {
  const known = new Set(extractNumbers(sources))
  return extractNumbers(output).some((n) => !known.has(n) && Number(n) > 10)
}
