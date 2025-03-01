const express = require("express");
const Accessory = require("../models/accessory");
const router = express.Router();

// Get all accessories
router.get("/", async (req, res) => {
  const accessories = await Accessory.find();
  res.json(accessories);
});

// Add an accessory
router.post("/", async (req, res) => {
  const newAccessory = new Accessory(req.body);
  await newAccessory.save();
  res.json({ message: "Accessory added successfully" });
});

// Add a review with AI sentiment analysis
router.post("/:id/review", async (req, res) => {
  const { user, feedback } = req.body;
  const accessory = await Accessory.findById(req.params.id);
  if (!accessory) return res.status(404).json({ error: "Accessory not found" });

  // AI Sentiment Analysis
  const sentiment = await analyzeSentiment(feedback);
  accessory.reviews.push({ user, feedback, sentiment });
  await accessory.save();

  res.json({ message: "Review added successfully", sentiment });
});

module.exports = router;
