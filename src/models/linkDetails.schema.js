const mongoose = require("mongoose")

const linkDetailsSchema = new mongoose.Schema({
        ipAdress:{
            type:String,
        },
        userId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User"
        },
        userDevice:{
            type:String
        },
        linkId:{
            type:mongoose.Schema.Types.ObjectId,
            required:true
        },
        time:{
            type:Date,
            required:true
        }
},{
    timestamps:true
})

const LinkDetails = mongoose.model("LinkDetails",linkDetailsSchema)

module.exports = LinkDetails