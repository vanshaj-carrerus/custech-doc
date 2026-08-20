import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, password, isSignUp } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, message: "Email address is required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // Ensure database connection
    try {
      await connectToDatabase();
    } catch (dbError) {
      console.error("[MongoDB Auth Error] Cannot connect to database:", dbError);
      return NextResponse.json(
        {
          success: false,
          message: "Database connection failed. Please ensure MongoDB is running.",
        },
        { status: 500 }
      );
    }

    // Query user record in MongoDB database
    const existingUser = await User.findOne({ email: cleanEmail });

    if (isSignUp) {
      // User is attempting to SIGN UP
      if (existingUser) {
        return NextResponse.json(
          {
            success: false,
            alreadyExists: true,
            message: `Account already exists in database for "${cleanEmail}". Please Sign In instead!`,
          },
          { status: 400 }
        );
      }

      // Create new user record in MongoDB database — new accounts start
      // pending until an admin approves them in the admin panel.
      const newUser = await User.create({
        name: name?.trim() || cleanEmail.split("@")[0],
        email: cleanEmail,
        password: password || "hashed_password",
        plan: "Pro Enterprise",
        avatarUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
        role: "user",
        status: "pending",
      });

      return NextResponse.json({
        success: true,
        pendingApproval: true,
        message: "Account request submitted! An admin needs to approve your account before you can sign in.",
        user: {
          id: newUser._id.toString(),
          name: newUser.name,
          email: newUser.email,
        },
      });
    } else {
      // User is attempting to SIGN IN
      if (!existingUser) {
        return NextResponse.json(
          {
            success: false,
            notSignedUp: true,
            message: `No account found in database for "${cleanEmail}". You must Sign Up first!`,
          },
          { status: 404 }
        );
      }

      if (existingUser.status === "pending") {
        return NextResponse.json(
          {
            success: false,
            pendingApproval: true,
            message: "Your account is awaiting admin approval. Please check back soon.",
          },
          { status: 403 }
        );
      }

      if (existingUser.status === "rejected") {
        return NextResponse.json(
          {
            success: false,
            rejected: true,
            message: "Your account request was rejected. Contact the admin for details.",
          },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Signed in successfully from database record",
        user: {
          id: existingUser._id.toString(),
          name: existingUser.name,
          email: existingUser.email,
          plan: existingUser.plan,
          avatarUrl: existingUser.avatarUrl,
          role: existingUser.role,
          isLoggedIn: true,
        },
      });
    }
  } catch (error: any) {
    console.error("[Auth API Error]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Authentication server error" },
      { status: 500 }
    );
  }
}