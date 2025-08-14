// FIXED AND OPTIMIZED: EXPRESS BACKEND WITH AI RESPONSE + SENSOR + CHATBOT SUPPORT

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: "./cconfig.env" });

const app = express();
const server = "http://localhost";
const port = 8080;

app.use(cors());
app.use(express.json());

// DB CONNECTION
const url = process.env.url ;
mongoose
  .connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Database connected"))
  .catch((err) => console.error("❌ DB Connection Error:", err.message));

// SCHEMAS & MODELS
const sensorschema = new mongoose.Schema(
  {
    temperature: String,
    humidity: String,
    waterLevel: String,
    steam: String,
    light: String,
    soilHumidity: String,
  },
  { timestamps: true }
);
const sensormodel = mongoose.model("sensordata", sensorschema);

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", messageSchema);

const conversationSchema = new mongoose.Schema({
  title: { type: String, default: "New Conversation" },
  updatedAt: { type: Date, default: Date.now },
});
const Conversation = mongoose.model("Conversation", conversationSchema);

// SENSOR ROUTES
app.get("/dht", async (req, res) => {
  try {
    const { data } = await axios.get("http://192.168.43.153/dht");
    res.status(200).json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send sensor data" });
  }
});

app.post("/set", async (_, res) => {
  try {
    const { data } = await axios.get("http://192.168.43.153/dht");
    const sensorData = typeof data === "string" ? JSON.parse(data.match(/\{.*\}/)[0]) : data;
    const converted = Object.fromEntries(Object.entries(sensorData).map(([k, v]) => [k, String(v)]));
    const doc = await sensormodel.create(converted);
    res.status(200).json({ saved: true, data: doc });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/getall", async (req, res) => {
  try {
    const all = await sensormodel.find().sort({ createdAt: -1 });
    res.status(200).json(all);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/delete", async (_, res) => {
  try {
    await sensormodel.deleteMany();
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// CHATBOT: AI RESPONSE HANDLER
const MAX_HISTORY_MESSAGES = 10;

async function getAIResponse({ userMessage, conversationId }) {
  const lowerMsg = userMessage.toLowerCase();
  let sensorContext = "";
const keywords = ["temperature", "humidity", "waterLevel", "steam", "light", "soilHumidity"];

const sensordata = await sensormodel.find({}, keywords.reduce((acc, k) => {
  acc[k] = 1; 
  return acc;
}, {})).lean();
  if (sensordata) {
    try {
      const sensordata = await sensormodel.find({}, keywords.reduce((acc, k) => ((acc[k] = 1), acc), {})).lean();
      sensorContext =  sensordata.map((record, index) => {
  return `Sensor Record #${index + 1}:
${keywords.map(k => `- **${k.charAt(0).toUpperCase() + k.slice(1)}:** ${record[k]}`).join("\n")}
-----------------------------`;
}).join("\n\n");
    } catch (err) {
      console.error("Sensor Fetch Error:", err.message);
      sensorContext = "⚠️ Unable to fetch sensor data right now.";
    }
  }

  const history = conversationId
    ? (await Message.find({ conversationId }).sort({ createdAt: -1 }).limit(MAX_HISTORY_MESSAGES).lean()).reverse()
    : [];
    
    async function searchImageOnUnsplash(query) {
      const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || "PbFWBfo9nPto__QPiEJ84ALs8asqr-kmEVr3H3TkKss";
    
      try {
        console.log(`Searching Unsplash for: "${query}"`);
        const response = await axios.get('https://api.unsplash.com/search/photos', {
          params: {
            query,
            per_page: 1,
            orientation: 'landscape',
          },
          headers: {
            Authorization: `Client-ID ${ACCESS_KEY}`,
          },
        });
    
        console.log("Unsplash API response status:", response.status);
        const results = response.data.results;
        if (results.length > 0) {
          console.log("Unsplash found image:", results[0].urls.regular);
          return results[0].urls.regular;
        } else {
          console.log("No images found on Unsplash for query:", query);
          return null;
        }
      } catch (error) {
        console.error('Unsplash API error:', error.message);
        return null;
      }
    }
    

 const systemMessage = {
  role: "system",
    content: `
You are Fortune's AI assistant, an expert agronomist and sensor analyst. Your task is to analyze the provided sensor data and deliver clear, professional, and structured Markdown responses that help the farmer understand the current state of the soil and environment.

When responding, always include:

---

### 🧪 Sensor Data Summary
- Analyze **soil humidity** to assess soil moisture conditions (e.g., dry, optimal, saturated).
- Evaluate other sensors (temperature, humidity, water level, steam, light) and explain their impact on soil and crop health.
- Identify any abnormalities or important trends in the data.

### 🌱 Soil and Crop Health Analysis
- Based on the sensor readings, provide a detailed analysis of soil condition.
- Recommend suitable farming actions or types of crops best suited for the current conditions (e.g., drought-resistant, moisture-loving).
- Suggest irrigation or environmental adjustments if necessary.

### 🔑 Key Insights and Recommendations
- Bullet-point practical advice for the farmer to improve soil health or respond to sensor conditions.
- Warn about any risks or urgent issues detected by sensor data.

---

### Raw Sensor Data (for reference):

${sensorContext || "(No sensor data provided)"}

---

Your answers should be concise, actionable, and use Markdown formatting with headings, lists, and emphasis to enhance clarity.

### 🖼️ Image Generation Instructions (Critical)

If the user **asks you to generate or provide an image**, do the following:

1. **Search for a real image** matching the user's description on free, reputable image sources like Freepik, Unsplash, or Pexels.
2. **Do NOT generate AI-synthesized images or placeholders.**
3. Return the image as a full HTML \<img\> tag **with valid image URL ending in .jpg, .png, or .jpeg, etc.**
4. The HTML tag **must be exactly like this, with no code block or backticks**:

<img src="ACTUAL_IMAGE_URL" alt="Concise descriptive alt text" style="max-width: 100%; height: auto;" />

5. **Replace ACTUAL_IMAGE_URL and alt text appropriately for the image.**

6. **Do NOT return only the URL or markdown image syntax!**

7. Ensure the image is relevant and visually clear for the description.

---

### Example:

User prompt: "Generate an image of a man drinking medicine."

You respond with:

<img src="https://img.freepik.com/free-photo/sick-man-with-cold-drinking-medicine-tablets_23-2148440306.jpg" alt="Man drinking medicine" style="max-width: 100%; height: auto;" />

---

Keep your language concise, formal, and informative. Avoid verbosity and repetition.

`
};


  const messages = [systemMessage, ...history.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: userMessage }];

  try {
    const { data } = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      { model: process.env.MODEL_ID, messages },
      {
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    const reply = data.choices?.[0]?.message?.content || "⚠️ No response received.";

    if (conversationId) {
      await Message.insertMany([
        { conversationId, role: "user", content: userMessage },
        { conversationId, role: "assistant", content: reply },
      ]);
      await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });
    }

    return reply;
  } catch (err) {
    console.error("AI Error:", err.response?.data || err.message);
    return "🚫 Failed to get AI response. Try again later.";
  }
}

// CONVERSATION ROUTES
app.post("/conversations", async (_, res) => {
  try {
    const convo = await Conversation.create({});
    res.status(201).json(convo);
  } catch (err) {
    res.status(500).json({ message: "Failed to create conversation" });
  }
});

app.get("/conversations", async (_, res) => {
  try {
    const all = await Conversation.find().sort({ updatedAt: -1 });
    res.status(200).json(all);
  } catch (err) {
    res.status(500).json({ message: "Failed to get conversations" });
  }
});

app.get("/messages/:conversationId", async (req, res) => {
  try {
    const msgs = await Message.find({ conversationId: req.params.conversationId }).sort({ createdAt: 1 });
    res.status(200).json(msgs);
  } catch (err) {
    res.status(500).json({ message: "Failed to get messages" });
  }
});

app.post("/", async (req, res) => {
  try {
    const { userMessage, conversationId } = req.body;
    if (!userMessage || !conversationId) return res.status(400).json({ message: "Missing fields" });
    const reply = await getAIResponse({ userMessage, conversationId });
    res.status(200).json({ message: reply });
  } catch (err) {
    console.error("Chatbot Error:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/conversations", async (_, res) => {
  try {
    await Message.deleteMany();
    await Conversation.deleteMany();
    res.status(200).json({ message: "All conversations deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete conversations" });
  }
});


const versionInfo = {
    latestVersion: "1.2.0",
    downloadUrl: "https://yourserver.com/MyAppSetup.exe"
};


app.get('/version', (req, res) => {
    res.json(versionInfo);
});

// START SERVER
app.listen(port, () => {
  console.log(`🚀 Server running at ${server}:${port}`);

});
