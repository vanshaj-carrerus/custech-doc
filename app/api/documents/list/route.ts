import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DocumentRecord } from "@/models/Document";

export async function GET() {
  try {
    await connectToDatabase();

    const docs = await DocumentRecord.find({}).sort({ createdAt: -1 }).limit(20);

    return NextResponse.json({
      success: true,
      count: docs.length,
      documents: docs.map((d) => ({
        id: d._id.toString(),
        title: d.name,
        senderEmail: d.senderEmail,
        recipientEmail: d.recipientEmail,
        recipientName: d.recipientName,
        updatedAt: d.createdAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        pages: d.pages || 1,
        status: d.status || "Completed",
        size: d.size || "1.2 MB",
      })),
    });
  } catch (error: any) {
    console.error("MongoDB Fetch Documents Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch from MongoDB" },
      { status: 500 }
    );
  }
}
