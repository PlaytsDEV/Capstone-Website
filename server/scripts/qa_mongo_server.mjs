import { MongoMemoryServer } from "mongodb-memory-server";
import { assertIsolatedQaEnvironment } from "../utils/qaFixtureSafety.js";
import { loadQaEnvironment } from "../utils/qaEnvironment.js";

loadQaEnvironment();
const safety = assertIsolatedQaEnvironment(process.env);
const uri = new URL(process.env.MONGODB_URI);
const port = Number(uri.port);
const databaseName = uri.pathname.replace(/^\//, "");

const mongod = await MongoMemoryServer.create({
  instance: { ip: "127.0.0.1", port, dbName: databaseName },
});
console.log(`Isolated in-memory MongoDB ready on 127.0.0.1:${port}/${safety.mongoDatabase}`);

async function shutdown() {
  await mongod.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
await new Promise(() => {});
