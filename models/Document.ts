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
  fileChunks?: { index: number; data: string }[];
  createdAt: Date;
}

const DocumentSchema: Schema<IDocumentRecord> = new Schema(
  {
    name: { type: String, required: true },
    size: { type: String, default: "1.2 MB" },
    pages: { type: Number, default: 1 },
    fileUrl: { type: String },
    fileType: { type: String },
    senderEmail: { type: String, required: true, index: true },
    recipientEmail: { type: String },
    recipientName: { type: String },
    subject: { type: String },
    message: { type: String },
    placedFields: { type: Array, default: [] },
    filledFields: { type: Array, default: [] },
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
    fileChunks: { type: Array, default: [] },
  },
  { timestamps: true }
);

const MODEL_NAME = "DocumentRecord";
if (mongoose.models[MODEL_NAME]) {
  delete mongoose.models[MODEL_NAME];
}

export const DocumentRecord: Model<IDocumentRecord> =
  mongoose.model<IDocumentRecord>(MODEL_NAME, DocumentSchema);
