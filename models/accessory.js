const mongoose = require("mongoose");

const AccessorySchema = new mongoose.Schema({
  name: String,
  type: String, // Adapter, Cable, etc.
  rating: Number,
  reviews: [{ user: String, feedback: String, sentiment: String }],
});

module.exports = mongoose.model("Accessory", AccessorySchema);
