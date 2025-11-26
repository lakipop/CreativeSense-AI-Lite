import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API key not found. Please make sure it is set up correctly in your environment.");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}
