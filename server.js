// KrishiMitra AI – Backend Server (Node.js + Express)
// Run: npm install && node server.js

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 5000;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// File upload setup (multer)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// ─── MOCK DATABASE (JSON-based farmer profiles) ───────────────────────────────
const DB_FILE = "db.json";
function readDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ farmers: [] }));
  return JSON.parse(fs.readFileSync(DB_FILE));
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ─── RULE-BASED PREDICTION ENGINE ────────────────────────────────────────────
// Core logic: evaluates weather + soil data and returns risk levels
function predictRisks(weatherData) {
  const { humidity, temp, wind, rain } = weatherData;
  const alerts = [];

  // Rule 1: Fungal disease risk
  if (humidity > 80 && temp > 25) {
    alerts.push({
      type: "FUNGAL_HIGH",
      severity: "HIGH",
      message: "फफूंद रोग का उच्च खतरा – नीम तेल छिड़काव करें",
      action: "Spray neem oil 5ml/L, repeat after 3 days",
      icon: "🍄",
    });
  } else if (humidity > 65 && temp > 20) {
    alerts.push({
      type: "FUNGAL_MEDIUM",
      severity: "MEDIUM",
      message: "फफूंद रोग का मध्यम खतरा – निगरानी रखें",
      action: "Monitor daily, keep field drainage clear",
      icon: "🍄",
    });
  }

  // Rule 2: Pest risk based on temperature
  if (temp > 30 && humidity < 40) {
    alerts.push({
      type: "PEST_APHID",
      severity: "HIGH",
      message: "माहू कीट का खतरा – शुष्क गर्म मौसम में तेजी से बढ़ता है",
      action: "Apply imidacloprid 0.5ml/L or neem oil",
      icon: "🐛",
    });
  }

  // Rule 3: Rain-based irrigation alert
  if (rain > 50) {
    alerts.push({
      type: "RAIN_ALERT",
      severity: "INFO",
      message: "भारी वर्षा की संभावना – सिंचाई बंद रखें",
      action: "Stop irrigation, ensure field drainage",
      icon: "🌧️",
    });
  }

  // Rule 4: Frost risk
  if (temp < 5) {
    alerts.push({
      type: "FROST_RISK",
      severity: "CRITICAL",
      message: "पाला पड़ने का खतरा – फसल को ढकें",
      action: "Cover crops with plastic sheets, light irrigation at night",
      icon: "❄️",
    });
  }

  return alerts;
}

// ─── CROP DISEASE MOCK CLASSIFIER ────────────────────────────────────────────
// In production: replace with TensorFlow Serving or Plant.id API
function classifyDisease(filename) {
  // Simulates image classification based on filename hints
  const diseases = [
    {
      name: "पर्ण कुंचन (Leaf Curl Virus)",
      confidence: Math.random() * 20 + 75, // 75-95%
      severity: "मध्यम",
      treatment: "Imida
      cloprid 17.8 SL @ 0.5ml/L + नीम अर्क",
      prevention: "Use virus-resistant varieties, control whitefly vectors",
    },
    {
      name: "भूरा धब्बा (Brown Spot)",
      confidence: Math.random() * 25 + 55, // 55-80%
      severity: "हल्का",
      treatment: "Mancozeb 75 WP @ 2g/L, 2-3 sprays at 10-day intervals",
      prevention: "Balanced fertilization, avoid excess nitrogen",
    },
  ];
  return diseases;
}

// ─── API ROUTES ───────────────────────────────────────────────────────────────

// GET /health – health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", version: "1.0.0", name: "KrishiMitra API" });
});

// POST /chat – AI chatbot (proxies to OpenAI/Claude)
// In the React frontend we call Claude API directly for the prototype.
// This endpoint can be used for server-side rate limiting / auth in production.
app.post("/chat", async (req, res) => {
  try {
    const { message, farmerProfile } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    // Example: Call OpenAI (uncomment and add your key in production)
    // const response = await openai.chat.completions.create({ ... });

    // Mock response for demo:
    const mockReplies = [
      "आपकी फसल के लिए आज नीम तेल का छिड़काव करें। 5ml प्रति लीटर पानी में मिलाएं। 🌿",
      `${farmerProfile?.location || "आपके क्षेत्र"} में कल बारिश की संभावना है, सिंचाई टालें। 🌧️`,
      "गेहूं की HD-2967 किस्म आपके क्षेत्र के लिए सबसे उपयुक्त है। 🌾",
    ];
    const reply = mockReplies[Math.floor(Math.random() * mockReplies.length)];
    res.json({ reply, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: "Chat service error", details: err.message });
  }
});

// POST /predict – pest/disease prediction (rule-based AI)
app.post("/predict", (req, res) => {
  try {
    const { humidity, temp, wind = 10, rain = 0, crop } = req.body;
    if (humidity == null || temp == null) {
      return res.status(400).json({ error: "humidity and temp are required" });
    }

    const alerts = predictRisks({ humidity, temp, wind, rain });
    const overallRisk = alerts.some(a => a.severity === "HIGH" || a.severity === "CRITICAL")
      ? "HIGH" : alerts.some(a => a.severity === "MEDIUM") ? "MEDIUM" : "LOW";

    res.json({
      crop: crop || "Unknown",
      weatherInput: { humidity, temp, wind, rain },
      overallRisk,
      alerts,
      generatedAt: new Date().toISOString(),
      recommendation: overallRisk === "HIGH"
        ? "तुरंत कार्रवाई आवश्यक है"
        : overallRisk === "MEDIUM"
        ? "सावधानी बरतें और निगरानी करें"
        : "स्थिति सामान्य है",
    });
  } catch (err) {
    res.status(500).json({ error: "Prediction error", details: err.message });
  }
});

// POST /upload – image upload + disease detection
app.post("/upload", upload.single("image"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    // Run mock disease classification
    const diseases = classifyDisease(req.file.filename);
    const primaryDisease = diseases[0];

    res.json({
      imageUrl: `/uploads/${req.file.filename}`,
      filename: req.file.filename,
      size: req.file.size,
      detectedDiseases: diseases,
      primaryDisease: primaryDisease.name,
      confidence: primaryDisease.confidence.toFixed(1),
      overallSeverity: primaryDisease.severity,
      recommendation: primaryDisease.treatment,
      prevention: primaryDisease.prevention,
      analyzedAt: new Date().toISOString(),
      note: "This is a mock classifier. Integrate Plant.id or TF Serving for production.",
    });
  } catch (err) {
    res.status(500).json({ error: "Upload/analysis error", details: err.message });
  }
});

// GET /weather – fetch weather data
app.get("/weather", async (req, res) => {
  try {
    const { city = "Pune" } = req.query;

    // In production: fetch from OpenWeatherMap API
    // const apiKey = process.env.WEATHER_API_KEY;
    // const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric&lang=hi`;
    // const data = await fetch(url).then(r => r.json());

    // Mock response:
    const mockWeather = {
      city, temp: 28, humidity: 74, wind: 12,
      condition: "Partly Cloudy", conditionHindi: "आंशिक बादल",
      feelsLike: 30, uvIndex: 6,
      forecast: [
        { day: "आज", high: 30, low: 22, rainChance: 20, icon: "⛅" },
        { day: "कल", high: 26, low: 20, rainChance: 75, icon: "🌧️" },
        { day: "परसों", high: 27, low: 21, rainChance: 55, icon: "🌦️" },
      ],
      pestRisk: predictRisks({ humidity: 74, temp: 28, wind: 12, rain: 20 }),
    };

    res.json(mockWeather);
  } catch (err) {
    res.status(500).json({ error: "Weather fetch error", details: err.message });
  }
});

// POST /profit – calculate crop profit
app.post("/profit", (req, res) => {
  try {
    const { crop, area, costPerHectare, revenuePerHectare } = req.body;
    if (!area) return res.status(400).json({ error: "area is required" });

    // Predefined crop data (can be fetched from agri market APIs)
    const CROP_DATA = {
      wheat:     { cost: 18000, revenue: 32000, yield: "40 q/ha", season: "Rabi" },
      rice:      { cost: 22000, revenue: 38000, yield: "50 q/ha", season: "Kharif" },
      soybean:   { cost: 14000, revenue: 28000, yield: "25 q/ha", season: "Kharif" },
      cotton:    { cost: 28000, revenue: 55000, yield: "20 q/ha", season: "Kharif" },
      sugarcane: { cost: 35000, revenue: 70000, yield: "800 q/ha", season: "Annual" },
    };

    const cropKey = crop?.toLowerCase() || "wheat";
    const base = CROP_DATA[cropKey] || {
      cost: costPerHectare || 20000,
      revenue: revenuePerHectare || 35000,
    };

    const areaInHectares = area * 0.4047; // acres to hectares
    const totalCost = base.cost * areaInHectares;
    const totalRevenue = base.revenue * areaInHectares;
    const profit = totalRevenue - totalCost;
    const roi = ((profit / totalCost) * 100).toFixed(1);

    res.json({
      crop: cropKey, area, areaInHectares: areaInHectares.toFixed(2),
      costPerHectare: base.cost, revenuePerHectare: base.revenue,
      totalCost: Math.round(totalCost), totalRevenue: Math.round(totalRevenue),
      profit: Math.round(profit), roi: `${roi}%`,
      yield: base.yield, season: base.season,
      breakeven: `${((base.cost / base.revenue) * 100).toFixed(1)}% of expected revenue`,
    });
  } catch (err) {
    res.status(500).json({ error: "Profit calc error", details: err.message });
  }
});

// GET/POST /farmer – farmer profile CRUD
app.get("/farmer/:id", (req, res) => {
  const db = readDB();
  const farmer = db.farmers.find(f => f.id === req.params.id);
  if (!farmer) return res.status(404).json({ error: "Farmer not found" });
  res.json(farmer);
});

app.post("/farmer", (req, res) => {
  const db = readDB();
  const farmer = {
    id: `F${Date.now()}`,
    ...req.body,
    createdAt: new Date().toISOString(),
    history: [],
  };
  db.farmers.push(farmer);
  writeDB(db);
  res.status(201).json({ message: "Farmer profile created", farmer });
});

app.put("/farmer/:id", (req, res) => {
  const db = readDB();
  const idx = db.farmers.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Farmer not found" });
  db.farmers[idx] = { ...db.farmers[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeDB(db);
  res.json({ message: "Profile updated", farmer: db.farmers[idx] });
});

// ─── IVR SIMULATION ENDPOINT ──────────────────────────────────────────────────
// Concept: Farmer calls a missed-call number → system calls back with voice alert
// In production: Integrate with Twilio or Exotel IVR
app.post("/ivr/missed-call", (req, res) => {
  const { phone } = req.body;
  // Simulate: fetch farmer profile, generate personalized voice message
  const voiceScript = `
    नमस्ते! यह KrishiMitra AI है।
    आज के मौसम की जानकारी: तापमान 28°C, आर्द्रता 74%।
    कल भारी बारिश की संभावना है।
    सिंचाई बंद रखें और फसल की सुरक्षा करें।
    अधिक जानकारी के लिए 1 दबाएं।
  `.trim();

  res.json({
    status: "CALLBACK_QUEUED",
    phone,
    voiceScript,
    language: "hi-IN",
    estimatedCallTime: "2 minutes",
    note: "In production: integrate with Twilio/Exotel for actual voice callback",
    twilioCode: `
// Twilio integration example:
// client.calls.create({
//   twiml: \`<Response><Say language="hi-IN">${voiceScript}</Say></Response>\`,
//   to: phone,
//   from: process.env.TWILIO_PHONE,
// });
    `,
  });
});


// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌾 KrishiMitra API running at http://localhost:${PORT}`);
  console.log(`📡 Endpoints: /chat /predict /upload /weather /profit /farmer`);
  console.log(`📞 IVR endpoint: POST /ivr/missed-call\n`);
});
