const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer = null;

async function setupDB() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, {
    dbName: "test-db",
  });
}

async function teardownDB() {
  try {
    await mongoose.disconnect();
  } catch (e) {
    // ignore
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

async function clearDB() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    const collection = collections[key];
    try {
      await collection.deleteMany({});
    } catch (e) {
      // ignore
    }
  }
}

module.exports = { setupDB, teardownDB, clearDB };


