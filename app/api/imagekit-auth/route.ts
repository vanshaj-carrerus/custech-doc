import { NextResponse } from "next/server";
import { getUploadAuthParams } from "@imagekit/next/server";

export async function GET() {
  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    return NextResponse.json(
      { success: false, message: "ImageKit is not configured on the server" },
      { status: 500 }
    );
  }

  const { token, expire, signature } = getUploadAuthParams({ privateKey, publicKey });

  return NextResponse.json({ success: true, token, expire, signature, publicKey });
}
