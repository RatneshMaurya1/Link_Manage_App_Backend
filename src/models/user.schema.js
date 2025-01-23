const mongoose = require("mongoose");

const getISTTime = () => {
  const offset = 5.5 * 60 * 60 * 1000; 
  return new Date(Date.now() + offset).toISOString();
};

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone:{
        type: Number,
        required: true,
        trim: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: {
      currentTime: getISTTime,
    },
  }
);

const User = mongoose.model("User", userSchema);
module.exports = User;