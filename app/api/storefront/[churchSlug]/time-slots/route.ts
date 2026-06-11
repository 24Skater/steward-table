import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface TimeSlot {
  value: string;
  label: string;
  available: boolean;
}

const DEFAULT_WINDOW_START_HOUR = 10; // 10:00 AM
const DEFAULT_WINDOW_START_MINUTE = 0;
const DEFAULT_WINDOW_END_HOUR = 20; // 8:00 PM
const DEFAULT_WINDOW_END_MINUTE = 0;
const DEFAULT_SLOT_INTERVAL_MINUTES = 30;
const BUFFER_MINUTES = 30;

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatLabel(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours < 12 ? "AM" : "PM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${pad(minutes)} ${period}`;
}

function parseISODate(dateStr: string): Date | null {
  // Expect YYYY-MM-DD
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const year = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10) - 1;
  const day = parseInt(match[3]!, 10);
  const d = new Date(year, month, day, 0, 0, 0, 0);
  if (isNaN(d.getTime())) return null;
  return d;
}

function toISOLocalString(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ churchSlug: string }> },
) {
  const { churchSlug } = await params;

  const church = await (db.church.findFirst as Function)({
    where: { slug: churchSlug, status: "ACTIVE" },
    select: { id: true, settings: { select: { brandTokens: true } } },
    _bypassTenancyCheck: true,
  });

  if (!church) {
    return NextResponse.json({ error: "Church not found" }, { status: 404 });
  }

  const searchParams = req.nextUrl.searchParams;
  const dateParam = searchParams.get("date");

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const targetDateStr = dateParam ?? todayStr;

  const targetDate = parseISODate(targetDateStr);
  if (!targetDate) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 });
  }

  // Read pickup window settings from church brandTokens with fallback to defaults
  const brandTokens =
    church.settings?.brandTokens && typeof church.settings.brandTokens === "object"
      ? (church.settings.brandTokens as Record<string, unknown>)
      : {};
  const windowStartHour =
    typeof brandTokens.pickupWindowStartHour === "number"
      ? brandTokens.pickupWindowStartHour
      : DEFAULT_WINDOW_START_HOUR;
  const windowStartMinute = DEFAULT_WINDOW_START_MINUTE;
  const windowEndHour =
    typeof brandTokens.pickupWindowEndHour === "number"
      ? brandTokens.pickupWindowEndHour
      : DEFAULT_WINDOW_END_HOUR;
  const windowEndMinute = DEFAULT_WINDOW_END_MINUTE;
  const intervalMinutes =
    typeof brandTokens.slotIntervalMinutes === "number"
      ? brandTokens.slotIntervalMinutes
      : DEFAULT_SLOT_INTERVAL_MINUTES;

  // Earliest bookable time = now + buffer
  const earliest = new Date(now.getTime() + BUFFER_MINUTES * 60 * 1000);

  // Window start and end for the target date
  const windowStart = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    windowStartHour,
    windowStartMinute,
    0,
    0,
  );
  const windowEnd = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    windowEndHour,
    windowEndMinute,
    0,
    0,
  );

  // First slot = later of window start or earliest bookable time, snapped to slot grid
  let cursor = new Date(Math.max(windowStart.getTime(), earliest.getTime()));

  // Snap cursor up to the next slot boundary
  const totalMinutes = cursor.getHours() * 60 + cursor.getMinutes();
  const remainder = totalMinutes % intervalMinutes;
  if (remainder !== 0) {
    cursor = new Date(cursor.getTime() + (intervalMinutes - remainder) * 60 * 1000);
    cursor.setSeconds(0, 0);
  } else {
    cursor.setSeconds(0, 0);
  }

  const slots: TimeSlot[] = [];

  while (cursor < windowEnd) {
    slots.push({
      value: toISOLocalString(cursor),
      label: formatLabel(cursor),
      available: true,
    });
    cursor = new Date(cursor.getTime() + intervalMinutes * 60 * 1000);
  }

  return NextResponse.json({ slots, date: targetDateStr });
}
