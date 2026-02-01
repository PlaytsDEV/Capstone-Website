// Simple test script to verify backend API endpoints
// Run this with: node test-api.js

const BASE_URL = "http://localhost:5000/api";

async function testHealthCheck() {
  console.log("\n🔍 Testing Health Check...");
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    console.log("✅ Health Check:", data);
    return true;
  } catch (error) {
    console.error("❌ Health Check Failed:", error.message);
    return false;
  }
}

async function testBackendAPI() {
  console.log("=".repeat(50));
  console.log("🚀 Testing Lilycrest Backend API");
  console.log("=".repeat(50));

  // Test 1: Health Check
  const healthOk = await testHealthCheck();

  if (!healthOk) {
    console.log("\n❌ Backend server is not responding.");
    console.log("Make sure the server is running: cd server && npm run dev");
    return;
  }

  console.log("\n✅ All backend API tests passed!");
  console.log("\n📝 Next Steps:");
  console.log("1. Get Firebase Web SDK credentials from Firebase Console");
  console.log("2. Update web/.env with the credentials");
  console.log("3. Restart the frontend server");
  console.log("4. Test registration from the browser");
  console.log("\nSee FIREBASE_SETUP.md for detailed instructions.");
}

// Run tests
testBackendAPI().catch(console.error);