const User = require("../models/user.schema")
const JWT = require("jsonwebtoken")
require("dotenv").config()


async function userAuth(req, res, next) {
  try {
    const token  = req.headers.authorization;
    if (!token) {
      throw new Error("invalid token");
    }
    
    const isValidUser = JWT.verify(token,process.env.SECRET)
    const {email} = isValidUser


    const user = await User.findOne({email})
    if(!user){
      return res.status(404).send("User not found");
    }
    req.user = user
    next()
  } catch (error) {
    res.status(400).send("Error: " + error.message);
  }
}


module.exports = userAuth;