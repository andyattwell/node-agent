import dotenv from "dotenv";
import path from "path";

const envPath = path.join(process.cwd(), "..", ".env");
dotenv.config({ path: envPath });

/** Helper functions to list gemini models from the api. */
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function listGeminiModels(): Promise<string[]> {
  const url = `${GEMINI_API_BASE}/models`;
  const apiKey = process.env.ADW_GEMINI_API_KEY ?? "";
  console.log({ apiKey });
  if (!apiKey) {
    console.error("PATH", envPath);
    throw new Error("GEMINI_API_KEY is not set");
  }
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
  });
  console.log({ response });
  if (!response.ok) {
    throw new Error(`Failed to list Gemini models: ${response.statusText}`);
  }
  const data = await response.json();
  return data.models;
}

listGeminiModels().then((models) => {
  console.log(models);
});
