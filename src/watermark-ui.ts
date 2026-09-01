import { inlineButton, inlineKeyboard, paginate } from "./toolkit/index.js";
import type { Report } from "./watermark-data.js";

export function reportKeyboard(reportId: string) {
  return inlineKeyboard([[
    inlineButton("Confirm", `report:confirm:${reportId}`),
    inlineButton("False positive", `report:false:${reportId}`),
  ]]);
}

function score(report: Report): string { return `${Math.round(report.detection.confidenceScore * 100)}%`; }

export function reportText(report: Report): string {
  return `Watermark report\nConfidence: ${score(report)}\nType: ${report.detection.detectionType}\nStatus: ${report.status.replace("_", " ")}`;
}

export function reportPage(reports: Report[], requestedPage: number) {
  const page = paginate(reports, { page: requestedPage, perPage: 5, callbackPrefix: "reports", prevLabel: "Previous", nextLabel: "Next" });
  if (reports.length === 0) return { text: "No flagged reports yet.", keyboard: inlineKeyboard([]) };
  const rows = page.pageItems.map((report) => [inlineButton(`Report ${report.id} · ${score(report)}`, `report:view:${report.id}`)]);
  return {
    text: `Flagged reports — page ${page.page + 1} of ${page.totalPages}`,
    keyboard: inlineKeyboard([...rows, ...page.controls.inline_keyboard]),
  };
}
