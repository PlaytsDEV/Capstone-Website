import dotenv from "dotenv";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const secretKey = process.env.PAYMONGO_SECRET_KEY;

if (!secretKey) {
  console.error("PAYMONGO_SECRET_KEY is missing from .env");
  process.exit(1);
}

const authHeader = `Basic ${Buffer.from(secretKey + ":").toString("base64")}`;

async function main() {
  console.log("Fetching webhooks from PayMongo API...");
  try {
    const listRes = await axios.get("https://api.paymongo.com/v1/webhooks", {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    const webhooks = listRes.data?.data || [];
    console.log(`Found ${webhooks.length} registered webhook(s):`);

    if (webhooks.length === 0) {
      console.log("No webhooks currently registered in PayMongo account.");
      return;
    }

    for (const wh of webhooks) {
      const { id, attributes } = wh;
      console.log(`- ID: ${id} | Status: ${attributes.status} | URL: ${attributes.url}`);
      
      if (attributes.status === "disabled") {
        console.log(`  Enabling webhook ${id}...`);
        try {
          const enableRes = await axios.post(
            `https://api.paymongo.com/v1/webhooks/${id}/enable`,
            {},
            {
              headers: {
                Authorization: authHeader,
                "Content-Type": "application/json",
              },
            }
          );
          console.log(`  ✓ Webhook ${id} successfully re-enabled! New status: ${enableRes.data?.data?.attributes?.status}`);
        } catch (enableErr) {
          console.error(`  ✕ Failed to enable webhook ${id}:`, enableErr.response?.data || enableErr.message);
        }
      } else {
        console.log(`  ✓ Webhook ${id} is already enabled.`);
      }
    }
  } catch (err) {
    console.error("Failed to query PayMongo webhooks:", err.response?.data || err.message);
  }
}

main();
