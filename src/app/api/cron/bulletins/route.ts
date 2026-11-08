import { NextResponse } from "next/server";
import {
  isBulletinDueNow,
  listActiveBulletinsForCron,
  sendBulletinById,
} from "@/lib/bulletins/send-service";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const header = request.headers.get("x-cron-secret");
  return header === secret;
}

async function runCron(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const bulletins = await listActiveBulletinsForCron();
  const due = bulletins.filter((b) => isBulletinDueNow(b));
  const results: Array<{ id: string; ok: boolean; demo?: boolean; error?: string }> = [];

  for (const bulletin of due) {
    const result = await sendBulletinById({ bulletinId: bulletin.id });
    if (result.ok) {
      results.push({ id: bulletin.id, ok: true, demo: result.demo });
    } else {
      results.push({ id: bulletin.id, ok: false, error: result.error });
    }
  }

  return NextResponse.json({
    ok: true,
    checked: bulletins.length,
    due: due.length,
    results,
  });
}

export async function GET(request: Request) {
  return runCron(request);
}

export async function POST(request: Request) {
  return runCron(request);
}
