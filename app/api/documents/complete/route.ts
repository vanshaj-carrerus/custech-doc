import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { DocumentRecord } from "@/models/Document";
import { sendCompletedAgreementEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { docId, candidateEmail, senderEmail, filledFields, device } = body;
    // Which independent field layout (see PDFEditorView's Desktop/Mobile
    // editor tabs) the candidate actually filled in and is submitting values
    // for — only that device's pair gets overwritten with the signed values,
    // so the other device's untouched layout/blocks aren't clobbered.
    const isMobileSubmission = device === "mobile";

    await connectToDatabase();

    let docRecord = null;
    if (docId && docId.length === 24) {
      docRecord = await DocumentRecord.findByIdAndUpdate(
        docId,
        isMobileSubmission
          ? { status: "Completed", filledFieldsMobile: filledFields || [], placedFieldsMobile: filledFields || [] }
          : { status: "Completed", filledFields: filledFields || [], placedFields: filledFields || [] },
        { new: true }
      );
    }

    const recipient = candidateEmail || docRecord?.recipientEmail || "candidate@email.com";
    const sender = senderEmail || docRecord?.senderEmail || "recruiter@gmail.com";
    const docTitle = docRecord?.name || "Completed Agreement.pdf";

    // Send final completed email via Nodemailer to BOTH candidate and recruiter
    await sendCompletedAgreementEmail({
      senderEmail: sender,
      recipientEmail: recipient,
      recipientName: docRecord?.recipientName || recipient,
      docName: docTitle,
      docId: docId || "dh-884920",
    });

    return NextResponse.json({
      success: true,
      message: "Agreement completed & emails dispatched to candidate and recruiter via Nodemailer",
      details: {
        candidateEmail: recipient,
        recruiterEmail: sender,
        document: docTitle,
        status: "Completed",
      },
    });
  } catch (error: any) {
    console.error("Complete Document API error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Completion error" },
      { status: 500 }
    );
  }
}
