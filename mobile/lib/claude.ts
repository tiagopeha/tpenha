import * as FileSystem from 'expo-file-system'
import type { ClaudeNutrition } from './types'

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages'

export async function analyzeMeal(
  description: string,
  imageUri: string | null,
  apiKey: string
): Promise<ClaudeNutrition> {
  if (!apiKey) throw new Error('Chave Anthropic não configurada. Vá em Perfil e adicione sua API key.')

  const model = imageUri ? 'claude-opus-4-7' : 'claude-sonnet-4-6'
  const systemPrompt =
    'Você é um nutricionista especializado. Analise a refeição e estime os valores nutricionais com precisão. Responda APENAS com JSON válido, sem texto extra.'

  let userContent: unknown

  if (imageUri) {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    })

    userContent = [
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
      },
      {
        type: 'text',
        text: `Estime os macros desta refeição.${
          description ? ` Descrição: ${description}.` : ''
        } Responda em JSON: {"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "notes": string}`,
      },
    ]
  } else {
    userContent = `Estime os macros desta refeição: ${description}. Responda em JSON: {"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "notes": string}`
  }

  const resp = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(
      `Claude API error ${resp.status}: ${(err as any)?.error?.message ?? 'Erro desconhecido'}`
    )
  }

  const data = await resp.json()
  const text = (data.content[0].text as string).trim()

  // Extract JSON even if Claude adds extra text
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude não retornou JSON válido')

  return JSON.parse(jsonMatch[0]) as ClaudeNutrition
}
