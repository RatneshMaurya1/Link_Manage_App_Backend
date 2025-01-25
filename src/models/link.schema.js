const mongoose = require("mongoose")

const LinkSchema= new mongoose.Schema({
    originalLink:{
        type:String,
        required:true,
        trim:true
    },
    shortLink:{
        type:String,
        required:true,
    },
    remark:{
        type:String,
        required:true,
    },
    expire:{
        type:Date,
    },
    ipAdress:{
        type:String,
    },
    count:{
        type:Number,
        default:0
    },
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    },
    userDevice:{
        type:String
    }
},{
    timestamps:true
})

const Link = mongoose.model("Link",LinkSchema)
module.exports = Link