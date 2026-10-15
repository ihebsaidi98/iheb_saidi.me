import { NextResponse } from "next/server";
import { aiServiceClient } from "@/lib/ai-service-client";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const health = await aiServiceClient.checkHealth(3000);
    return NextResponse.json(
      {
        status: "ok",
        pythonService: health,
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Service unreachable";
    return NextResponse.json(
      {
        status: "unavailable",
        error: "Python AI Service is currently unreachable or offline.",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 503 },
    );
  }
}
