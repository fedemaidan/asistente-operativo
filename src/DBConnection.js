const mongoose = require("mongoose");

const connectToMongoDB = async () => {
  console.log("Connecting to MongoDB");
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
};

const deleteCollections = async (collectionNames) => {
  if (!Array.isArray(collectionNames) || collectionNames.length === 0) {
    throw new Error("Collection names must be an array and not empty");
    return;
  }
  const collections = mongoose.connection.collections;
  for (const name of collectionNames) {
    const collection = collections[name];
    if (!collection) continue;
    try {
      await collection.deleteMany({});
    } catch (e) {
      throw new Error(`Error deleting collection ${name}: ${e.message}`);
    }
  }
}

module.exports = {connectToMongoDB, deleteCollections};
