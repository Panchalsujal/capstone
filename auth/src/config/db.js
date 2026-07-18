import mongoose from "mongoose";
import { config } from "./config.js"

export const connectDB = async () => {
    await mongoose.connect(config.MONGO_URI).then(() => {
        console.log("Connected to mongodb")
    })
}




