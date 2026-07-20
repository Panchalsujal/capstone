import dotenv from "dotenv";
dotenv.config();

if (!process.env.SANDBOX) {
  throw new Error("SANDBOX Uri is not defined in the environment variables");
}
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in the environment variables");
}
if (!process.env.REDIS_URL) {
  throw new Error(
    "REDIS_URL is not defined in the environment variables",
  );
}

export const config = {
  JWT_SECRET: process.env.JWT_SECRET,
  REDIS_URL:process.env.REDIS_URL,
  SANDBOX:process.env.SANDBOX
};
