import "server-only";
import OpenAI from "openai";

export function liveAiAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());
}

export function aiModel(): string {
  return process.env.OPENAI_MODEL || "gpt-5.4-mini";
}

let client: OpenAI | null = null;
export function openai(): OpenAI | null {
  if (!liveAiAvailable()) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 1 });
  return client;
}

export class LiveAiUnavailable extends Error {
  constructor() {
    super("Live AI is unavailable: no OpenAI API key is configured on the server.");
  }
}
