import mongoose from 'mongoose'
import {config} from './config.js'

export async function connectToDb() {
    await mongoose.connect(config.SANDBOX).then(()=>{
        console.log("Sandbox connect to Db");
        
    })
}