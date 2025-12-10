import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getDatabase } from "@/lib/mongodb";

/**
 * Returns per-user focus statistics used by the profile page.
 *
 * Reads from the `sessions` collection, using the Session schema:
 * - userId: string
 * - duration: number (seconds actually focused)
 * - focusPercentage: number (0–100)
 * - isCompleted: boolean
 * - createdAt: Date
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id || session.user.email;
    const db = await getDatabase();

    const sessions = await db
      .collection("sessions")
      .find({ userId, isCompleted: true })
      .toArray();

    if (!sessions.length) {
      return NextResponse.json({
        stats: {
          totalSessions: 0,
          totalFocusTime: 0,
          averageFocus: 0,
          currentStreak: 0,
          bestStreak: 0,
        },
      });
    }

    let totalSessions = sessions.length;
    let totalSeconds = 0;
    let focusSum = 0;
    let focusCount = 0;

    type AnySession = {
      duration?: number;
      focusPercentage?: number;
      createdAt?: Date | string;
    };

    const completedSessions: AnySession[] = [];

    for (const doc of sessions as AnySession[]) {
      const dur = typeof doc.duration === "number" ? doc.duration : 0;
      const focus =
        typeof doc.focusPercentage === "number" ? doc.focusPercentage : 0;

      totalSeconds += dur;

      if (!Number.isNaN(focus) && focus > 0) {
        focusSum += focus;
        focusCount += 1;
      }

      if (doc.createdAt) {
        completedSessions.push(doc);
      }
    }

    // minutes
    const totalFocusTime = Math.round(totalSeconds / 60);

    // average focus (one decimal)
    const averageFocus =
      focusCount > 0 ? Math.round((focusSum / focusCount) * 10) / 10 : 0;

    // --- Streak calculation (days in a row with at least one completed session) ---
    let currentStreak = 0;
    let bestStreak = 0;

    if (completedSessions.length > 0) {
      const sorted = [...completedSessions].sort((a, b) => {
        const da = new Date(a.createdAt as any);
        const db = new Date(b.createdAt as any);
        return da.getTime() - db.getTime();
      });

      let prevDateStr: string | null = null;

      for (const s of sorted) {
        const d = new Date(s.createdAt as any);
        const dayStr = d.toISOString().slice(0, 10); // YYYY-MM-DD

        if (!prevDateStr) {
          currentStreak = 1;
          bestStreak = 1;
        } else {
          const prev = new Date(prevDateStr);
          const diffDays =
            (d.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

          if (diffDays === 1) {
            currentStreak += 1;
          } else if (diffDays > 1) {
            currentStreak = 1;
          }
          if (currentStreak > bestStreak) {
            bestStreak = currentStreak;
          }
        }

        prevDateStr = dayStr;
      }
    }

    return NextResponse.json({
      stats: {
        totalSessions,
        totalFocusTime,
        averageFocus,
        currentStreak,
        bestStreak,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/users/me/stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
