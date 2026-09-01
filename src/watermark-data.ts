/** Durable report storage. Media bytes are deliberately never retained. */

export type MediaKind = "photo" | "video";

export interface Submission {
  id: string;
  userId: number;
  messageId: number;
  mediaId: string;
  mediaKind: MediaKind;
  createdAt: number;
}

export interface Detection {
  confidenceScore: number;
  detectionType: "none" | "text" | "logo" | "overlay";
  boundingBox?: string;
  frameTime?: number;
  thumbnailFileId?: string;
}

export interface Report {
  id: string;
  submission: Submission;
  detection: Detection;
  status: "pending" | "confirmed" | "false_positive";
}

interface D1Result<T> { results?: T[] }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  all<T>(): Promise<D1Result<T>>;
}
interface D1Database { prepare(query: string): D1Statement }

function database(ctx: { env?: Record<string, unknown> }): D1Database | undefined {
  const candidate = ctx.env?.DB;
  return candidate && typeof candidate === "object" && "prepare" in candidate
    ? candidate as D1Database
    : undefined;
}

async function ensureSchema(db: D1Database): Promise<void> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS watermark_submissions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    media_id TEXT NOT NULL,
    media_kind TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    confidence REAL NOT NULL,
    detection_type TEXT NOT NULL,
    bounding_box TEXT,
    frame_time REAL,
    thumbnail_file_id TEXT
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS watermark_reports (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    media_id TEXT NOT NULL,
    media_kind TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    confidence REAL NOT NULL,
    detection_type TEXT NOT NULL,
    bounding_box TEXT,
    frame_time REAL,
    thumbnail_file_id TEXT,
    status TEXT NOT NULL
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS watermark_reports_created ON watermark_reports(created_at DESC)").run();
}

/** Persist metadata and the detection outcome for every submitted item. */
export async function saveSubmission(
  ctx: { env?: Record<string, unknown> }, submission: Submission, detection: Detection,
): Promise<boolean> {
  const db = database(ctx);
  if (!db) return false;
  await ensureSchema(db);
  await db.prepare(`INSERT INTO watermark_submissions
    (id,user_id,message_id,media_id,media_kind,created_at,confidence,detection_type,bounding_box,frame_time,thumbnail_file_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(
    submission.id, submission.userId, submission.messageId, submission.mediaId, submission.mediaKind,
    submission.createdAt, detection.confidenceScore, detection.detectionType,
    detection.boundingBox ?? null, detection.frameTime ?? null, detection.thumbnailFileId ?? null,
  ).run();
  return true;
}

type Row = {
  id: string; user_id: number; message_id: number; media_id: string; media_kind: MediaKind;
  created_at: number; confidence: number; detection_type: Detection["detectionType"];
  bounding_box: string | null; frame_time: number | null; thumbnail_file_id: string | null;
  status: Report["status"];
};

function rowToReport(row: Row): Report {
  return {
    id: row.id,
    submission: { id: row.id, userId: row.user_id, messageId: row.message_id, mediaId: row.media_id, mediaKind: row.media_kind, createdAt: row.created_at },
    detection: { confidenceScore: row.confidence, detectionType: row.detection_type, boundingBox: row.bounding_box ?? undefined, frameTime: row.frame_time ?? undefined, thumbnailFileId: row.thumbnail_file_id ?? undefined },
    status: row.status,
  };
}

export async function createReport(ctx: { env?: Record<string, unknown> }, report: Report): Promise<boolean> {
  const db = database(ctx);
  if (!db) return false;
  await ensureSchema(db);
  const { submission, detection } = report;
  await db.prepare(`INSERT INTO watermark_reports
    (id,user_id,message_id,media_id,media_kind,created_at,confidence,detection_type,bounding_box,frame_time,thumbnail_file_id,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    report.id, submission.userId, submission.messageId, submission.mediaId, submission.mediaKind,
    submission.createdAt, detection.confidenceScore, detection.detectionType,
    detection.boundingBox ?? null, detection.frameTime ?? null, detection.thumbnailFileId ?? null, report.status,
  ).run();
  return true;
}

export async function listReports(ctx: { env?: Record<string, unknown> }, limit = 50): Promise<Report[] | undefined> {
  const db = database(ctx);
  if (!db) return undefined;
  await ensureSchema(db);
  const result = await db.prepare("SELECT * FROM watermark_reports ORDER BY created_at DESC LIMIT ?").bind(Math.min(Math.max(1, limit), 50)).all<Row>();
  return (result.results ?? []).map(rowToReport);
}

export async function setReportStatus(ctx: { env?: Record<string, unknown> }, id: string, status: Report["status"]): Promise<boolean | undefined> {
  const db = database(ctx);
  if (!db) return undefined;
  await ensureSchema(db);
  const result = await db.prepare("UPDATE watermark_reports SET status = ? WHERE id = ?").bind(status, id).run() as { meta?: { changes?: number } };
  return (await result).meta?.changes === 1;
}

/** A deterministic, collision-resistant identifier without storing any media bytes. */
export function reportId(submission: Submission): string {
  return `${submission.userId.toString(36)}-${submission.messageId.toString(36)}-${submission.createdAt.toString(36)}`;
}
