import mongoose from "mongoose";
import { config } from "./config.js"

export const connectDB = async () => {
    try {
        await mongoose.connect(config.MONGO_URI)
        console.log("Connected to MongoDB")
    } catch (err) {
        console.error("Failed to connect to MongoDB:", err.message)
        process.exit(1)
    }
}





