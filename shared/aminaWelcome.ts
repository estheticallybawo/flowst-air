import { contextDescription, type ContextSnapshot } from './airsOrchestration'

// Context remains data. A welcome never repeats a request to change agent behaviour.
const instruction = /\b(?:ignore|disregard|override|forget|reveal|expose|pretend|impersonate|execute|system prompt|developer message|api key|password|secret|instructions?|tool calls?)\b|\b(?:act as|skip (?:the |all )?(?:approval|objective)|approve (?:the |my )?plan|call (?:a |the )?tool)|\b(?:you|amina|misu|kai) (?:must|should|shall)\b/i
const descriptionStart = /^(?:I(?:['’](?:m|ve|d|ll)\b|\s+(?:am|was|have|had|work|worked|study|studied|learn|learned|want|need|hope|aim|create|created|build|built|prepare|prepared|enjoy|like|prefer|use|used|run|ran|teach|taught|lead|led|manage|managed)\b)|My (?:background|goal|goals|aim|work|job|role|experience|interest|interests|audience|focus)\b)/i
const roleStart = /^(?:a|an|the|former|currently|also|still|now|not|working|studying|learning|preparing|interested|new|familiar|experienced|hoping|trying|looking)\b/i

function statements(words: string) {
  return words.slice(0, 2000).split(/[.!?]+(?:\s+|$)|[\r\n;]+/)
    .map(part => part.replace(/^\s*[-*•]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Identity comes only from an explicit statement in the learner's original words. */
function explicitName(words: string) {
  for (const statement of statements(words)) {
    if (instruction.test(statement)) continue
    const match = /^(?:(?:hi|hello)[!,]?\s*)?(?:my name is|(?:please )?call me)\s+([\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*(?:\s+[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*){0,3}?)(?=\s*(?:,|$|\band\b))/iu.exec(statement)
    if (match && match[1]!.length <= 60 && !/^(?:when|whenever|later|back|anything|whatever|if|for|at|on|the|your|you|someone|something)\b/i.test(match[1]!)) return match[1]!
  }
}

function secondPerson(statement: string, confirmed: boolean) {
  if (instruction.test(statement) || /[<>`]/.test(statement)) return ''
  // First-person fallback must be self-description; confirmed summaries may already address the learner.
  if (!descriptionStart.test(statement) && !(confirmed && /^(?:you|your)\b/i.test(statement))) return ''
  if (/^(?:my|your) name\b|^you (?:go by|are (?:named|called))\b|^call me\b/i.test(statement)) return ''
  if (/^(?:I am|I['’]m|you are|you['’]re)\s+/i.test(statement)) {
    const role = statement.replace(/^(?:I am|I['’]m|you are|you['’]re)\s+/i, '')
    // A model's “You are Mira” or a raw “I'm Mira” is not a verified name.
    if (!roleStart.test(role)) return ''
  }
  if (/^you (?:must|should|will|shall)\b|^I (?:want|need) you to\b/i.test(statement)) return ''
  // Protect quoted titles and examples; transform pronouns and verb agreements together.
  const converted = statement.split(/([“"][^”"]*[”"]|(?<![\p{L}\p{N}])'[^'\n]+')/u).map((part, index) => index % 2 ? part : part
    .replace(/\bI['’]m\b/gi, 'you’re').replace(/\bI am\b/gi, 'you are')
    .replace(/\bI was\b/gi, 'you were').replace(/\bI['’]ve\b/gi, 'you’ve')
    .replace(/\bI['’]d\b/gi, 'you’d').replace(/\bI['’]ll\b/gi, 'you’ll')
    .replace(/\bmyself\b/gi, 'yourself').replace(/\bmine\b/gi, 'yours')
    .replace(/\bmy\b/gi, 'your').replace(/\bme\b/gi, 'you').replace(/\bI\b/g, 'you'))
    .join('')
  return converted.charAt(0).toUpperCase() + converted.slice(1)
}

function legacyFacts(context: ContextSnapshot) {
  const facts: string[] = []
  for (const [field, words] of [['background', context.background], ['goals', context.goals], ['audience', context.audience]] as const) {
    for (const part of statements(words)) {
      const explicit = secondPerson(part, false)
      if (explicit) { facts.push(explicit); continue }
      if (instruction.test(part) || /[<>`]/.test(part) || part.length > 120) continue
      const lower = part.charAt(0).toLowerCase() + part.slice(1)
      // A field label supplies meaning for familiar role/goal fragments, without inventing missing details.
      if (field === 'background' && /^[\p{L}\p{M}\s'’\-]+$/u.test(part)
        && /\b(?:teacher|engineer|developer|designer|student|graduate|researcher|writer|creator|professional|manager|founder|entrepreneur|analyst|educator)\b$/i.test(part)) {
        const article = /^(?:a|an|the)\b/i.test(part) ? '' : /^[aeiou]/i.test(part) ? 'an ' : 'a '
        facts.push('You’re ' + article + lower)
      } else if (field === 'goals' && /^(?:prepare|explain|understand|practi[cs]e|learn|review|apply|improve|create|build|write|develop|explore|recall)\b/i.test(part)) {
        facts.push('Your goal is to ' + lower)
      } else if (field === 'goals' && /^interviews?$/i.test(part)) facts.push('Your goal is to prepare for interviews')
      else if (field === 'goals' && /^exams?$/i.test(part)) facts.push('Your goal is to prepare for exams')
      else if (field === 'audience' && /^(?:a|an|the|your)\b/i.test(part)) facts.push('Your audience is ' + lower)
    }
  }
  return facts
}

export function buildAminaContextBrief(context?: ContextSnapshot) {
  if (!context) return ''
  const words = contextDescription(context)
  const name = explicitName(words)
  const confirmed = context.summaryStatus === 'CONFIRMED' && Boolean(context.summary?.trim())
  const collect = (text: string, approved: boolean) => statements(text)
    .map(part => {
      // Keep an explicit self-description that follows a name in the same sentence.
      const prefix = /^(?:(?:hi|hello)[!,]?\s*)?(?:my name is|(?:please )?call me)\s+/i.exec(part)
      if (name && prefix && part.slice(prefix[0].length).startsWith(name))
        part = part.slice(prefix[0].length + name.length).replace(/^\s*(?:,\s*)?(?:and\s+)?/i, '')
      return secondPerson(part, approved)
    }).filter(part => part && part.length <= 220)
  let facts = confirmed ? collect(context.summary!, true) : []
  if (!facts.length) facts = context.selfDescription !== undefined ? collect(words, false) : legacyFacts(context)
  facts = [...new Set(facts)].slice(0, 2)
  // Complete sentences are selected, never clipped halfway through a fact.
  if (facts.length === 2 && facts.join(' ').length > 360) facts.pop()
  if (!name && !facts.length) return ''
  const first = facts.shift()
  const opening = name ? `your name is ${name}${first ? ', and ' + first.charAt(0).toLowerCase() + first.slice(1) : ''}`
    : first!.charAt(0).toLowerCase() + first!.slice(1)
  return `Here’s what I know about you: ${opening}.${facts.length ? ' ' + facts[0] + '.' : ''}`
}

export function buildAminaWelcome(context: ContextSnapshot | undefined, objectiveTitle: string) {
  const brief = buildAminaContextBrief(context)
  return `Hi, I’m Amina. ${brief ? brief + ' ' : ''}We’ll start with ${objectiveTitle}. I’ll help you practise the ideas using your approved plan. Let me know when you’re ready.`
}
