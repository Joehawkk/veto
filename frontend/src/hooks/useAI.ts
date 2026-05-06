import { useCallback } from 'react'
import { type Verdict } from '../lib/scoring'
import { type Profile, type CheckAnswers, type HistoryEntry } from '../lib/storage'

const API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY as string

const MODELS = [
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-120b:free',
  'openai/gpt-oss-20b:free',
]

export interface AIResult {
  verdict: Verdict
  tip: string
}

// ── Time context ────────────────────────────────────────────────────────────

function getTimeContext(): string {
  const now = new Date()
  const h = now.getHours()
  const min = String(now.getMinutes()).padStart(2, '0')
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
  const day = days[now.getDay()]
  const isWeekend = now.getDay() === 0 || now.getDay() === 6

  type Period = { label: string; risk: string }
  const period: Period =
    h >= 0 && h < 5   ? { label: 'глубокая ночь (0–5)', risk: '🔴 КРИТИЧЕСКИЙ РИСК: покупки после полуночи — почти всегда эмоциональные, утром часто жалеют. Используй это в вердикте.' }
    : h >= 5 && h < 9  ? { label: 'раннее утро (5–9)',   risk: '🟡 Раннее утро — мозг ещё не проснулся, решения могут быть несвежими.' }
    : h >= 9 && h < 13 ? { label: 'утро (9–13)',          risk: '🟢 Утреннее время — наиболее взвешенные решения, голова свежая.' }
    : h >= 13 && h < 17? { label: 'день (13–17)',          risk: '🟢 Дневное время — нейтральное, хорошо для обдуманных покупок.' }
    : h >= 17 && h < 21? { label: 'вечер (17–21)',         risk: '🟡 Вечер после учёбы/работы — усталость может усиливать импульсивность.' }
    :                    { label: 'поздний вечер (21–0)',  risk: '🔴 ВЫСОКИЙ РИСК: поздно + усталость = классический триггер импульсных трат. Укажи на это мягко.' }

  return `🕐 ВРЕМЯ ПРОВЕРКИ: ${h}:${min}, ${day}${isWeekend ? ' (выходной)' : ' (рабочий день)'}
Период: ${period.label}
${period.risk}`
}

// ── Localization helpers ────────────────────────────────────────────────────

const MOOD_RU: Record<string, string> = {
  good: 'хорошее', neutral: 'нейтральное', sad: 'грустное',
  angry: 'злое', stressed: 'стрессовое', tired: 'усталое',
}

const DURATION_RU: Record<string, string> = {
  '30min': '30 минут', '1hour': '1 час', '24hours': '24 часа', '3days': '3+ дня',
}

// ── Prompt builder ──────────────────────────────────────────────────────────

function buildPrompt(params: {
  name: string
  price: number
  hasDiscount: boolean
  answers: CheckAnswers
  localVerdict: Verdict
  profile: Profile | null
  recentHistory: HistoryEntry[]
}): string {
  const { name, price, hasDiscount, answers, localVerdict, profile, recentHistory } = params

  const timeCtx = getTimeContext()

  const profileBlock = profile ? `📋 ПРОФИЛЬ:
- Цель: ${profile.goal}
- Спонтанные траты: ${profile.monthlySpend.toLocaleString('ru')} ₽/мес
${profile.spendingTrigger ? `- Триггер трат: ${profile.spendingTrigger}` : ''}
${profile.interests?.length ? `- Интересы: ${profile.interests.join(', ')}` : ''}
${profile.savingsTarget ? `- Цель накоплений: ${profile.savingsTarget.toLocaleString('ru')} ₽` : ''}` : ''

  const savedTotal = recentHistory.filter(h => h.outcome === 'stopped').reduce((s, h) => s + h.price, 0)

  const historyBlock = recentHistory.length > 0 ? `📊 ИСТОРИЯ (последние ${recentHistory.length}):
${recentHistory.map((h, i) => {
  const out = h.outcome === 'stopped' ? 'отказался' : h.outcome === 'bought' ? 'купил' : 'думает'
  return `${i + 1}. "${h.name}" ${h.price.toLocaleString('ru')} ₽ → вердикт: ${h.aiVerdict}, итог: ${out}`
}).join('\n')}
${savedTotal > 0 ? `💰 Всего сохранено: ${savedTotal.toLocaleString('ru')} ₽` : ''}` : ''

  return `Ты — Veto, умный помощник по осознанным покупкам для студентов. Отвечай строго на русском.

${timeCtx}

${profileBlock}

${historyBlock}

🛒 ТЕКУЩАЯ ПОКУПКА:
- Товар: ${name}
- Цена: ${price.toLocaleString('ru')} ₽${hasDiscount ? ' (со скидкой — важно: скидка не повод покупать)' : ''}

📝 ОТВЕТЫ:
1. Нужно прямо сейчас? → ${answers.needNow ? 'Да' : 'Нет'}
2. Есть похожее? → ${answers.hasSimilar ? 'Да' : 'Нет'}
3. Как долго думал? → ${DURATION_RU[answers.thoughtDuration]}
4. Настроение → ${MOOD_RU[answers.mood]}

Системный скор: ${localVerdict}

ЗАДАЧА: вынести финальный вердикт + короткий совет (2-3 предложения).
Учти ВСЁ: время суток, настроение, историю, профиль.
- Ночь/поздний вечер + стресс/усталость → почти всегда "veto" или "wait"
- Покупка через 30 мин после первого желания → подозрительно
- Отрицательное настроение → указывай на эмоциональный триггер мягко
- Если часто отказывается — похвали
Будь как умный друг: честно, коротко, без морализаторства.

Ответь ТОЛЬКО валидным JSON (без markdown, без пояснений):
{"verdict":"go","tip":"твой совет здесь"}

verdict: "go"=купи, "wait"=подожди, "veto"=не покупай`
}

// ── Parser ──────────────────────────────────────────────────────────────────

function parseAIResponse(text: string, fallback: Verdict): AIResult {
  const m = text.match(/\{[\s\S]*?"verdict"[\s\S]*?"tip"[\s\S]*?\}/)
  if (m) {
    try {
      const p = JSON.parse(m[0])
      const verdict = (['go', 'wait', 'veto'] as Verdict[]).includes(p.verdict)
        ? (p.verdict as Verdict) : fallback
      const tip = typeof p.tip === 'string' && p.tip.trim() ? p.tip.trim() : text
      return { verdict, tip }
    } catch { /* fall */ }
  }
  return { verdict: fallback, tip: text.trim() }
}

// ── HTTP ────────────────────────────────────────────────────────────────────

async function tryModel(model: string, prompt: string): Promise<string | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Veto',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 350,
        temperature: 0.6,
      }),
    })
    if (!res.ok) { console.warn(`[AI] ${model} → ${res.status}`); return null }
    const data = await res.json()
    const text: string = data.choices?.[0]?.message?.content?.trim() ?? ''
    if (!text) return null
    console.log(`[AI] ${model} → OK`)
    return text
  } catch (e) {
    console.warn(`[AI] ${model} → error:`, e); return null
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAI() {
  const getAIResult = useCallback(
    async (params: {
      name: string
      price: number
      hasDiscount: boolean
      answers: CheckAnswers
      localVerdict: Verdict
      profile: Profile | null
      recentHistory: HistoryEntry[]
    }): Promise<AIResult> => {
      const fallback: AIResult = {
        verdict: params.localVerdict,
        tip: 'AI временно перегружен. Вердикт рассчитан на основе твоих ответов.',
      }
      if (!API_KEY) return fallback

      const prompt = buildPrompt(params)
      for (const model of MODELS) {
        const raw = await tryModel(model, prompt)
        if (raw) return parseAIResponse(raw, params.localVerdict)
      }
      return fallback
    },
    [],
  )

  return { getAIResult }
}
