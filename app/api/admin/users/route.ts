import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

async function requireAdmin(adminEmail: string | null) {
  if (!adminEmail) return null;
  const admin = await User.findOne({ email: adminEmail.toLowerCase().trim() });
  if (!admin || admin.role !== "admin" || admin.status !== "approved") return null;
  return admin;
}

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const admin = await requireAdmin(searchParams.get("adminEmail"));
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Admin access required" },
        { status: 403 }
      );
    }

    const users = await User.find({}, "-password").sort({ status: 1, createdAt: -1 });

    return NextResponse.json({
      success: true,
      users: users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        plan: u.plan,
        avatarUrl: u.avatarUrl,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Admin Users List API error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
