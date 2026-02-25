import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    { ok: true, service: "veap-api", message: "Serverless API scaffold is active." },
    { status: 200 },
  );
}
