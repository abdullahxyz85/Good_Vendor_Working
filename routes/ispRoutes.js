require("dotenv").config(); // Load environment variables

const express = require("express");
const ISP = require("../models/isp");
const axios = require("axios");
const router = express.Router();
const OpenAI = require("openai");

// Load API keys from environment variables
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const AIML_API_KEY = process.env.AIML_API_KEY;

// Get all ISPs (with error handling)
router.get("/", async (req, res) => {
  try {
    const isps = await ISP.find();
    res.json(isps);
  } catch (error) {
    console.error("Error fetching ISPs:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Add an ISP (with validation)
router.post("/", async (req, res) => {
  try {
    console.log("Received Data:", req.body); // Debugging log

    // Validate required fields
    if (
      !req.body.name ||
      !req.body.speed ||
      !req.body.cost ||
      !req.body.coverageArea
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newISP = new ISP(req.body);
    await newISP.save();
    res.json({ message: "ISP added successfully" });
  } catch (error) {
    console.error("Error adding ISP:", error); // Show exact error
    res.status(500).json({ error: error.message }); // Send error details to Postman
  }
});

// Add Review with AI Sentiment Analysis
router.post("/:id/review", async (req, res) => {
  try {
    const { user, feedback } = req.body;
    if (!user || !feedback) {
      return res.status(400).json({ error: "User and feedback are required" });
    }

    const isp = await ISP.findById(req.params.id);
    if (!isp) return res.status(404).json({ error: "ISP not found" });

    // AI Sentiment Analysis
    const sentiment = await analyzeSentiment(feedback);
    isp.reviews.push({ user, feedback, sentiment });
    await isp.save();
    res.json({ message: "Review added successfully", sentiment });
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).json({ error: "Failed to add review" });
  }
});

// Initialize OpenAI-like API with aimlapi.com
const api = {
  baseURL: "https://api.aimlapi.com/v1",
  apiKey: process.env.AIML_API_KEY, // Set this in your .env file
};

router.post("/recommend", async (req, res) => {
  try {
    const { speed, cost } = req.body;

    // Validate input
    if (!speed || !cost || isNaN(speed) || isNaN(cost)) {
      return res.status(400).json({ error: "Invalid speed or cost values" });
    }

    // Define AI prompt
    const prompt = `Recommend the best ISP for a user needing ${speed} Mbps speed and a budget of $${cost}.`;

    // Make request to aimlapi.com
    const response = await axios.post(
      `${api.baseURL}/chat/completions`,
      {
        model: "o1", // Using the "o1" model
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
      },
      {
        headers: { Authorization: `Bearer ${api.apiKey}` }, // Include API key in headers
      }
    );

    // Send response
    res.json({ recommendation: response.data.choices[0].message.content });
  } catch (error) {
    console.error("AI Recommendation Error:", error);
    res.status(500).json({ error: "Failed to get AI recommendation" });
  }
});

// ISP Coverage using FCC Broadband API
// AI API Configuration
router.get("/coverage/:location", async (req, res) => {
  try {
    const { location } = req.params;

    if (!location) {
      return res.status(400).json({ error: "Please provide a location." });
    }

    const prompt = `List all ISPs available in ${location}. Provide details including:  
      - ISP Name  
      - Internet Type (Fiber, DSL, Cable)  
      - Speed Range (Mbps)  
      - Price Range (if available).`;

    const response = await axios.post(
      `${api.baseURL}/chat/completions`,
      {
        model: "meta-llama/Llama-3.2-3B-Instruct-Turbo",
        // model: "meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
      },
      {
        headers: { Authorization: `Bearer ${api.apiKey}` },
      }
    );

    const aiResponse = response.data.choices[0]?.message?.content?.trim();

    if (!aiResponse) {
      return res.json({
        coverage: "No ISP data found for this location. Try another location.",
      });
    }

    res.json({ coverage: aiResponse });
  } catch (error) {
    console.error(
      "AI ISP Coverage Error:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to get ISP coverage information" });
  }
});

// Speed Test API
// AI-Based Speed Test Route
router.get("/speed-test", async (req, res) => {
  try {
    // Prepare AI Prompt
    const prompt = `Predict the internet speed for a typical user based on historical data:
        - What is the estimated ping, download, and upload speed?
        - How does it compare to global averages?
        - Provide recommendations for improving speed.`;

    // Call AI Model to Predict and Analyze Speed Data
    const aiResponse = await axios.post(
      `${api.baseURL}/chat/completions`,
      {
        // model: "o1", // Use GPT-4 Turbo, DeepSeek-LLM, or any AI model
        model: "deepseek-ai/deepseek-llm-67b-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
      },
      {
        headers: { Authorization: `Bearer ${api.apiKey}` },
      }
    );

    const aiAnalysis = aiResponse.data.choices[0]?.message?.content?.trim();

    // Send Response
    res.json({
      aiSpeedTest: aiAnalysis || "AI could not predict speed test data.",
    });
  } catch (error) {
    console.error(
      "AI Speed Test Error:",
      error.response?.data || error.message
    );
    res
      .status(500)
      .json({ error: "Failed to predict and analyze speed test data" });
  }
});

// Function to call AI/ML API (O1 Model)
async function analyzeSentiment(text) {
  try {
    const response = await axios.post(
      process.env.AI_ML_API_URL, // Using AI/ML API URL from .env file
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer ${process.env.AI_ML_API_KEY}`, // AI/ML API key from .env
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data || !response.data[0] || !response.data[0].label) {
      throw new Error("Invalid sentiment analysis response");
    }

    return response.data[0].label; // Expected to return "positive", "neutral", or "negative"
  } catch (error) {
    console.error(
      "Sentiment Analysis Error:",
      error.response?.data || error.message
    );
    return "neutral"; // Default fallback
  }
}

// Define API Endpoint
router.post("/analyze-sentiment", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required for analysis" });
    }

    const sentiment = await analyzeSentiment(text);
    res.json({ sentiment });
  } catch (error) {
    console.error("Sentiment Analysis Error:", error);
    res.status(500).json({ error: "Failed to analyze sentiment" });
  }
});

module.exports = router;
