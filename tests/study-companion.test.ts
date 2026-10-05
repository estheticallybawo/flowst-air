import { afterAll, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { extractStudyDocument } from '../server/services/studyExtraction'
import { indexStudySections, createStudyConversation, deleteStudyConversation, getStudyConversation, getStudyChunks, getStudyPedagogyHistory, saveStudyPlan, updateStudyMode, appendStudyTurn, appendStudyVoiceUsage } from '../server/services/studyRepository'
import { retrieveStudyPassages } from '../server/services/studyRetrieval'
import { failAminaTurn, finishAminaTurn, nextPracticeState, prepareAminaTurn } from '../server/services/studyAmina'
import { compileAirStudyPacket, DEFAULT_STUDY_FUNCTION_REFS } from '../server/domain/neuromap/studyFunctions'
import { studyBedrockError, validateMisuObjectives, validateMisuStudyTitle } from '../server/services/studyMisu'
import { assertStudyVoiceAgentReady, signStudyVoiceToken, verifyStudyVoiceToken } from '../server/services/studyVoice'
import { studySpeechFailure } from '../server/services/studySpeech'
import type { StudyConversation } from '../shared/study'
import { STUDY_LIVE_START_MESSAGE } from '../shared/studyLive'
import { learnerStudyError } from '../shared/studyPresentation'

vi.stubGlobal('useRuntimeConfig', () => ({ flowstAuthMode: 'mock', elevenLabsStudyLlmSecret: 'test-study-secret-with-at-least-32-characters' }))
afterAll(() => vi.unstubAllGlobals())

describe('Amina document study', () => {
  it('replaces generic production errors with a recovery message', () => {
    expect(learnerStudyError({ data: { statusMessage: 'Server Error' } }, 'Please retry your upload.')).toBe('Please retry your upload.')
  })

  it('handles a missing PDF runtime without preventing other document extraction', async () => {
    vi.doMock('@napi-rs/canvas', () => { throw new Error('Missing native runtime') })
    vi.resetModules()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { extractStudyDocument: extract } = await import('../server/services/studyExtraction')
      await expect(extract('test.pdf', Buffer.from('%PDF-1.7'))).rejects.toMatchObject({ statusCode: 503, statusMessage: 'We couldn’t open your PDF right now. Please try again shortly.' })
      const zip = new JSZip()
      zip.file('ppt/slides/slide1.xml', '<a:p><a:t>This slide remains readable even when the PDF runtime is unavailable.</a:t></a:p>')
      expect((await extract('test.pptx', await zip.generateAsync({ type: 'nodebuffer' }))).sections[0]?.label).toBe('Slide 1')
    } finally {
      vi.doUnmock('@napi-rs/canvas')
      vi.resetModules()
      log.mockRestore()
    }
  })
  it('keeps provider details out of learner-facing planning errors', () => {
    for (const name of ['ExpiredTokenException', 'AccessDeniedException', 'ThrottlingException', 'OtherError']) {
      expect(studyBedrockError({ name })).not.toMatch(/amazon|aws|bedrock|model|role|region|iam/i)
    }
    expect(studyBedrockError({ name: 'ExpiredTokenException' })).toContain('Your work is safe')
  })

  it('preserves PDF page locations', async () => {
    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    for (const value of ['Photosynthesis uses light to convert water and carbon dioxide into glucose.', 'Chlorophyll absorbs light energy inside the chloroplast.']) {
      const page = pdf.addPage()
      page.drawText(value, { x: 40, y: 700, font, size: 12 })
    }
    const result = await extractStudyDocument('lesson.pdf', Buffer.from(await pdf.save()))
    expect(result.sections.map(section => section.label)).toEqual(['Page 1', 'Page 2'])
    expect(result.sections[1]?.text).toContain('Chlorophyll')
  })

  it('preserves DOCX headings', async () => {
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
    zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
    zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Energy conversion</w:t></w:r></w:p><w:p><w:r><w:t>Plants turn light into chemical energy through photosynthesis in their leaves.</w:t></w:r></w:p></w:body></w:document>')
    const result = await extractStudyDocument('notes.docx', await zip.generateAsync({ type: 'nodebuffer' }))
    expect(result.sections[0]?.label).toBe('Energy conversion · paragraph 1')
    expect(result.sections[0]?.text).toContain('photosynthesis')
  })

  it('preserves PPTX slide locations', async () => {
    const zip = new JSZip()
    zip.file('ppt/slides/slide1.xml', '<p:sld><a:p><a:r><a:t>Food webs show how organisms exchange energy in an ecosystem.</a:t></a:r></a:p></p:sld>')
    zip.file('ppt/slides/slide2.xml', '<p:sld><a:p><a:r><a:t>Producers make food from sunlight, while consumers eat other organisms.</a:t></a:r></a:p></p:sld>')
    const result = await extractStudyDocument('slides.pptx', await zip.generateAsync({ type: 'nodebuffer' }))
    expect(result.sections.map(section => section.label)).toEqual(['Slide 1', 'Slide 2'])
  })

  it('retrieves only source chunks from the owned conversation and deletes them', async () => {
    const extraction = { kind: 'PDF' as const, sections: [{ id: 'page-1', label: 'Page 1', text: 'Photosynthesis uses light energy to transform carbon dioxide and water into glucose and oxygen.' }], excerpt: 'Photosynthesis' }
    const created = await createStudyConversation('owner-a', 'biology.pdf', 'application/pdf', Buffer.from('fake'), extraction)
    const chunks = await getStudyChunks('owner-a', created.id)
    expect(indexStudySections(extraction)).toHaveLength(1)
    expect(retrieveStudyPassages(chunks, 'How does photosynthesis transform carbon dioxide and water?').sources[0]?.label).toBe('Page 1')
    await expect(getStudyConversation('owner-b', created.id)).rejects.toMatchObject({ statusCode: 404 })
    await deleteStudyConversation('owner-a', created.id)
    await expect(getStudyConversation('owner-a', created.id)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('distinguishes supported, partial, and unsupported document questions', () => {
    const chunks = indexStudySections({ kind: 'PDF', sections: [{ id: 'page-1', label: 'Page 1', text: 'Photosynthesis uses light energy to make glucose from carbon dioxide and water.' }], excerpt: '' })
    expect(retrieveStudyPassages(chunks, 'photosynthesis light energy').coverage).toBe('FULL')
    expect(retrieveStudyPassages(chunks, 'photosynthesis quantum banana').coverage).toBe('PARTIAL')
    expect(retrieveStudyPassages(chunks, 'orbital gravity').coverage).toBe('NONE')
  })

  it('waits for an attempt and preserves hints in scenario practice', () => {
    const conversation = { mode: 'SCENARIO', turns: [{ role: 'AMIRA', text: 'What would you do?', id: 'q', createdAt: '', mode: 'SCENARIO', sources: [] }], practice: { questionNumber: 0, totalQuestions: 5, awaitingAnswer: false, attempts: [] } } as unknown as StudyConversation
    const asked = nextPracticeState(conversation, 'Start a scenario', 'A case: what would you do?', [])
    expect(asked.awaitingAnswer).toBe(true)
    const active = { ...conversation, practice: asked }
    expect(nextPracticeState(active, 'Give me a hint', 'Consider the inputs.', []).attempts).toHaveLength(0)
    const finished = nextPracticeState(active, 'I would check the inputs first.', 'Strong start. Revisit the output.', [])
    expect(finished.attempts).toHaveLength(1)
    expect(finished.awaitingAnswer).toBe(false)
  })

  it('rejects invented Misu citations and persists an approved owner-only plan', async () => {
    const extraction = { kind: 'PDF' as const, sections: [{ id: 'page-1', label: 'Page 1', text: 'Photosynthesis converts light to chemical energy. Chlorophyll absorbs light. Glucose stores energy.' }], excerpt: 'Photosynthesis' }
    const created = await createStudyConversation('miro-owner', 'biology.pdf', 'application/pdf', Buffer.from('fake'), extraction)
    const chunks = await getStudyChunks('miro-owner', created.id)
    const candidate = { objectives: ['Describe photosynthesis', 'Explain chlorophyll', 'Trace glucose storage'].map(title => ({ title, outcome: `The learner can ${title.toLowerCase()}.`, sourceIds: [chunks[0]!.id] })) }
    expect(() => validateMisuObjectives({ objectives: [{ ...candidate.objectives[0], sourceIds: ['invented'] }, ...candidate.objectives.slice(1)] }, chunks)).toThrow()
    await expect(prepareAminaTurn('miro-owner', created.id, 'Start')).rejects.toMatchObject({ statusCode: 409 })
    const objectives = validateMisuObjectives(candidate, chunks)
    expect(validateMisuStudyTitle({ title: 'How Plants Turn Light Into Energy' }, objectives)).toBe('How Plants Turn Light Into Energy')
    expect(validateMisuStudyTitle({ title: 'biology.pdf' }, objectives)).toBe('Describe photosynthesis')
    expect(validateMisuStudyTitle({ title: '<script>alert(1)</script>' }, objectives)).toBe('Describe photosynthesis')
    expect(validateMisuStudyTitle({ title: 'Quantum Rocket Navigation' }, objectives)).toBe('Describe photosynthesis')
    const draft = await saveStudyPlan('miro-owner', created.id, { status: 'DRAFT', version: 1, objectives,
      functionRefs: DEFAULT_STUDY_FUNCTION_REFS.map(ref => ({ ...ref })) }, created.revision, undefined, 'How Plants Turn Light Into Energy')
    expect(draft.document).toMatchObject({ name: 'biology.pdf', title: 'How Plants Turn Light Into Energy' })
    expect((await getStudyConversation('miro-owner', created.id)).document.title).toBe('How Plants Turn Light Into Energy')
    await expect(saveStudyPlan('another-owner', created.id, draft.plan, draft.revision)).rejects.toMatchObject({ statusCode: 404 })
    const approved = await saveStudyPlan('miro-owner', created.id, { ...draft.plan, status: 'APPROVED', activeObjectiveId: objectives[0]!.id,
      approvedBy: 'miro-owner', approvedAt: new Date().toISOString() }, draft.revision)
    expect(approved.plan.objectives).toHaveLength(3)
    expect((await getStudyConversation('miro-owner', created.id)).plan.activeObjectiveId).toBe('objective-1')
    await expect(prepareAminaTurn('miro-owner', created.id, 'Photosynthesis captures light.')).rejects.toMatchObject({ statusCode: 409 })
    await appendStudyTurn('miro-owner', created.id, { id: 'welcome', role: 'AMIRA', kind: 'WELCOME', mode: 'DISCUSSION', text: 'Welcome. Let me know when you are ready.', sources: [], createdAt: '2026-09-23T00:00:00.000Z', objectiveId: 'objective-1' })
    await expect(prepareAminaTurn('miro-owner', created.id, 'Photosynthesis captures light.')).rejects.toMatchObject({ statusCode: 409 })
    const ready = await prepareAminaTurn('miro-owner', created.id, "I'm ready")
    expect(ready.retrieval.sources[0]?.label).toBe('Page 1')
    expect(ready.system).toContain('Give a brief, source-backed introduction')
    expect(ready.packet.functionRefs.map(ref => ref.id)).toEqual(['explicit-instruction'])
    expect(ready.system).toContain('explicit-instruction@1')
    await deleteStudyConversation('miro-owner', created.id)
  })

  it('starts live practice from a saved plan without fabricating a welcome or learner speech', async () => {
    const extraction = { kind: 'PDF' as const, sections: [{ id: 'page-1', label: 'Page 1', text: 'Chlorophyll absorbs light so plants make glucose.' }], excerpt: 'Chlorophyll' }
    const chat = await createStudyConversation('live-opening-owner', 'lesson.pdf', 'application/pdf', Buffer.from('fake'), extraction)
    const source = (await getStudyChunks('live-opening-owner', chat.id))[0]!
    await saveStudyPlan('live-opening-owner', chat.id, { status: 'APPROVED', version: 1,
      objectives: [{ id: 'objective-1', title: 'Light capture', outcome: 'Explain how light helps plants', sources: [{ id: source.id, label: source.label, excerpt: source.excerpt }] }],
      activeObjectiveId: 'objective-1', approvedBy: 'live-opening-owner', approvedAt: new Date().toISOString(),
      functionRefs: DEFAULT_STUDY_FUNCTION_REFS.map(ref => ({ ...ref })) }, chat.revision)
    const opening = await prepareAminaTurn('live-opening-owner', chat.id, STUDY_LIVE_START_MESSAGE, undefined, true)
    expect(opening.userTurn.kind).toBe('CONTROL')
    expect(opening.system).toContain('not something they said')
    expect(opening.system).not.toContain('Chlorophyll absorbs light')
    expect(opening.sourceContext).toContain('Chlorophyll absorbs light')
    expect(opening.system).toContain('Flowst conversation contract:')
    expect(opening.system).toContain('not a validated assessment')
    expect(opening.retrieval.sources[0]?.label).toBe('Page 1')
    await finishAminaTurn('live-opening-owner', chat.id, opening, 'Page 1 explains that chlorophyll captures light. How would you describe its role?', undefined, undefined, false)
    const saved = await getStudyConversation('live-opening-owner', chat.id)
    expect(saved.turns.map(turn => turn.kind)).toEqual(['CONTROL', 'INTRO'])
    expect(saved.practice.attempts).toHaveLength(0)
    const learnerAttempt = await prepareAminaTurn('live-opening-owner', chat.id, 'Plants use sunlight.', undefined, true)
    expect(learnerAttempt.userTurn.text).toBe('Plants use sunlight.')
    // A new live callback must rebuild the same coaching boundary from the approved plan,
    // even after the synthetic opening has become a saved exchange.
    expect(learnerAttempt.system).toContain('Flowst conversation contract:')
    expect(learnerAttempt.system).toContain('do not invent a mistake')
    expect(learnerAttempt.packet.functionRefs.map(ref => ref.id)).toContain('self-explanation-teach-back')
    await deleteStudyConversation('live-opening-owner', chat.id)
  })

  it('requires approved published functions and records a teach-back trace with real learner evidence', async () => {
    const extraction = { kind: 'PDF' as const, sections: [{ id: 'page-1', label: 'Page 1', text: 'Chlorophyll absorbs light so plants can convert carbon dioxide and water into glucose.' }], excerpt: 'Chlorophyll' }
    const chat = await createStudyConversation('trace-owner', 'lesson.pdf', 'application/pdf', Buffer.from('fake'), extraction)
    const source = (await getStudyChunks('trace-owner', chat.id))[0]!
    const objectives = ['Light capture', 'Inputs', 'Glucose'].map((title, index) => ({ id: `objective-${index + 1}`, title,
      outcome: `Explain ${title.toLowerCase()}`, sources: [{ id: source.id, label: source.label, excerpt: source.excerpt }] }))
    const draft = await saveStudyPlan('trace-owner', chat.id, { status: 'DRAFT', version: 1, objectives,
      functionRefs: DEFAULT_STUDY_FUNCTION_REFS.map(ref => ({ ...ref })) }, chat.revision)
    const approved = await saveStudyPlan('trace-owner', chat.id, { ...draft.plan, status: 'APPROVED',
      activeObjectiveId: objectives[0]!.id, approvedBy: 'trace-owner', approvedAt: new Date().toISOString() }, draft.revision)
    expect(compileAirStudyPacket(approved).stage).toBe('INTRODUCTION')
    await appendStudyTurn('trace-owner', chat.id, { id: 'welcome', role: 'AMIRA', kind: 'WELCOME', mode: 'DISCUSSION',
      text: 'Welcome. Let me know when you are ready.', sources: [], createdAt: new Date().toISOString(), objectiveId: 'objective-1' })
    const intro = await prepareAminaTurn('trace-owner', chat.id, "I'm ready")
    expect(intro.packet.functionRefs).toHaveLength(1)
    await finishAminaTurn('trace-owner', chat.id, intro, 'Page 1 explains how chlorophyll absorbs light. What do you think happens next?', undefined)
    const afterIntro = await getStudyPedagogyHistory('trace-owner', chat.id)
    expect(afterIntro.traces.map(trace => trace.status)).toEqual(['COMPILED', 'EXECUTED'])
    expect(afterIntro.evidence).toHaveLength(0)
    const teachBack = await prepareAminaTurn('trace-owner', chat.id, 'Chlorophyll captures light so the plant can make glucose.')
    expect(teachBack.packet.functionRefs.map(ref => ref.id)).toEqual(['explicit-instruction', 'self-explanation-teach-back'])
    expect(teachBack.packet.stage).toBe('GUIDED_PRACTICE')
    await finishAminaTurn('trace-owner', chat.id, teachBack, 'Good start. Page 1 also names carbon dioxide and water as inputs. Try explaining the whole process again.')
    const history = await getStudyPedagogyHistory('trace-owner', chat.id)
    const completed = history.traces.find(trace => trace.id === teachBack.trace.id && trace.status === 'EXECUTED')!
    expect(completed.functionRefs.map(ref => ref.version)).toEqual(['1', '1'])
    expect(completed.evidenceRefs).toHaveLength(1)
    expect(history.evidence).toMatchObject([{ traceId: teachBack.trace.id, learnerTurnId: teachBack.userTurn.id,
      sourceIds: [source.id] }])
    expect((await getStudyConversation('trace-owner', chat.id)).practice.attempts[0]?.evidenceId).toBe(completed.evidenceRefs[0])
    const interrupted = await prepareAminaTurn('trace-owner', chat.id, 'Can you repeat the last question?')
    await failAminaTurn('trace-owner', chat.id, interrupted, new Error('Synthetic model failure'))
    const afterFailure = await getStudyPedagogyHistory('trace-owner', chat.id)
    expect(afterFailure.traces.filter(trace => trace.id === interrupted.trace.id).map(trace => trace.status)).toEqual(['COMPILED', 'FAILED'])
    expect(afterFailure.evidence).toHaveLength(1)
    await expect(getStudyPedagogyHistory('other-owner', chat.id)).rejects.toMatchObject({ statusCode: 404 })
    await deleteStudyConversation('trace-owner', chat.id)
    await expect(getStudyPedagogyHistory('trace-owner', chat.id)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejects a legacy plan or an unapproved function substitution', async () => {
    const extraction = { kind: 'PDF' as const, sections: [{ id: 'page-1', label: 'Page 1', text: 'Plants turn sunlight into chemical energy.' }], excerpt: 'Plants' }
    const chat = await createStudyConversation('registry-owner', 'lesson.pdf', 'application/pdf', Buffer.from('fake'), extraction)
    const source = (await getStudyChunks('registry-owner', chat.id))[0]!
    const objectives = [{ id: 'objective-1', title: 'Energy', outcome: 'Explain energy conversion',
      sources: [{ id: source.id, label: source.label, excerpt: source.excerpt }] }]
    const legacy = await saveStudyPlan('registry-owner', chat.id, { status: 'APPROVED', version: 1, objectives,
      activeObjectiveId: 'objective-1' }, chat.revision)
    expect(() => compileAirStudyPacket(legacy)).toThrow(/predates NeuroMap/)
    const altered = { ...legacy, plan: { ...legacy.plan, approvedBy: 'registry-owner', approvedAt: new Date().toISOString(),
      functionRefs: [{ id: 'invented-framework', version: '1', kind: 'framework' as const }, DEFAULT_STUDY_FUNCTION_REFS[1]!] } }
    expect(() => compileAirStudyPacket(altered)).toThrow(/unpublished or incompatible/)
    await deleteStudyConversation('registry-owner', chat.id)
  })

  it('keeps spoken discussion feedback and distinguishes API key IDs from secrets', async () => {
    const conversation = { mode: 'DISCUSSION', plan: { activeObjectiveId: 'objective-1' }, turns: [{ role: 'AMIRA', text: 'How would you explain light capture?' }], practice: { questionNumber: 0, totalQuestions: 5, awaitingAnswer: false, attempts: [] } } as unknown as StudyConversation
    const practice = nextPracticeState(conversation, 'Plants use chlorophyll to capture light.', 'Good start. Add how this becomes chemical energy.', [])
    expect(practice.attempts).toMatchObject([{ objectiveId: 'objective-1', answer: 'Plants use chlorophyll to capture light.' }])
    expect(nextPracticeState(conversation, 'Can you explain chlorophyll?', 'Of course.', []).attempts).toHaveLength(0)
    const failure = new Response(JSON.stringify({ detail: { code: 'invalid_api_key', message: 'API key ID used as API key' } }), { status: 400 })
    expect(await studySpeechFailure(failure, 'playback')).toContain('API key ID')
  })

  it('records AWS voice usage beyond former quotas and deletes it with the chat', async () => {
    const extraction = { kind: 'PDF' as const, sections: [{ id: 'page-1', label: 'Page 1', text: 'Light becomes chemical energy.' }], excerpt: 'Light' }
    const chat = await createStudyConversation('voice-owner', 'lesson.pdf', 'application/pdf', Buffer.from('fake'), extraction)
    await appendStudyVoiceUsage('voice-owner', chat.id, { kind: 'TRANSCRIBE', units: 60, estimatedUsd: 0.03 })
    await appendStudyVoiceUsage('voice-owner', chat.id, { kind: 'POLLY', units: 1000, estimatedUsd: 0.016 })
    const current = await getStudyConversation('voice-owner', chat.id)
    expect(current.voiceUsage).toEqual({ transcribeSeconds: 60, pollyCharacters: 1000, estimatedUsd: 0.046 })
    await appendStudyVoiceUsage('voice-owner', chat.id, {kind:'TRANSCRIBE',units:241})
    await appendStudyVoiceUsage('voice-owner', chat.id, {kind:'POLLY',units:5001})
    expect((await getStudyConversation('voice-owner',chat.id)).voiceUsage).toMatchObject({transcribeSeconds:301,pollyCharacters:6001})
    await deleteStudyConversation('voice-owner', chat.id)
    await expect(getStudyConversation('voice-owner', chat.id)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('keeps feedback records when the learner changes practice mode', async () => {
    const extraction = { kind: 'PDF' as const, sections: [{ id: 'page-1', label: 'Page 1', text: 'Photosynthesis uses light energy to transform carbon dioxide and water into glucose and oxygen.' }], excerpt: 'Photosynthesis' }
    const created = await createStudyConversation('mode-owner', 'biology.pdf', 'application/pdf', Buffer.from('fake'), extraction)
    const attempts = [{ question: 'What happens?', answer: 'Light is captured.', feedback: 'Good start.', sources: [] }]
    await updateStudyMode('mode-owner', created.id, 'SCENARIO', { questionNumber: 0, totalQuestions: 5, awaitingAnswer: false, attempts })
    const current = await getStudyConversation('mode-owner', created.id)
    await updateStudyMode('mode-owner', created.id, 'ORAL_EXAM', { questionNumber: 0, totalQuestions: 5, awaitingAnswer: false, attempts: current.practice.attempts })
    expect((await getStudyConversation('mode-owner', created.id)).practice.attempts).toEqual(attempts)
    await deleteStudyConversation('mode-owner', created.id)
  })

  it('uses an opaque, tamper-checked voice token tied to a plan version', () => {
    const token = signStudyVoiceToken('owner-a', 'conversation-a', 2, 'lease-a')
    expect(token).not.toContain('owner-a')
    expect(verifyStudyVoiceToken(token)).toMatchObject({ ownerId: 'owner-a', conversationId: 'conversation-a', planVersion: 2 })
    expect(() => verifyStudyVoiceToken(`${token.slice(0, -2)}xx`)).toThrow()
  })

  it('refuses voice unless the ElevenLabs agent is private with zero-day retention and no audio saving', () => {
    const ready = { platform_settings: { auth: { enable_auth: true }, privacy: { record_voice: false, retention_days: 0 } } }
    expect(() => assertStudyVoiceAgentReady(ready)).not.toThrow()
    expect(() => assertStudyVoiceAgentReady({ ...ready, platform_settings: { ...ready.platform_settings, privacy: { record_voice: true, retention_days: 0 } } })).toThrow()
    expect(() => assertStudyVoiceAgentReady({ ...ready, platform_settings: { ...ready.platform_settings, privacy: { record_voice: false, retention_days: 30 } } })).toThrow()
    expect(() => assertStudyVoiceAgentReady({ ...ready, platform_settings: { ...ready.platform_settings, auth: { enable_auth: false } } })).toThrow()
  })
})
