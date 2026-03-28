/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, SeniorProfile, Reminder, ActivityLogEntry } from "../types";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log("Loaded Gemini API Key:", GEMINI_API_KEY ? "Yes" : "No");
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export async function callGemini(
  systemInstruction: string,
  userMessage: string,
  history: ChatMessage[] = [],
  responseMimeType?: "application/json"
) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
    console.warn("Gemini API key is not set. Using mock response.");
    if (responseMimeType === "application/json") {
      return JSON.stringify({
        agent: "chat",
        payload: {
          message: "I'm currently in demo mode. Please set your Gemini API key in the Secrets panel.",
          urgency: "low"
        }
      });
    }
    return "I'm sorry, I'm currently in demo mode and cannot connect to the AI. Please check the API key configuration.";
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
        { role: "user", parts: [{ text: userMessage }] }
      ],
      config: {
        systemInstruction,
        responseMimeType,
      },
    });

    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "I'm having trouble connecting right now. Let's try again in a moment.";
  }
}

export const AGENT_PROMPTS = {
  ORCHESTRATOR: `You are the Orchestrator Agent for EasyMind, a dementia care companion.
Your job is to route tasks to sub-agents.
Context:
- Senior Profile: {{profile}}
- Current Time: {{time}}
- Today's Reminders: {{reminders}}
- Recent Log: {{log}}

Decide which sub-agent to invoke:
1. "daily_task": For routine checks and non-medical reminders.
2. "medication": For medication adherence and health checks.
3. "chat": For general conversation, emotional support, or questions.

Return a structured JSON response ONLY. Do not include any conversational text before or after the JSON.
{
  "agent": "daily_task" | "medication" | "chat",
  "payload": {
    "message": "The message to show the senior",
    "urgency": "low" | "medium" | "high",
    "action": "Optional specific action"
  }
}`,

  DAILY_TASK: `You are the Daily Task Agent. You specialize in summarizing the senior's routine and detecting incomplete tasks.
Be friendly, warm, and use plain language.
Context: {{context}}
Compose a nudge for the senior if they missed something, or a gentle greeting.`,

  MEDICATION: `You are the Medication Agent. You specialize in medication adherence.
Context: {{medicationContext}}
Compose a warm, reassuring reminder. Mention specific pill colors or instructions if provided.`,

  CHAT: `You are Memora, a warm, patient, and calm companion for an elderly person with memory difficulties.
- Never correct the user harshly.
- Speak simply and clearly.
- Provide emotional support.
- If they ask for something you can't help with, gently suggest calling their family contact: {{caregiver}}.`,

  SUMMARY: `You are the Caregiver Summary Agent. 
Based on the activity log: {{log}}
Provide a concise, empathetic summary of the senior's day so far for the family caregiver.
Suggest actions if necessary.`
};

export async function routeRequest(profile: SeniorProfile, reminders: Reminder[], log: ActivityLogEntry[]) {
  const time = new Date().toLocaleTimeString();
  const profileStr = JSON.stringify(profile);
  const remindersStr = JSON.stringify(reminders);
  const logStr = JSON.stringify(log.slice(0, 5));

  const systemInstruction = AGENT_PROMPTS.ORCHESTRATOR
    .replace('{{profile}}', profileStr)
    .replace('{{time}}', time)
    .replace('{{reminders}}', remindersStr)
    .replace('{{log}}', logStr);

  const response = await callGemini(systemInstruction, "What should I do now?", [], "application/json");
  
  try {
    // Strip markdown code blocks if present
    const cleanResponse = response.replace(/```json\n?|```/g, '').trim();
    const parsed = JSON.parse(cleanResponse);
    return parsed as { agent: 'daily_task' | 'medication' | 'chat', payload: { message: string, urgency: string, action?: string } };
  } catch (e) {
    console.error("Failed to parse orchestrator response:", e);
    return { agent: 'chat', payload: { message: "Hello, how can I help you today?", urgency: 'low' } };
  }
}
