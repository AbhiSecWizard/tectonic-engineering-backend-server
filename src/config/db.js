const mongoose = require("mongoose");

const connectDb = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is not set. Add it to your .env file.");
  }

  mongoose.connection.on("error", (error) =>
    console.error("MongoDB error:", error.message)
  );
  mongoose.connection.on("disconnected", () =>
    console.warn("MongoDB disconnected")
  );

  // Gives up after 5 seconds with the real reason, instead of buffering for 10
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  console.log(`Database connected: ${mongoose.connection.name}`);
};

// It throws on failure, so the server file decides what to do
module.exports = connectDb;