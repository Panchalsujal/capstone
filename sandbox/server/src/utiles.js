import jwt from "jsonwebtoken";
import { config } from "./config/config.js";

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch (error) {
    console.error("Token verification Error", error);

    return null;
  }
}
