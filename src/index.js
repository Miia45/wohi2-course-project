
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const questionsRouter = require("./routes/questions"); 
const prisma = require("./lib/prisma");
const authRouter = require("./routes/auth");
const path = require("path");

app.use(express.static(path.join(__dirname, "..", "public")));

// Middleware to parse JSON bodies 
app.use(express.json());

// Routes
app.use("/api/auth", authRouter);
app.use("/api/questions", questionsRouter);

app.use((req, res) => {
  res.json({msg: "Not found"});
})

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

