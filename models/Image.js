// models/Image.js
import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
  originalName: String,
  filename: String,
  username: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  }, 
  path: String,
  size: Number,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Image", imageSchema);