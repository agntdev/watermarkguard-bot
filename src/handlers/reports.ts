import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, requireOwner } from "../toolkit/index.js";
import { listReports } from "../watermark-data.js";
import { reportKeyboard, reportPage, reportText } from "../watermark-ui.js";

registerMainMenuItem({ label: "View reports", data: "reports:open", order: 20 });
const composer = new Composer<Ctx>();
const durableCtx = (ctx: object) => ctx as { env?: Record<string, unknown> };

async function showReports(ctx: Ctx, page: number, edit: boolean) {
  const reports = await listReports(durableCtx(ctx));
  if (!reports) { await ctx.reply("Report storage isn’t set up yet."); return; }
  const view = reportPage(reports, page);
  if (edit) await ctx.editMessageText(view.text, { reply_markup: view.keyboard });
  else await ctx.reply(view.text, { reply_markup: view.keyboard });
}

composer.command("reports", async (ctx) => {
  if (!(await requireOwner(ctx))) return;
  await showReports(ctx, 0, false);
});
composer.callbackQuery("reports:open", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireOwner(ctx))) return;
  await showReports(ctx, 0, true);
});
composer.callbackQuery(/^reports:(?:prev|next):\d+$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireOwner(ctx))) return;
  await showReports(ctx, Number(ctx.callbackQuery.data.split(":")[2]), true);
});
composer.callbackQuery(/^report:view:[a-z0-9-]+$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireOwner(ctx))) return;
  const reports = await listReports(durableCtx(ctx));
  if (!reports) { await ctx.reply("Report storage isn’t set up yet."); return; }
  const report = reports.find((item) => item.id === ctx.callbackQuery.data.split(":")[2]);
  if (!report) { await ctx.reply("That report is no longer available."); return; }
  await ctx.editMessageText(reportText(report), { reply_markup: reportKeyboard(report.id) });
});

export default composer;
