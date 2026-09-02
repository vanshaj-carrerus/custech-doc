import mongoose, { Schema, Model } from "mongoose";

export interface IFileChunk {
  docId: mongoose.Types.ObjectId;
  index: number;
  data: string;
}

const MODEL_NAME = "DocumentFileChunk";

const FileChunkSchema = new Schema<IFileChunk>(
  {
    docId: { type: Schema.Types.ObjectId, required: true, index: true },
    index: { type: Number, required: true },
    data: { type: String, required: true },
  },
  { versionKey: false }
);

FileChunkSchema.index({ docId: 1, index: 1 }, { unique: true });

if (mongoose.models[MODEL_NAME]) {
  delete mongoose.models[MODEL_NAME];
}

export const FileChunk: Model<IFileChunk> = mongoose.model<IFileChunk>(
  MODEL_NAME,
  FileChunkSchema
);
