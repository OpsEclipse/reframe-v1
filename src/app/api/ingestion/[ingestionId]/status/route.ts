import { NextRequest, NextResponse } from "next/server";
import { getIngestionActor } from "@/lib/ingestion/auth";
import {
  computeTotals,
  deriveStatusFromFiles,
  getManifestWithEtag,
  isManifestWriteConflict,
  putManifest,
  withDerivedFileStatuses,
  withManifestTimestamp,
} from "@/lib/ingestion/manifest";
import { isValidIngestionId } from "@/lib/ingestion/validation";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ ingestionId: string }> },
) {
  try {
    const actor = await getIngestionActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { ingestionId } = await context.params;
    if (!isValidIngestionId(ingestionId)) {
      return NextResponse.json({ error: "Invalid ingestionId." }, { status: 400 });
    }

    const storedManifest = await getManifestWithEtag(actor.user.id, ingestionId);
    if (!storedManifest) {
      return NextResponse.json({ error: "Ingestion not found." }, { status: 404 });
    }
    const { manifest, etag } = storedManifest;

    if (manifest.userId !== actor.user.id) {
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
      if (etag) {
        await putManifest(responseManifest, { ifMatch: etag }).catch((error) => {
          if (!isManifestWriteConflict(error)) throw error;
        });
      }
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
