const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const CONTROLLERS_DIR = __dirname;
const MOBILE_CONTROLLERS_USING_OBJECTID = [
  "announcement.controller.js",
  "user.controller.js",
  "paymongo.controller.js",
  "maintenance.controller.js",
  "dashboard.controller.js",
  "chat.controller.js",
  "billing.controller.js",
  "chatbot.controller.js",
];

describe("mobile BSON compatibility", () => {
  test.each(MOBILE_CONTROLLERS_USING_OBJECTID)(
    "%s builds ObjectId with the driver owned by Mongoose",
    (fileName) => {
      const source = fs.readFileSync(path.join(CONTROLLERS_DIR, fileName), "utf8");

      expect(source).not.toMatch(/require\(['"]mongodb['"]\)/);
      if (/\bObjectId\b/.test(source)) {
        expect(source).toMatch(/require\(['"]mongoose['"]\)/);
      }
    },
  );

  test("the notification bridge uses Mongoose ObjectIds for its native db handle", () => {
    const source = fs.readFileSync(
      path.resolve(CONTROLLERS_DIR, "../../services/mobileNotificationBridge.js"),
      "utf8",
    );

    expect(source).not.toMatch(/import\(['"]mongodb['"]\)/);
    expect(source).toMatch(/mongoose\.Types/);
  });

  test("a Mongoose ObjectId round-trips through the same native driver behind getDb", async () => {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    const mongod = await MongoMemoryServer.create();
    let conn;
    try {
      conn = await mongoose.createConnection(mongod.getUri()).asPromise();
      const db = conn.db;
      const id = new mongoose.Types.ObjectId();

      await db.collection("regression_probe").insertOne({ _id: id, userId: id });
      const found = await db.collection("regression_probe").findOne({ userId: id });

      expect(found).not.toBeNull();
      expect(String(found._id)).toBe(String(id));
    } finally {
      if (conn) await conn.close();
      await mongod.stop();
    }
  }, 30000);
});

describe("mobile chatbot error contract", () => {
  test("sendMessage returns a safe 500 envelope without raw error.message", () => {
    const source = fs.readFileSync(path.join(CONTROLLERS_DIR, "chatbot.controller.js"), "utf8");
    const sendMessage = source.split("async function sendMessage(req, res) {")[1]?.split("\nasync function ")[0] || "";

    expect(sendMessage.length).toBeGreaterThan(0);
    expect(sendMessage).not.toMatch(/detail:\s*error\.message/);
    expect(sendMessage).toMatch(/LILY_TEMPORARILY_UNAVAILABLE/);
  });
});
