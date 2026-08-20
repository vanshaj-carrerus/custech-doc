import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

async function requireAdmin(adminEmail: string | undefined | null) {
  if (!adminEmail) return null;
  const admin = await User.findOne({ email: adminEmail.toLowerCase().trim() });
  if (!admin || admin.role !== "admin" || admin.status !== "approved") return null;
  return admin;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const body = await request.json();
    const { adminEmail, status, role } = body;

    const admin = await requireAdmin(adminEmail);
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Admin access required" },
        { status: 403 }
      );
    }

    if (status && !["pending", "approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { success: false, message: "Invalid status value" },
        { status: 400 }
      );
    }
    if (role && !["admin", "user"].includes(role)) {
      return NextResponse.json(
        { success: false, message: "Invalid role value" },
        { status: 400 }
      );
    }

    const update: Record<string, string> = {};
    if (status) update.status = status;
    if (role) update.role = role;

    const updated = await User.findByIdAndUpdate(id, update, { new: true }).select("-password");
    if (!updated) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updated._id.toString(),
        name: updated.name,
        email: updated.email,
        role: updated.role,
        status: updated.status,
      },
    });
  } catch (error: any) {
    console.error("Admin Update User API error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const adminEmail = searchParams.get("adminEmail");

    const admin = await requireAdmin(adminEmail);
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Admin access required" },
        { status: 403 }
      );
    }

    if (admin._id.toString() === id) {
      return NextResponse.json(
        { success: false, message: "You cannot remove your own admin account" },
        { status: 400 }
      );
    }

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "User removed" });
  } catch (error: any) {
    console.error("Admin Delete User API error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 }
    );
  }
}
