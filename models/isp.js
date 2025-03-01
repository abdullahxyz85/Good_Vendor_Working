const mongoose = require("mongoose");

const ISP_Schema = new mongoose.Schema({
  name: String,
  speed: Number,
  reliability: Number,
  cost: Number,
  coverageArea: String, // Store city or region
  rating: Number,
  reviews: [{ user: String, feedback: String, sentiment: String }],
});

module.exports = mongoose.model("ISP", ISP_Schema);
