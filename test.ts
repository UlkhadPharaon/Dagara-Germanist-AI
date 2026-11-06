import OpenAI from "openai";

async function test() {
  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "OPTIONS",
      headers: {
        "Origin": "https://example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type"
      }
    });
    console.log("Status:", response.status);
    console.log("Headers:", Object.fromEntries(response.headers.entries()));
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
