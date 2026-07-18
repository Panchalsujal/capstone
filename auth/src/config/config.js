import dotenv from "dotenv";
dotenv.config();

if (!process.env.AUTH_MONGO_URI) {
  throw new Error("MONGO_URI is not defined in the environment variables");
}
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in the environment variables");
}
if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error(
    "GOOGLE_CLIENT_ID is not defined in the environment variables",
  );
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error(
    "GOOGLE_CLIENT_SECRET is not defined in the environment variables",
  );
}

export const config = {
  MONGO_URI: process.env.AUTH_MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
};
