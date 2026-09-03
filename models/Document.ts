import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDocumentRecord extends Document {
  name: string;
  size: string;
  pages: number;
  fileUrl?: string;
  fileType?: string;
  senderEmail: string;
  recipientEmail?: string;
  recipientName?: string;
  subject?: string;
  message?: string;
  placedFields?: any[];
  filledFields?: any[];
  textEdits?: Record<string, string>;
  status: "Draft" | "Processing" | "Pending Sign" | "Completed";
  sentAt?: Date;
  emailOpened?: boolean;
  emailOpenedAt?: Date;
  lastEmailOpenedAt?: Date;
  emailOpenCount?: number;
  emailClickedAt?: Date;
  emailViewedAt?: Date;
  reminderCount?: number;
  lastReminderAt?: Date;
  automaticReminderSentAt?: Date;
  automaticReminderClaimedAt?: Date;
  createdAt: Date;
}

const DocumentSchema: Schema<IDocumentRecord> = new Schema(
  {
    name: { type: String, required: true },
    size: { type: String, default: "1.2 MB" },
    pages: { type: Number, default: 1 },
    fileUrl: { type: String },
    fileType: { type: String },
    senderEmail: { type: String, required: true },
    recipientEmail: { type: String },
    recipientName: { type: String },
    subject: { type: String },
    message: { type: String },
    placedFields: { type: Array, default: [] },
    filledFields: { type: Array, default: [] },
    textEdits: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["Draft", "Processing", "Pending Sign", "Completed"],
      default: "Completed",
    },
    sentAt: { type: Date },
    emailOpened: { type: Boolean, default: false },
    emailOpenedAt: { type: Date },
    lastEmailOpenedAt: { type: Date },
    emailOpenCount: { type: Number, default: 0 },
    emailClickedAt: { type: Date },
    emailViewedAt: { type: Date },
    reminderCount: { type: Number, default: 0 },
    lastReminderAt: { type: Date },
    automaticReminderSentAt: { type: Date },
    automaticReminderClaimedAt: { type: Date },
  },
  { timestamps: true }
);

// Lets Mongo satisfy the dashboard's { senderEmail | recipientEmail } + sort(createdAt)
// query straight from the index instead of buffering full documents (which include
// the base64 PDF in fileUrl) in memory to sort — that was blowing past the 32MB
// in-memory sort limit.
DocumentSchema.index({ senderEmail: 1, createdAt: -1 });
DocumentSchema.index({ recipientEmail: 1, createdAt: -1 });

const MODEL_NAME = "DocumentRecord";
if (mongoose.models[MODEL_NAME]) {
  delete mongoose.models[MODEL_NAME];
}

export const DocumentRecord: Model<IDocumentRecord> =
  mongoose.model<IDocumentRecord>(MODEL_NAME, DocumentSchema);
