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
  },
  { timestamps: true }
);

export const DocumentRecord: Model<IDocumentRecord> =
  mongoose.models.DocumentRecord ||
  mongoose.model<IDocumentRecord>("DocumentRecord", DocumentSchema);
