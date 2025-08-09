// app.js
require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const morgan = require("morgan");

// Route files
const auth = require("./routes/authRoutes");

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger
app.use(morgan("dev"));

// Cookie parser
app.use(cookieParser());

// Enable CORS — allow your Vercel frontend
app.use(
  cors({
    origin: [
      "http://localhost:3001",
      "https://infinityquotientlearning.vercel.app",
      "https://infinityquotientlearning.com/",
    ],
    credentials: true,
  })
);

// Root test route
app.get("/", (req, res) => {
  res.send("Hello welcome to Infinite Quotient Learning");
});

// Mount routes
app.use("/api/auth", auth);

// Export app (no app.listen here)
module.exports = app;
