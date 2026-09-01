import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { sendCandidateReminderEmail } from "@/lib/email";
import { DocumentRecord } from "@/models/Document";

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const CLAIM_TIMEOUT_MS = 60 * 60 * 1000;

function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    return request.headers.get("authorization") === `Bearer ${secret}`;
  }
  // Vercel adds this header to configured production cron invocations.
  return !!request.headers.get("x-vercel-cron-schedule");
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized cron request" },
      { status: 401 }
    );
  }

  try {
    await connectToDatabase();
    const now = new Date();
    const dueBefore = new Date(now.getTime() - TWELVE_HOURS_MS);
    const staleClaimBefore = new Date(now.getTime() - CLAIM_TIMEOUT_MS);

    const dueDocs = await DocumentRecord.find({
      status: "Pending Sign",
      recipientEmail: { $exists: true, $ne: "" },
      sentAt: { $lte: dueBefore },
      automaticReminderSentAt: { $exists: false },
      $and: [
        { $or: [{ emailOpened: false }, { emailOpened: { $exists: false } }] },
        { emailOpenedAt: { $exists: false } },
        { emailClickedAt: { $exists: false } },
        { emailViewedAt: { $exists: false } },
        {
          $or: [
            { automaticReminderClaimedAt: { $exists: false } },
            { automaticReminderClaimedAt: { $lte: staleClaimBefore } },
          ],
        },
      ],
    })
      .sort({ sentAt: 1 })
      .limit(50);

    let sent = 0;
    let failed = 0;

    for (const candidate of dueDocs) {
      const claimed = await DocumentRecord.findOneAndUpdate(
        {
          _id: candidate._id,
          automaticReminderSentAt: { $exists: false },
          $or: [
            { automaticReminderClaimedAt: { $exists: false } },
            { automaticReminderClaimedAt: { $lte: staleClaimBefore } },
          ],
        },
        { $set: { automaticReminderClaimedAt: now } },
        { new: true }
      );
      if (!claimed?.recipientEmail) continue;

      const result = await sendCandidateReminderEmail({
        senderEmail: claimed.senderEmail,
        recipientEmail: claimed.recipientEmail,
        recipientName: claimed.recipientName,
        docName: claimed.name,
        docId: claimed._id.toString(),
      });

      if (result.success) {
        await DocumentRecord.updateOne(
          { _id: claimed._id },
          {
            $set: {
              automaticReminderSentAt: new Date(),
              lastReminderAt: new Date(),
            },
            $inc: { reminderCount: 1 },
            $unset: { automaticReminderClaimedAt: 1 },
          }
        );
        sent++;
      } else {
        await DocumentRecord.updateOne(
          { _id: claimed._id },
          { $unset: { automaticReminderClaimedAt: 1 } }
        );
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      checked: dueDocs.length,
      sent,
      failed,
      dueBefore: dueBefore.toISOString(),
    });
  } catch (error: unknown) {
    console.error("Automatic reminder cron error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Reminder cron failed",
      },
      { status: 500 }
    );
  }
}
