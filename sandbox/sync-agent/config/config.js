import dotenv from "dotenv";
dotenv.config();

if (!process.env.AWS_REGION) {
  throw new Error("AWS_REGION is not defined in the environment variables");  
}

if (!process.env.AWS_ACCESS_KEY_ID) {
  throw new Error("AWS_ACCESS_KEY_ID is not defined in the environment variables");
  
}

if (!process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error(
    "AWS_SECRET_ACCESS_KEY is not defined in the environment variables",
  );
}
if (!process.env.BUCKET_NAME) {
  throw new Error(
    "BUCKET_NAME is not defined in the environment variables",
  );
}
// PROJECT_ID is intentionally not validated here — warm pool pods start without
// it and receive it later via POST /activate on the sync-agent HTTP server.

export const config = {
  AWS_REGION: process.env.AWS_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  BUCKET_NAME: process.env.BUCKET_NAME,
  PROJECT_ID: process.env.PROJECT_ID,
};