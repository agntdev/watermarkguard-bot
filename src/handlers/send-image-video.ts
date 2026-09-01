import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard, adminChatId } from "../toolkit/index.js";
import { createReport, reportId, saveSubmission, type Detection, type Submission } from "../watermark-data.js";
import { reportKeyboard, reportText } from "../watermark-ui.js";

registerMainMenuItem({ label: "Submit media", data: "scan:submit", order: 10 });
const composer = new Composer<Ctx>();
const durableCtx = (ctx: object) => ctx as { env?: Record<string, unknown> };
const THREAD = (ctx: Ctx) => ({ message_thread_id: ctx.message?.message_thread_id });

composer.callbackQuery("scan:submit", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Send an image or video here and I’ll check it for a visible watermark.", {
    reply_markup: inlineKeyboard([[inlineButton("Back to menu", "menu:main")]]),
  });
});

function media(ctx: Ctx): { id: string; kind: "photo" | "video"; thumbnail?: string } | undefined {
  const message = ctx.message;
  if (!message) return undefined;
  if (message.photo?.length) {
    const photo = message.photo[message.photo.length - 1];
    return { id: photo.file_id, kind: "photo" };
  }
  if (message.video) return { id: message.video.file_id, kind: "video", thumbnail: message.video.thumbnail?.file_id };
  return undefined;
}

// Telegram exposes file references, not decoded pixels. Without a supplied CV
// service this is intentionally conservative: it never invents a watermark.
function analyze(): Detection { return { confidenceScore: 0, detectionType: "none" }; }

composer.on(["message:photo", "message:video"], async (ctx) => {
  const received = media(ctx);
  if (!received || !ctx.from || !ctx.message) return;
  await ctx.reply("Under review.", THREAD(ctx));
  const submission: Submission = { id: "", userId: ctx.from.id, messageId: ctx.message.message_id, mediaId: received.id, mediaKind: received.kind, createdAt: ctx.message.date * 1000 };
  submission.id = reportId(submission);
  const detection = analyze();
  try {
    await saveSubmission(durableCtx(ctx), submission, { ...detection, thumbnailFileId: received.thumbnail });
  } catch {
    await ctx.reply("I couldn’t finish that review. Send the media again.", THREAD(ctx));
    return;
  }
  if (detection.confidenceScore >= 0.75) {
    const report = { id: submission.id, submission, detection: { ...detection, thumbnailFileId: received.thumbnail }, status: "pending" as const };
    const stored = await createReport(durableCtx(ctx), report);
    const admin = adminChatId(durableCtx(ctx));
    if (!stored || !admin) {
      await ctx.reply("I found a possible watermark, but owner alerts aren’t set up yet.", THREAD(ctx));
      return;
    }
    try { await ctx.api.sendMessage(admin, reportText(report), { reply_markup: reportKeyboard(report.id) }); }
    catch { await ctx.reply("I found a possible watermark, but couldn’t send the owner alert.", THREAD(ctx)); return; }
    await ctx.reply("A possible watermark was sent for review.", THREAD(ctx));
    return;
  }
  await ctx.reply("No visible watermark could be confirmed.", THREAD(ctx));
});

export default composer;
