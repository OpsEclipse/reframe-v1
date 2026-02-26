import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { getIngestionBucket, getS3Client } from "@/lib/aws/clients";
import { buildTempObjectKey } from "@/lib/ingestion/s3-keys";
import type { IngestionFileInput } from "@/lib/ingestion/validation";
import { isValidClientId, validateFiles } from "@/lib/ingestion/validation";

const PRESIGN_EXPIRY_SECONDS = 60 * 10;

interface PresignRequestBody {
  files: IngestionFileInput[];
}

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const clientId = request.headers.get("x-client-id")?.trim();
    if (!clientId || !isValidClientId(clientId)) {
      return NextResponse.json({ error: "Invalid x-client-id header." }, { status: 400 });
    }

    const body = (await request.json()) as PresignRequestBody;
    const files = body?.files;

    const validationError = validateFiles(files);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const deduped = new Set<string>();
    for (const file of files) {
      if (deduped.has(file.clientFileId)) {
        return NextResponse.json(
          { error: `Duplicate clientFileId provided: ${file.clientFileId}` },
          { status: 400 },
        );
      }
      deduped.add(file.clientFileId);
    }

    const ingestionId = crypto.randomUUID();
    const s3 = getS3Client();
    const bucket = getIngestionBucket();

    const uploads = await Promise.all(
      files.map(async (file) => {
        const key = buildTempObjectKey(clientId, ingestionId, file.clientFileId, file.name);
        const putUrl = await getSignedUrl(
          s3,
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: file.contentType,
          }),
          { expiresIn: PRESIGN_EXPIRY_SECONDS },
        );

        return {
          clientFileId: file.clientFileId,
          key,
          putUrl,
          expiresInSeconds: PRESIGN_EXPIRY_SECONDS,
        };
      }),
    );

    return NextResponse.json({ ingestionId, uploads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create upload URLs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
