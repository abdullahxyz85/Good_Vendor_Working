require("dotenv").config(); // Load environment variables

const express = require("express");
const ISP = require("../models/isp");
const axios = require("axios");
const router = express.Router();

// Load API keys from environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const FCC_BROADBAND_API = "https://broadbandmap.fcc.gov/home";

// Get all ISPs
router.get("/", async (req, res) => {
  const isps = await ISP.find();
  res.json(isps);
});

// Add an ISP
router.post("/", async (req, res) => {
  const newISP = new ISP(req.body);
  await newISP.save();
  res.json({ message: "ISP added successfully" });
});

// Add Review with AI Sentiment Analysis
router.post("/:id/review", async (req, res) => {
  const { user, feedback } = req.body;
  const isp = await ISP.findById(req.params.id);
  if (!isp) return res.status(404).json({ error: "ISP not found" });

  // AI Sentiment Analysis
  const sentiment = await analyzeSentiment(feedback);
  isp.reviews.push({ user, feedback, sentiment });
  await isp.save();
  res.json({ message: "Review added successfully", sentiment });
});

// AI-Based ISP Recommendation System
router.post("/recommend", async (req, res) => {
  const { speed, cost } = req.body;
  const prompt = `Suggest the best ISP with at least ${speed} Mbps speed and cost below $${cost}.`;
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/completions",
      {
        model: "gpt-4",
        prompt,
        max_tokens: 50,
      },
      {
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      }
    );
    res.json({ recommendation: response.data.choices[0].text });
  } catch (error) {
    res.status(500).json({ error: "Failed to get AI recommendation" });
  }
});

// ISP Coverage using FCC Broadband API
router.get("/coverage/:location", async (req, res) => {
  const location = req.params.location;
  try {
    const response = await axios.get(
      `${FCC_BROADBAND_API}/search?address=${location}`
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch coverage data" });
  }
});

// Speed Test API (NEWLY ADDED ROUTE)
router.get("/speed-test", async (req, res) => {
  try {
    const response = await axios.get(
      "https://www.speedtest.net/api/js/servers?engine=js"
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch speed test data" });
  }
});

// Sentiment Analysis Function using Hugging Face API
async function analyzeSentiment(text) {
  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment",
      { inputs: text },
      {
        headers: { Authorization: `Bearer ${HUGGINGFACE_API_KEY}` },
      }
    );
    const labels = ["negative", "neutral", "positive"];
    return labels[response.data[0].label];
  } catch (error) {
    console.error("Sentiment Analysis Error:", error);
    return "neutral";
  }
}

module.exports = router;
