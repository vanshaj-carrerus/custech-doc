import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { currentEmail, name, email, avatarUrl } = body;

    if (!currentEmail || typeof currentEmail !== "string") {
      return NextResponse.json(
        { success: false, message: "Current account email is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findOne({ email: currentEmail.toLowerCase().trim() });
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Account not found" },
        { status: 404 }
      );
    }

    if (name && typeof name === "string" && name.trim()) {
      user.name = name.trim();
    }

    if (email && typeof email === "string" && email.trim()) {
      const cleanEmail = email.toLowerCase().trim();
      if (cleanEmail !== user.email) {
        const existing = await User.findOne({ email: cleanEmail });
        if (existing) {
          return NextResponse.json(
            { success: false, message: `An account already exists for "${cleanEmail}"` },
            { status: 400 }
          );
        }
        user.email = cleanEmail;
      }
    }

    if (typeof avatarUrl === "string") {
      user.avatarUrl = avatarUrl;
    }

    await user.save();

    return NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        plan: user.plan,
        role: user.role,
        isLoggedIn: true,
      },
    });
  } catch (error: any) {
    console.error("[Profile Update API error]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Profile update failed" },
      { status: 500 }
    );
  }
}
