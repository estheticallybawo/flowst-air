export default defineEventHandler(() => {
  throw createError({
    statusCode: 410,
    statusMessage: "Amina is voice-only. Record a response to continue.",
  });
});
