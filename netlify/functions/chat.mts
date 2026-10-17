import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

type Msg = { role: 'user' | 'assistant'; content: string }

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const { system, message, history = [] } = await req.json()
    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'Missing message' }, { status: 400 })
    }

    // Normalize history: map roles, drop empties, ensure it starts with a user turn
    // and alternates roles (merge consecutive turns from the same role).
    const messages: Msg[] = []
    for (const m of Array.isArray(history) ? history : []) {
      const content = typeof m?.content === 'string' ? m.content.trim() : ''
      if (!content) continue
      const role: Msg['role'] = m.role === 'user' ? 'user' : 'assistant'
      if (messages.length === 0 && role !== 'user') continue
      const last = messages[messages.length - 1]
      if (last && last.role === role) last.content += '\n\n' + content
      else messages.push({ role, content })
    }
    const last = messages[messages.length - 1]
    if (last && last.role === 'user') last.content += '\n\n' + message
    else messages.push({ role: 'user', content: message })

    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      ...(system ? { system: String(system) } : {}),
      messages,
    })

    const reply = result.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()

    return Response.json({ reply })
  } catch (err) {
    console.error('Chat function error:', err)
    return Response.json({ error: 'Assistant service failed' }, { status: 500 })
  }
}

export const config = {
  path: '/api/chat',
}
