import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = await getDatabase()
    const users = db.collection("users")

    const rawId = (session.user as any).id as string | undefined
    const email = session.user.email

    let user = null

    if (rawId) {
      try {
        user = await users.findOne({ _id: new ObjectId(rawId) })
      } catch {
        user = null
      }
    }

    if (!user && email) {
      user = await users.findOne({ email })
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        name: user.name ?? null,
        email: user.email ?? null,
        image: user.image ?? null,
        preferences: user.preferences ?? {},
      },
    })
  } catch (error) {
    console.error("Error in GET /api/users/me:", error)
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 },
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = await getDatabase()
    const users = db.collection("users")

    const rawId = (session.user as any).id as string | undefined
    const email = session.user.email

    const filter: any = {}

    if (rawId) {
      try {
        filter._id = new ObjectId(rawId)
      } catch {
        // ignore and fallback to email
      }
    }

    if (!filter._id && email) {
      filter.email = email
    }

    if (!filter._id && !filter.email) {
      return NextResponse.json(
        { error: "Unable to identify user" },
        { status: 400 },
      )
    }

    const body = await req.json()
    const {
      name,
      image,
      focusGoal,
      breakDuration,
      dailyTarget,
    }: {
      name?: string
      image?: string | null
      focusGoal?: number
      breakDuration?: number
      dailyTarget?: number
    } = body

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (typeof name === "string" && name.trim().length > 0) {
      updateData.name = name.trim()
    }

    if (typeof image === "string") {
      updateData.image = image
    }

    if (typeof focusGoal === "number") {
      updateData["preferences.focusGoal"] = focusGoal
    }

    if (typeof breakDuration === "number") {
      updateData["preferences.breakDuration"] = breakDuration
    }

    if (typeof dailyTarget === "number") {
      updateData["preferences.dailyTarget"] = dailyTarget
    }

    const result = await users.updateOne(filter, { $set: updateData })

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Profile updated successfully" })
  } catch (error) {
    console.error("Error in PUT /api/users/me:", error)
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 },
    )
  }
}
