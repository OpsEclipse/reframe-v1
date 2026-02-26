import { LambdaClient } from "@aws-sdk/client-lambda";
import { S3Client } from "@aws-sdk/client-s3";

let s3Client: S3Client | null = null;
let lambdaClient: LambdaClient | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getAwsRegion(): string {
  return getRequiredEnv("AWS_REGION");
}

export function getIngestionBucket(): string {
  return getRequiredEnv("AWS_INGESTION_BUCKET");
}

export function getStarterLambdaName(): string {
  return getRequiredEnv("AWS_STARTER_LAMBDA_NAME");
}

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({ region: getAwsRegion() });
  }
  return s3Client;
}

export function getLambdaClient(): LambdaClient {
  if (!lambdaClient) {
    lambdaClient = new LambdaClient({ region: getAwsRegion() });
  }
  return lambdaClient;
}
