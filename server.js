const express = require("express");
const cors = require("cors");
const axios = require("axios");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: "./cconfig.env" });

const app = express();


const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Database connected"))
  .catch((err) => console.error("❌ DB Connection Error:", err.message));

app.get("/dht", async (req, res) => {
  try {
    const { data } = await axios.get("http://192.168.43.153/dht");
    res.status(200).json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send sensor data" });
  }
});


const versionInfo = {
    latestVersion: "1.2.0",

    downloadUrl: "https://raw.githubusercontent.com/liblissz/languageApp/main/setup.exe"
};

app.get('/version', (req, res) => {
    res.json(versionInfo);
});

// START SERVER
app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Server running at http://0.0.0.0:${port}`);
});
