import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";
import { getIngestionBucket, getS3Client } from "@/lib/aws/clients";
import { getIngestionActor } from "@/lib/ingestion/auth";
import { buildTempObjectKey } from "@/lib/ingestion/s3-keys";
import type { IngestionFileInput } from "@/lib/ingestion/validation";
import { validateFiles } from "@/lib/ingestion/validation";

const PRESIGN_EXPIRY_SECONDS = 60 * 10;

interface PresignRequestBody {
  files: IngestionFileInput[];
}

export const runtime = "nodejs";

function withOrdinalSuffix(fileName: string, ordinal: number): string {
  if (ordinal <= 1) {
    return fileName;
  }

  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === fileName.length - 1) {
    return `${fileName}-${ordinal}`;
  }

  const baseName = fileName.slice(0, lastDot);
  const extension = fileName.slice(lastDot);
  return `${baseName}-${ordinal}${extension}`;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getIngestionActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const userId = actor.user.id;

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
    const usedKeys = new Set<string>();

    const uploads = await Promise.all(
      files.map(async (file) => {
        let key = buildTempObjectKey(userId, ingestionId, file.clientFileId, file.name);
        let ordinal = 1;

        while (usedKeys.has(key)) {
          ordinal += 1;
          key = buildTempObjectKey(
            userId,
            ingestionId,
            file.clientFileId,
            withOrdinalSuffix(file.name, ordinal),
          );
        }
        usedKeys.add(key);

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
