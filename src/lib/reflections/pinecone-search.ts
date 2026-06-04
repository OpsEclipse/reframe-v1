import { Pinecone } from "@pinecone-database/pinecone";
import { buildPineconeNamespace } from "@/lib/entries/embedding-index";
import { getPineconeNamespacePrefix } from "@/lib/entries/embedding-clients";

let pineconeClient: Pinecone | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: getRequiredEnv("PINECONE_API_KEY"),
    });
  }

  return pineconeClient;
}

export interface RelatedEntryMatch {
  entryId: string;
  score: number;
  s3Key: string | null;
  entryDate: string | null;
}

export async function searchRelatedEntriesByVectorId(params: {
  userId: string;
  primaryEntryId: string;
  vectorId: string;
  topK?: number;
}): Promise<RelatedEntryMatch[]> {
  const index = getPineconeClient().index(getRequiredEnv("PINECONE_INDEX_NAME"));
  const namespace = buildPineconeNamespace(
    params.userId,
    getPineconeNamespacePrefix(),
  );

  const result = await index.namespace(namespace).query({
    id: params.vectorId,
    topK: params.topK ?? 9,
    includeMetadata: true,
    includeValues: false,
  });

  return (result.matches ?? [])
    .map((match) => {
      const metadata = match.metadata as Record<string, unknown> | undefined;
      const entryId = typeof metadata?.entry_id === "string" ? metadata.entry_id : null;
      const s3Key = typeof metadata?.s3_key === "string" ? metadata.s3_key : null;
      const entryDate =
        typeof metadata?.entry_date === "string" && metadata.entry_date
          ? metadata.entry_date
          : null;

      if (!entryId || entryId === params.primaryEntryId) return null;

      return {
        entryId,
        s3Key,
        entryDate,
        score: typeof match.score === "number" ? match.score : 0,
      };
    })
    .filter((match): match is RelatedEntryMatch => match !== null)
    .slice(0, 8);
}
