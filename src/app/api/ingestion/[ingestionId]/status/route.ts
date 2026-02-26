import { NextRequest, NextResponse } from "next/server";
import {
  computeTotals,
  deriveStatusFromFiles,
  getManifest,
  putManifest,
  withDerivedFileStatuses,
  withManifestTimestamp,
} from "@/lib/ingestion/manifest";
import { isValidClientId, isValidIngestionId } from "@/lib/ingestion/validation";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ ingestionId: string }> },
) {
  try {
    const clientId = request.headers.get("x-client-id")?.trim();
    if (!clientId || !isValidClientId(clientId)) {
      return NextResponse.json({ error: "Invalid x-client-id header." }, { status: 400 });
    }

    const { ingestionId } = await context.params;
    if (!isValidIngestionId(ingestionId)) {
      return NextResponse.json({ error: "Invalid ingestionId." }, { status: 400 });
    }

    const manifest = await getManifest(clientId, ingestionId);
    if (!manifest) {
      return NextResponse.json({ error: "Ingestion not found." }, { status: 404 });
    }

    const { files: normalizedFiles, changed: fileStatusesChanged } = withDerivedFileStatuses(
      manifest.files,
    );
    const derivedStatus = deriveStatusFromFiles(normalizedFiles);
    const status =
      manifest.status === "COMPLETED" || manifest.status === "PARTIAL_FAILED" || manifest.status === "FAILED"
        ? manifest.status
        : derivedStatus;

    let responseManifest = manifest;
    if (status !== manifest.status || fileStatusesChanged) {
      responseManifest = withManifestTimestamp({
        ...manifest,
        status,
        files: normalizedFiles,
      });
      await putManifest(responseManifest);
    }

    return NextResponse.json({
      ingestionId: responseManifest.ingestionId,
      status: responseManifest.status,
      totals: computeTotals(responseManifest.files),
      files: responseManifest.files,
      submittedAt: responseManifest.submittedAt,
      updatedAt: responseManifest.updatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch ingestion status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
