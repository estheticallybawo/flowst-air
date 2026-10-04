export default defineEventHandler(() => {
  throw createError({
    statusCode: 410,
    statusMessage:
      "This older voice session is no longer available. Open your study chat and use the recording button.",
  });
});
