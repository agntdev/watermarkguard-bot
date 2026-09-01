import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { requireOwner } from "../toolkit/index.js";
import { setReportStatus } from "../watermark-data.js";

const composer = new Composer<Ctx>();
const durableCtx = (ctx: object) => ctx as { env?: Record<string, unknown> };
composer.callbackQuery(/^report:confirm(?::[a-z0-9-]+)?$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireOwner(ctx))) return;
  const id = ctx.callbackQuery.data.split(":")[2];
  if (!id) { await ctx.reply("Open a report first, then confirm it."); return; }
  const updated = await setReportStatus(durableCtx(ctx), id, "confirmed");
  if (updated === undefined) { await ctx.reply("Report storage isn’t set up yet."); return; }
  if (!updated) { await ctx.reply("That report is no longer available."); return; }
  await ctx.editMessageText("Report confirmed.");
});

export default composer;
