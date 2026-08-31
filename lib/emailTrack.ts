import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { DocumentRecord } from "@/models/Document";

const MONGO_ID_RE = /^[a-fA-F0-9]{24}$/;

export type EmailTrackEvent = "open" | "click" | "view";

export async function recordEmailEvent(docId: string, event: EmailTrackEvent) {
  if (!docId || !MONGO_ID_RE.test(docId)) {
    console.warn(`[Email track] skipped ${event} — invalid id "${docId}"`);
    return false;
  }

  try {
    await connectToDatabase();
    const now = new Date();
    const _id = new mongoose.Types.ObjectId(docId);

    const $set: Record<string, unknown> = {
      emailOpened: true,
      lastEmailOpenedAt: now,
    };
    const $min: Record<string, Date> = {
      emailOpenedAt: now,
    };

    if (event === "click") $min.emailClickedAt = now;
    if (event === "view") $min.emailViewedAt = now;

    const update: Record<string, unknown> = { $set, $min };
    if (event === "open") {
      update.$inc = { emailOpenCount: 1 };
    }

    // Native collection update so fields persist even if the Mongoose model
    // was compiled before email-tracking paths were added.
    const result = await DocumentRecord.collection.updateOne({ _id }, update);
    console.log(
      `[Email track] ${event} doc=${docId} matched=${result.matchedCount} modified=${result.modifiedCount}`
    );
    return result.matchedCount > 0;
  } catch (error) {
    console.warn("[Email track] Could not record event:", error);
    return false;
  }
}
