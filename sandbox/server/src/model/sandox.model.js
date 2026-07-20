import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        required:true
    },
    title:{
        type:String,
        default:"Untitled Project"
    }

},{timestamps:true})

const prodoctModel = mongoose.model("product",productSchema)

export default prodoctModel