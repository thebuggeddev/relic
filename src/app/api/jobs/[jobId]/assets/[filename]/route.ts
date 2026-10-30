import { NextResponse } from "next/server";
import { getCurrentSessionId } from "@/lib/security/session-credentials";
import { readJobAssetForSession } from "@/lib/storage/job-store";

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string; filename: string }> }
) {
  const { jobId, filename } = await context.params;
  const sessionId = await getCurrentSessionId();
  if (!sessionId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const asset = await readJobAssetForSession(jobId, sessionId, filename);
  if (!asset) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const url = new URL(request.url);
  const isDownload = url.searchParams.get("download") === "1";

  const headers: Record<string, string> = {
    "Content-Type": asset.contentType,
    "Cache-Control": "private, max-age=3600",
  };

  if (isDownload) {
    headers["Content-Disposition"] = `attachment; filename="relic-reborn-${filename}"`;
  }

  return new NextResponse(new Uint8Array(asset.buffer), {
    status: 200,
    headers,
  });
}
