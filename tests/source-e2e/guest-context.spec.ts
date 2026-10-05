import { expect, test } from "@playwright/test";

async function expectPrimaryInWorkspace(page: any, name: string) {
  const box = await page
    .getByRole("button", { name, exact: true })
    .boundingBox();
  const nav = (await page.locator(".flowst-bottom-nav").count())
    ? await page.locator(".flowst-bottom-nav").boundingBox()
    : null;
  const viewport = await page.evaluate(() => ({
    height: innerHeight,
    scroll: scrollY,
    documentHeight: document.documentElement.scrollHeight,
  }));
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(nav?.y ?? viewport.height);
  expect(viewport.scroll).toBe(0);
  expect(viewport.documentHeight).toBeLessThanOrEqual(viewport.height + 1);
}

test("Misu guides setup and prepares Amina without starting a microphone or voice lease", async ({
  page,
}) => {
  test.setTimeout(300000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  let voiceStarts = 0,
    welcomeReads = 0;
  await page.addInitScript(() => {
    (window as any).__micRequests = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        (window as any).__micRequests++;
        throw new DOMException("Test permission denial", "NotAllowedError");
      },
    });
  });
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/live\/start/.test(request.url()))
      voiceStarts++;
  });
  await page.route("**/api/study/conversations/*/live", (route) =>
    route.fulfill({
      json: {
        enabled: true,
        socketUrl: "",
        provider: "elevenlabs",
        message: "",
      },
    }),
  );
  await page.route("**/api/study/conversations/*/speech", (route) =>
    route.fulfill({
      status: 503,
      json: { statusMessage: "Fixture welcome playback unavailable" },
    }),
  );
  await page.route("**/api/study/conversations/*/welcome", async (route) => {
    welcomeReads++;
    const response = await route.fetch();
    await new Promise((done) => setTimeout(done, 500));
    await route.fulfill({ response });
  });
  await page.goto("/airs/new", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("region", { name: "Your learning context" }),
  ).toBeVisible({ timeout: 90000 });
  expect(await page.locator("iframe").count()).toBe(0);
  await expect(page.getByLabel("Public source link")).toHaveCount(0);
  await expect(
    page
      .getByRole("button", { name: "Save context", exact: true })
      .or(page.getByRole("button", { name: "Continue", exact: true })),
  ).toBeVisible({ timeout: 90000 });
  if (
    await page
      .getByRole("button", { name: "Edit my context", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Edit my context", exact: true })
      .click();
  await page
    .getByLabel("Share context about yourself", { exact: true })
    .fill(
      "Early-career developer and content creator. I want to explain my projects in interviews.",
    );
  await expectPrimaryInWorkspace(page, "Save context");
  await page.screenshot({
    path: "test-results/airs-context-" + test.info().project.name + ".png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save context", exact: true }).click();
  await expect(
    page.getByLabel("My understanding — you can edit it"),
  ).toBeVisible();
  await page
    .getByLabel("My understanding — you can edit it")
    .fill("I want to explain my projects clearly in interviews.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Link or transcript", { exact: true }).check();
  await page.getByRole("button", { name: "Try video fixture" }).click();
  await expect(
    page.getByText("Demonstration speech transcript", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review included text", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Included source text" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expectPrimaryInWorkspace(page, "Use this source");
  await expect(
    page.getByLabel("Practice time per topic", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Use this source", exact: true })
    .click();
  await page.getByLabel("What is this session for?").selectOption("INTERVIEW");
  await expectPrimaryInWorkspace(page, "Draft my plan");
  await page.screenshot({
    path: "test-results/airs-preferences-" + test.info().project.name + ".png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Draft my plan", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Misu learning planner" }),
  ).toBeVisible({ timeout: 90000 });
  await expect(page).toHaveURL(/\/airs\/[a-f0-9-]+$/);
  await page.getByText("What this plan is based on", { exact: true }).click();
  await expect(
    page.getByText("I want to explain my projects clearly in interviews.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Adjust plan", exact: true }).click();
  await page
    .getByLabel("What would you like me to change?")
    .fill("Focus on explaining the source in an interview.");
  await page
    .getByRole("button", { name: "Draft adjusted plan", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Approve plan", exact: true }),
  ).toBeEnabled();
  await expectPrimaryInWorkspace(page, "Approve plan");
  await page.getByRole("button", { name: "Approve plan", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Preparing your conversation" }),
  ).toBeVisible();
  await expect(
    page.getByText("Misu is reviewing your plan", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue now", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start conversation", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Misu is arranging your practice", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Misu is introducing Kai’s role", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Amina is getting ready", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__micRequests)).toBe(0);
  await page.screenshot({
    path: "test-results/airs-handoff-" + test.info().project.name + ".png",
    fullPage: true,
  });
  await expect(
    page.getByText("Your welcome is ready. Microphone off.", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole("button", { name: "Start conversation", exact: true }),
  ).toBeVisible();
  await expectPrimaryInWorkspace(page, "Start conversation");
  await expect(
    page.getByText("Fixture welcome playback unavailable", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry welcome voice", exact: true }),
  ).toBeVisible();
  expect(voiceStarts).toBe(0);
  expect(await page.evaluate(() => (window as any).__micRequests)).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/airs-prepared-" + test.info().project.name + ".png",
    fullPage: true,
  });
  const wav = Buffer.alloc(44 + 16000 * 2);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24);
  wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  await page.unroute("**/api/study/conversations/*/speech");
  let recoveryRequests = 0;
  await page.route("**/api/study/conversations/*/speech", (route) => {
    const input = route.request().postDataJSON();
    expect(input.retry).toBe(true);
    recoveryRequests++;
    return route.fulfill({
      json: {
        audioBase64: wav.toString("base64"),
        mimeType: "audio/wav",
        spokenText: "Fixture welcome recovery.",
        alignment: null,
      },
    });
  });
  await page
    .getByRole("button", { name: "Retry welcome voice", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Replay welcome", exact: true }),
  ).toBeVisible();
  expect(recoveryRequests).toBe(1);
  expect(await page.evaluate(() => (window as any).__micRequests)).toBe(0);
  const currentWelcomeReads = welcomeReads;
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Start conversation", exact: true }),
  ).toBeVisible();
  expect(welcomeReads).toBe(currentWelcomeReads);
  expect(voiceStarts).toBe(0);
  expect(recoveryRequests).toBe(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("region", { name: "Preparing your conversation" }),
  ).toBeVisible();
  let introduced = false;
  const introId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const intro = {
    id: introId,
    role: "AMIRA",
    kind: "INTRO",
    text: "Fixture introduction. What does retrieval practice mean?",
    createdAt: new Date().toISOString(),
    mode: "DISCUSSION",
    sources: [],
  };
  await page.route("**/api/study/conversations/*/control", async (route) => {
    introduced = true;
    await route.fulfill({ json: { agentTurn: intro } });
  });
  await page.route(
    /\/api\/study\/conversations\/[a-f0-9-]+$/,
    async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      if (introduced && !data.turns.some((t: any) => t.id === introId))
        data.turns.push(intro);
      await route.fulfill({ json: data });
    },
  );
  await page.unroute("**/api/study/conversations/*/speech");
  let releaseAudio!: () => void;
  const audioGate = new Promise<void>((resolve) => {
    releaseAudio = resolve;
  });
  await page.route("**/api/study/conversations/*/speech", async (route) => {
    await audioGate;
    await route.fulfill({
      json: {
        audioBase64: wav.toString("base64"),
        mimeType: "audio/wav",
        spokenText: intro.text,
        alignment: null,
      },
    });
  });
  const starting = page
    .getByRole("button", { name: "Start conversation", exact: true })
    .click();
  await expect(
    page.getByText("Preparing Amina’s voice", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(intro.text, { exact: true })).not.toBeVisible();
  expect(await page.evaluate(() => (window as any).__micRequests)).toBe(0);
  await expect(
    page.getByRole("region", { name: "Practice and break timer" }),
  ).toContainText("Practice");
  releaseAudio();
  await starting;
  await expect(
    page.getByText("Amina is waiting for your turn", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Practice and break timer" }),
  ).toContainText("Paused");
  await page
    .getByRole("button", { name: "Resume practice", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/airs-voice-turn-" + test.info().project.name + ".png",
    fullPage: true,
  });
  const recordBox = await page
    .getByRole("button", { name: "Start recording", exact: true })
    .boundingBox();
  const bottomNav = (await page.locator(".flowst-bottom-nav").count())
    ? await page.locator(".flowst-bottom-nav").boundingBox()
    : null;
  if (bottomNav)
    expect(recordBox!.y + recordBox!.height).toBeLessThanOrEqual(bottomNav.y);
  await page
    .getByRole("button", { name: "Start recording", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__micRequests))
    .toBe(1);
  expect(voiceStarts).toBe(0);
  await expect(page.locator(".stage-caption")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Saved conversation", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Your learning journey" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Your learning journey" })
    .getByRole("button", { name: /Misu/ })
    .click();
  const planDialog = page.getByRole("dialog", { name: "Your session plan" });
  await expect(planDialog).toBeVisible();
  await expect(planDialog.locator(".plan-progress")).toContainText("remaining");
  await expect(planDialog.locator(".misu-note")).toContainText("Misu");
  await expect(
    planDialog.getByText("Voice conversation", { exact: true }),
  ).toHaveCount(0);
  await expect(
    planDialog.getByRole("region", { name: "Kai evidence review" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(planDialog).not.toBeVisible();
  // Restore an owner timer in recovery; no real five-minute wait or provider call.
  let timer = {
    revision: "break-r1",
    blockId: "block",
    objectiveId: "objective",
    phase: "BREAK",
    remainingMs: 180000,
    startedAt: Date.now(),
    breakEndsAt: Date.now() + 180000,
    serverNow: Date.now(),
  };
  let skipped = false;
  await page.route("**/api/study/conversations/*/pacing", async (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      if (input.action === "SKIP_BREAK") {
        skipped = true;
        timer = {
          ...timer,
          revision: "skipped",
          remainingMs: 0,
          breakEndsAt: Date.now(),
        };
      } else if (input.action === "RESUME") {
        timer = {
          ...timer,
          revision: "resumed",
          phase: "PRACTICE",
          remainingMs: 300000,
          startedAt: Date.now(),
        };
      }
    }
    await route.fulfill({ json: { pacing: timer } });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Skip break & continue", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Skip break & continue", exact: true })
    .click();
  expect(skipped).toBe(true);
  await expect(
    page.getByRole("region", { name: "Practice and break timer" }),
  ).toContainText("Practice");
  // UI contract fixture: backend evidence validation is exercised separately in unit tests.
  let confirmed = false,
    fixtureStudy: any,
    pastTrialUsage = false;
  await page.unroute(/\/api\/study\/conversations\/[a-f0-9-]+$/);
  await page.route(
    /\/api\/study\/conversations\/[a-f0-9-]+$/,
    async (route) => {
      const response = await route.fetch(),
        data = await response.json();
      data.turns.push(intro);
      data.plan.activeObjectiveId = data.plan.objectives.at(-1).id;
      data.plan.recommendation = {
        objectiveId: data.plan.activeObjectiveId,
        action: "COMPLETE",
        reason: "Fixture: the saved explanation supports this checkpoint.",
        basedOnAttemptCount: data.practice.attempts.length,
      };
      if (confirmed) {
        data.plan.courseCompletedAt = new Date().toISOString();
        data.plan.courseCompletedBy = data.ownerId;
        data.plan.recommendation = undefined;
      }
      data.journey = {
        completedObjectiveIds: confirmed
          ? data.plan.objectives.map((o: any) => o.id)
          : data.plan.objectives.slice(0, -1).map((o: any) => o.id),
        totalObjectives: data.plan.objectives.length,
        checkpointReady: !confirmed,
        kaiReady: confirmed,
      };
      if (pastTrialUsage)
        data.voiceUsage = {
          ...data.voiceUsage,
          transcribeSeconds: 1200,
          pollyCharacters: 25000,
        };
      fixtureStudy = data;
      await route.fulfill({ json: data });
    },
  );
  await page.route(
    "**/api/study/conversations/*/plan/confirm",
    async (route) => {
      confirmed = true;
      fixtureStudy.plan.courseCompletedAt = new Date().toISOString();
      fixtureStudy.plan.courseCompletedBy = fixtureStudy.ownerId;
      fixtureStudy.plan.recommendation = undefined;
      await route.fulfill({ json: fixtureStudy });
    },
  );
  await page.route("**/api/study/conversations/*/review", (route) =>
    route.fulfill({
      json:
        route.request().method() === "GET"
          ? { review: null }
          : {
              id: "fixture-review",
              observations: [
                {
                  criterionId: "CLARITY",
                  text: "Fixture: your explanation was organized around the source.",
                  evidenceIds: ["fixture-evidence"],
                },
              ],
              evidence: [
                {
                  id: "fixture-evidence",
                  attempt: "Fixture learner explanation",
                },
              ],
              notAssessed: ["Mastery and longitudinal improvement"],
              nextPractice: {
                goal: "Explain to another audience",
                exercise: "Try explaining the idea to a teammate.",
              },
              nextPracticeStatus: "PROPOSED",
            },
    }),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Review checkpoint", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Your objective checkpoint" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm objectives complete", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Checkpoint saved" }),
  ).toBeVisible();
  await expect(page.locator(".objective-celebration .confetti i")).toHaveCount(
    42,
  );
  await expect(page.locator(".celebration-agents")).toContainText("Misu");
  await expect(page.locator(".celebration-agents")).toContainText("Amina");
  await expect(page.locator(".celebration-agents")).toContainText("Kai");
  await page.screenshot({
    path: "test-results/airs-celebration-" + test.info().project.name + ".png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Prepare Kai’s review", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Kai is next" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue now", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Kai is next" })).toBeVisible();
  await expect(
    page.getByText("Misu’s goals guide the review", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Meet Kai’s feedback role", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Kai’s practice review" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review my saved practice", exact: true })
    .click();
  await expect(
    page.getByText(
      "Fixture: your explanation was organized around the source.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "What to practise next", exact: true })
    .click();
  await expect(
    page.getByText("Explain to another audience", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/airs-kai-review-" + test.info().project.name + ".png",
    fullPage: true,
  });
  // Earlier usage beyond the retired quotas leaves playback and recording available.
  pastTrialUsage = true;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Listen to reply", exact: true })
    .click();
  await expect(
    page.getByText("Amina is waiting for your turn", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page
    .getByRole("button", { name: "Practice options", exact: true })
    .click();
  const voicePractice = page.getByRole("region", {
    name: "Voice practice",
    exact: true,
  });
  await expect(voicePractice).toContainText(
    "No cumulative voice limit applies to this study.",
  );
  await expect(voicePractice).toContainText(
    "Your speech input used: 1200 seconds.",
  );
  await expect(voicePractice).toContainText("25,000");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Start recording", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Conversation", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Saved conversation", exact: true }),
  ).toContainText(intro.text);
  expect(pageErrors).toEqual([]);
});
