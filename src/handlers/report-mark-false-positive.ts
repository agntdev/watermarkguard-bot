import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { requireOwner } from "../toolkit/index.js";
import { setReportStatus } from "../watermark-data.js";

const composer = new Composer<Ctx>();
const durableCtx = (ctx: object) => ctx as { env?: Record<string, unknown> };
composer.callbackQuery(/^report:(?:false|mark_false_positive)(?::[a-z0-9-]+)?$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireOwner(ctx))) return;
  const id = ctx.callbackQuery.data.split(":")[2];
  if (!id) { await ctx.reply("Open a report first, then mark it as a false positive."); return; }
  const updated = await setReportStatus(durableCtx(ctx), id, "false_positive");
  if (updated === undefined) { await ctx.reply("Report storage isn’t set up yet."); return; }
  if (!updated) { await ctx.reply("That report is no longer available."); return; }
  await ctx.editMessageText("Report marked as a false positive.");
});

export default composer;
