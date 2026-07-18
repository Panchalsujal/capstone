import dotenv from "dotenv";
dotenv.config();

if (!process.env.EMAIL_USER) {
  throw new Error("EMAIL_USER is not defined in the environment variables");
}
if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error(
    " GOOGLE_CLIENT_IDis not defined in the environment variables",
  );
}

if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error(
    "GOOGLE_CLIENT_SECRETis not defined in the environment variables",
  );
}

if (!process.env.EMAIL_USER) {
  throw new Error("EMAIL_USER is not defined in the environment variables");
}

if (!process.env.EMAIL_USER) {
  throw new Error("EMAIL_USER is not defined in the environment variables");
}

if (!process.env.EMAIL_USER) {
  throw new Error("EMAIL_USER is not defined in the environment variables");
}

if (!process.env.EMAIL_USER) {
  throw new Error("EMAIL_USER is not defined in the environment variables");
}

export const config = {
  EMAIL_USER: process.env.EMAIL_USER,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
};
