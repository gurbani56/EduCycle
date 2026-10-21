'use strict';
const mongoose = require('mongoose');

// NoSQL-injection defence: user input never reaches a filter without type checks
// (see utils/validate.js) and middleware/noOperators.js rejects `$`-prefixed keys.
mongoose.set('strictQuery', true);

async function connectDB(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB, mongoose };
