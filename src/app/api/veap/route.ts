import { NextResponse } from "next/server";

function notImplemented() {
  return NextResponse.json(
    {
      error: "Not implemented",
      message: "VEAP backend is intentionally empty for now.",
    },
    { status: 501 },
  );
}

export function GET() {
  return notImplemented();
}

export function POST() {
  return notImplemented();
}
