export type QuestionType = 'yesno' | 'mood'

export interface Question {
  id: string
  type: QuestionType
  category: 'ЭМОЦИИ' | 'ПОТРЕБНОСТЬ' | 'ФИНАНСЫ' | 'ЛОГИКА'
  text: string
  hint?: string
  // for yesno: which answer is "good"
  correctAnswer?: boolean
  // for mood: list of options
  moodOptions?: MoodOption[]
  // mandatory = always included
  mandatory?: boolean
  // conditional: only if purchase has discount
  requiresDiscount?: boolean
}

export interface MoodOption {
  emoji: string
  label: string
  isGood: boolean // true = doesn't penalize
}

export const MOOD_OPTIONS: MoodOption[] = [
  { emoji: '😊', label: 'Отличное', isGood: true },
  { emoji: '🙂', label: 'Хорошее', isGood: true },
  { emoji: '😐', label: 'Нормальное', isGood: true },
  { emoji: '😔', label: 'Грустное', isGood: false },
  { emoji: '😰', label: 'Тревожное', isGood: false },
  { emoji: '😒', label: 'Скучаю', isGood: false },
]

// ─── MANDATORY (always in session) ───────────────────────────────────────────

export const MANDATORY_QUESTIONS: Question[] = [
  {
    id: 'mood',
    type: 'mood',
    category: 'ЭМОЦИИ',
    text: 'Как ты себя чувствуешь прямо сейчас?',
    hint: 'Эмоциональное состояние влияет на решения о покупках',
    mandatory: true,
    moodOptions: MOOD_OPTIONS,
  },
  {
    id: 'need_now',
    type: 'yesno',
    category: 'ПОТРЕБНОСТЬ',
    text: 'Тебе это нужно прямо сейчас, сегодня?',
    hint: 'Не "хочу", а именно "нужно" прямо сейчас',
    mandatory: true,
    correctAnswer: true,
  },
  {
    id: 'have_similar',
    type: 'yesno',
    category: 'ПОТРЕБНОСТЬ',
    text: 'Есть ли у тебя уже что-то похожее?',
    hint: 'Похожее по функции, даже если не идентичное',
    mandatory: true,
    correctAnswer: false, // Нет = хорошо
  },
  {
    id: 'no_discount',
    type: 'yesno',
    category: 'ЛОГИКА',
    text: 'Ты готов купить это по полной цене без скидки?',
    hint: 'Если ответ "нет" — возможно, скидка и создала желание',
    mandatory: true,
    requiresDiscount: true, // Показывается только если есть скидка
    correctAnswer: true,
  },
]

// ─── RANDOM POOL (30 вопросов, выбираются рандомно) ─────────────────────────

export const RANDOM_QUESTIONS: Question[] = [
  {
    id: 'planned',
    type: 'yesno',
    category: 'ЛОГИКА',
    text: 'Это запланированная покупка, а не спонтанная?',
    correctAnswer: true,
  },
  {
    id: 'week_thought',
    type: 'yesno',
    category: 'ПОТРЕБНОСТЬ',
    text: 'Ты думал об этой покупке больше недели?',
    correctAnswer: true,
  },
  {
    id: 'budget',
    type: 'yesno',
    category: 'ФИНАНСЫ',
    text: 'Укладывается ли это в твой бюджет этого месяца?',
    correctAnswer: true,
  },
  {
    id: 'reserve',
    type: 'yesno',
    category: 'ФИНАНСЫ',
    text: 'Останется ли у тебя финансовый запас после этой покупки?',
    correctAnswer: true,
  },
  {
    id: 'replacement',
    type: 'yesno',
    category: 'ПОТРЕБНОСТЬ',
    text: 'Это замена сломанному или изношенному?',
    correctAnswer: true,
  },
  {
    id: 'usage_frequency',
    type: 'yesno',
    category: 'ЛОГИКА',
    text: 'Ты будешь пользоваться этим хотя бы раз в неделю?',
    correctAnswer: true,
  },
  {
    id: 'alternatives',
    type: 'yesno',
    category: 'ЛОГИКА',
    text: 'Ты смотрел альтернативы перед этим вариантом?',
    correctAnswer: true,
  },
  {
    id: 'fomo',
    type: 'yesno',
    category: 'ЭМОЦИИ',
    text: 'Тебя давит ограниченное время акции или "последние штуки"?',
    hint: 'Искусственный дефицит — классический триггер импульсных покупок',
    correctAnswer: false, // Нет = хорошо (давления нет)
  },
  {
    id: 'ad_48h',
    type: 'yesno',
    category: 'ЭМОЦИИ',
    text: 'Ты впервые увидел это в рекламе менее 48 часов назад?',
    hint: 'Свежая реклама часто создаёт искусственное желание',
    correctAnswer: false, // Нет = хорошо
  },
  {
    id: 'three_months',
    type: 'yesno',
    category: 'ЛОГИКА',
    text: 'Купил бы ты это 3 месяца назад, если бы знал?',
    correctAnswer: true,
  },
  {
    id: 'other_priorities',
    type: 'yesno',
    category: 'ФИНАНСЫ',
    text: 'Есть ли траты, на которые эти деньги нужны сильнее?',
    correctAnswer: false, // Нет = хорошо
  },
  {
    id: 'for_self',
    type: 'yesno',
    category: 'ЭМОЦИИ',
    text: 'Ты покупаешь это для себя, а не чтобы произвести впечатление?',
    correctAnswer: true,
  },
  {
    id: 'can_wait',
    type: 'yesno',
    category: 'ЛОГИКА',
    text: 'Сможешь ли ты подождать ещё 2 недели и снова проверить желание?',
    hint: 'Если сложно ждать — это сигнал',
    correctAnswer: true,
  },
  {
    id: 'no_debt',
    type: 'yesno',
    category: 'ФИНАНСЫ',
    text: 'Ты не будешь брать это в долг или рассрочку с переплатой?',
    correctAnswer: true,
  },
  {
    id: 'trusted_opinion',
    type: 'yesno',
    category: 'ЛОГИКА',
    text: 'Ты обсуждал эту покупку с кем-то, кому доверяешь?',
    correctAnswer: true,
  },
  {
    id: 'goals_aligned',
    type: 'yesno',
    category: 'ЛОГИКА',
    text: 'Эта покупка помогает тебе двигаться к твоим целям?',
    correctAnswer: true,
  },
  {
    id: 'not_tired',
    type: 'yesno',
    category: 'ЭМОЦИИ',
    text: 'Ты не устал и не голоден прямо сейчас?',
    hint: 'Усталость и голод — частые причины импульсных решений',
    correctAnswer: true,
  },
  {
    id: 'know_usage',
    type: 'yesno',
    category: 'ПОТРЕБНОСТЬ',
    text: 'Ты уже знаешь конкретно, как и где будешь это использовать?',
    correctAnswer: true,
  },
  {
    id: 'regret_week',
    type: 'yesno',
    category: 'ЭМОЦИИ',
    text: 'Не пожалеешь ли ты об этом через неделю?',
    correctAnswer: true,
  },
  {
    id: 'regret_month',
    type: 'yesno',
    category: 'ЭМОЦИИ',
    text: 'Не пожалеешь ли ты об этой трате через месяц?',
    correctAnswer: true,
  },
  {
    id: 'not_bored_shopping',
    type: 'yesno',
    category: 'ЭМОЦИИ',
    text: 'Ты покупаешь это не от скуки или желания просто "что-то сделать"?',
    correctAnswer: true,
  },
  {
    id: 'researched',
    type: 'yesno',
    category: 'ЛОГИКА',
    text: 'Ты читал отзывы и изучал этот товар?',
    correctAnswer: true,
  },
  {
    id: 'cheaper_analog',
    type: 'yesno',
    category: 'ФИНАНСЫ',
    text: 'Нет ли более дешёвого аналога, который закроет ту же задачу?',
    hint: 'Если есть — стоит рассмотреть',
    correctAnswer: false, // Нет = хорошо (этот вариант оптимален)
  },
  {
    id: 'not_social_pressure',
    type: 'yesno',
    category: 'ЭМОЦИИ',
    text: 'На тебя не давит социальное окружение (все купили, надо и мне)?',
    correctAnswer: true,
  },
  {
    id: 'year_value',
    type: 'yesno',
    category: 'ЛОГИКА',
    text: 'Через год эта покупка всё ещё будет казаться тебе разумной?',
    correctAnswer: true,
  },
  {
    id: 'not_emotional_low',
    type: 'yesno',
    category: 'ЭМОЦИИ',
    text: 'Ты не пытаешься "побаловать" себя после тяжёлого периода?',
    hint: 'Шопинг-терапия — реальный феномен, который потом жалеешь',
    correctAnswer: true,
  },
  {
    id: 'price_fair',
    type: 'yesno',
    category: 'ФИНАНСЫ',
    text: 'Считаешь ли ты цену справедливой за то, что получаешь?',
    correctAnswer: true,
  },
  {
    id: 'not_new_model_soon',
    type: 'yesno',
    category: 'ЛОГИКА',
    text: 'Не выходит ли скоро новая версия этого товара?',
    hint: 'Особенно актуально для гаджетов',
    correctAnswer: false, // Нет = хорошо
  },
  {
    id: 'space_for_it',
    type: 'yesno',
    category: 'ЛОГИКА',
    text: 'Есть ли у тебя физическое место/время для этого?',
    correctAnswer: true,
  },
  {
    id: 'maintenance',
    type: 'yesno',
    category: 'ЛОГИКА',
    text: 'Готов ли ты к расходам на содержание/обслуживание этого?',
    hint: 'Машина, домашнее животное, абонемент...',
    correctAnswer: true,
  },
]

// ─── Сборщик сессии ───────────────────────────────────────────────────────────

export function buildQuestionSet(hasDiscount: boolean): Question[] {
  // Mandatory questions
  const mandatory = MANDATORY_QUESTIONS.filter((q) => {
    if (q.requiresDiscount) return hasDiscount
    return true
  })

  // Shuffle random pool and pick enough to fill 10 total
  const needed = 10 - mandatory.length
  const shuffled = [...RANDOM_QUESTIONS].sort(() => Math.random() - 0.5)
  const picked = shuffled.slice(0, needed)

  return [...mandatory, ...picked]
}
