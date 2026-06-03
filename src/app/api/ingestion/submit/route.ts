import { InvokeCommand } from "@aws-sdk/client-lambda";
import { NextRequest, NextResponse } from "next/server";
import { getIngestionBucket, getLambdaClient, getStarterLambdaName } from "@/lib/aws/clients";
import { getIngestionActor } from "@/lib/ingestion/auth";
import {
  createInitialManifest,
  getManifest,
  putManifest,
  withManifestTimestamp,
} from "@/lib/ingestion/manifest";
import { buildManifestKey, isOwnedTempKey } from "@/lib/ingestion/s3-keys";
import type { IngestionManifest, StarterInvokePayload } from "@/lib/ingestion/types";
import type { IngestionFileInput } from "@/lib/ingestion/validation";
import { isValidIngestionId, validateFiles } from "@/lib/ingestion/validation";

interface SubmitFile extends IngestionFileInput {
  key: string;
}

interface SubmitRequestBody {
  ingestionId: string;
  files: SubmitFile[];
}

const ENQUEUE_FAILURE_MESSAGE = "Failed to enqueue starter Lambda.";

export const runtime = "nodejs";

function isStarterEnqueueFailureManifest(
  files: Array<{ status: string; errorMessage?: string | null }>,
): boolean {
  if (files.length === 0) {
    return false;
  }
  return files.every(
    (file) => file.status === "FAILED" && file.errorMessage === ENQUEUE_FAILURE_MESSAGE,
  );
}

async function markStarterEnqueueFailure(manifest: IngestionManifest) {
  await putManifest(
    withManifestTimestamp({
      ...manifest,
      status: "FAILED",
      files: manifest.files.map((file) => ({
        ...file,
        status: "FAILED",
        errorMessage: ENQUEUE_FAILURE_MESSAGE,
      })),
    }),
  );
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getIngestionActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const userId = actor.user.id;
    const clientId = actor.clientId;

    const body = (await request.json()) as SubmitRequestBody;
    const ingestionId = body?.ingestionId;
    const files = body?.files;

    if (!ingestionId || !isValidIngestionId(ingestionId)) {
      return NextResponse.json({ error: "Invalid ingestionId." }, { status: 400 });
    }

    const validationError = validateFiles(files);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const seenClientFileIds = new Set<string>();
    for (const file of files) {
      if (!file.key || typeof file.key !== "string") {
        return NextResponse.json({ error: `Missing key for ${file.clientFileId}.` }, { status: 400 });
      }

      if (seenClientFileIds.has(file.clientFileId)) {
        return NextResponse.json(
          { error: `Duplicate clientFileId provided: ${file.clientFileId}` },
          { status: 400 },
        );
      }
      seenClientFileIds.add(file.clientFileId);

      if (!isOwnedTempKey(file.key, userId, ingestionId)) {
        return NextResponse.json(
          { error: `Invalid file key ownership for ${file.clientFileId}.` },
          { status: 400 },
        );
      }
    }

    const existingManifest = await getManifest(userId, ingestionId);
    const shouldRetryStarterEnqueue =
      existingManifest &&
      existingManifest.status === "FAILED" &&
      isStarterEnqueueFailureManifest(existingManifest.files);

    if (existingManifest && !shouldRetryStarterEnqueue) {
      return NextResponse.json({
        ingestionId,
        status: existingManifest.status,
        pollUrl: `/api/ingestion/${ingestionId}/status`,
      });
    }

    const manifest =
      existingManifest && shouldRetryStarterEnqueue
        ? withManifestTimestamp({
            ...existingManifest,
            status: "QUEUED",
            files: existingManifest.files.map((file) => ({
              ...file,
              status: "QUEUED",
              errorMessage: null,
            })),
          })
        : createInitialManifest({ ingestionId, userId, clientId, files });

    await putManifest(manifest);

    const payload: StarterInvokePayload = {
      ingestionId,
      userId,
      clientId,
      bucket: getIngestionBucket(),
      manifestKey: buildManifestKey(userId, ingestionId),
      files: manifest.files.map((file) => ({
        clientFileId: file.clientFileId,
        key: file.key,
        name: file.name,
        contentType: file.contentType,
        size: file.size,
      })),
    };

    const lambdaClient = getLambdaClient();
    let invokeResponse: { StatusCode?: number };
    try {
      invokeResponse = await lambdaClient.send(
        new InvokeCommand({
          FunctionName: getStarterLambdaName(),
          InvocationType: "Event",
          Payload: Buffer.from(JSON.stringify(payload)),
        }),
      );
    } catch (invokeError) {
      await markStarterEnqueueFailure(manifest);
      const message = invokeError instanceof Error ? invokeError.message : "Failed to start ingestion workflow.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    if (invokeResponse.StatusCode && invokeResponse.StatusCode >= 400) {
      await markStarterEnqueueFailure(manifest);
      return NextResponse.json({ error: "Failed to start ingestion workflow." }, { status: 502 });
    }

    return NextResponse.json({
      ingestionId,
      status: "QUEUED",
      pollUrl: `/api/ingestion/${ingestionId}/status`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit ingestion.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
