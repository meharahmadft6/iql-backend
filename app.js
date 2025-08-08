const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const morgan = require("morgan");

// Route files
const auth = require("./routes/authRoutes");
// const users = require("./routes/userRoutes");

const app = express();

// Body parser
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
// Logger
app.use(morgan("dev"));

// Cookie parser
app.use(cookieParser());

// Enable CORS
app.use(cors());

// Mount routes
app.use("/api/auth", auth);
// app.use("/api/users", users);

// Error handler middleware

module.exports = app;
