import { AiProviderError, type AiProvider, type AssistantRequest } from '../types'
import { wrapUntrusted } from '../prompts'

/**
 * Provedores externos via REST (sem SDKs proprietários), para manter a
 * camada desacoplada. Somente dados minimizados/anonimizados são enviados.
 */

async function postJson(url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal) {
  let res: Response
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal })
  } catch (e) {
    throw new AiProviderError(signal.aborted ? 'Tempo limite excedido ao consultar o provedor de IA.' : `Falha de rede ao consultar o provedor de IA (${(e as Error).name}).`)
  }
  if (!res.ok) throw new AiProviderError(`Provedor de IA retornou erro HTTP ${res.status}.`)
  return res.json() as Promise<unknown>
}

export function geminiProvider(apiKey: string, model = 'gemini-2.5-flash'): AiProvider {
  return {
    name: 'gemini',
    model,
    external: true,
    async generate(req: AssistantRequest, signal: AbortSignal) {
      const data = (await postJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { 'x-goog-api-key': apiKey },
        {
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: 'user', parts: [{ text: wrapUntrusted(req.context, req.userMessage) }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 4096 },
        },
        signal,
      )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
      if (!text) throw new AiProviderError('Resposta vazia do provedor de IA.')
      return text
    },
  }
}

export function openAiProvider(apiKey: string, model = 'gpt-4o-mini'): AiProvider {
  return {
    name: 'openai',
    model,
    external: true,
    async generate(req: AssistantRequest, signal: AbortSignal) {
      const data = (await postJson(
        'https://api.openai.com/v1/chat/completions',
        { Authorization: `Bearer ${apiKey}` },
        {
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: wrapUntrusted(req.context, req.userMessage) },
          ],
        },
        signal,
      )) as { choices?: { message?: { content?: string } }[] }
      const text = data.choices?.[0]?.message?.content
      if (!text) throw new AiProviderError('Resposta vazia do provedor de IA.')
      return text
    },
  }
}
