/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality } from "@google/genai";
import { ChatMessage, UserProfile, Reminder, ActivityLogEntry } from "../types";

// Vite koristi import.meta.env, ne process.env
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

// Potrebno za browser okruženje — starije verzije @google/genai nemaju dangerouslyAllowBrowser opciju
if (typeof window !== "undefined") {
  (window as any).process = { env: { GEMINI_API_KEY } };
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export interface CaregiverRecap {
  recap: string;
  conclusion: string;
}

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
          urgency: "low",
        },
      });
    }
    return "I'm sorry, I'm currently in demo mode and cannot connect to the AI. Please check the API key configuration.";
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history.map((m) => ({
          // Gemini koristi "model" umesto "assistant"
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: [{ text: userMessage }] },
      ],
      config: {
        systemInstruction,
        responseMimeType,
      },
    });

    // response.text je getter funkcija u @google/genai
    return response.text ?? "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "I'm having trouble connecting right now. Let's try again in a moment.";
  }
}

export async function generateSpeech(text: string) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
    console.warn("Gemini API key is not set. Skipping TTS.");
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    return base64Audio ?? null;
  } catch (error) {
    console.error("Error generating speech:", error);
    return null;
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

  CHAT: `You are Luna, a warm, patient, and calm companion for an elderly person with memory difficulties.
- You are multilingual and can speak Serbian if the user speaks Serbian.
- Never correct the user harshly.
- Speak simply and clearly.
- Provide emotional support.
- If they ask for something you can't help with, gently suggest calling their family contact: {{caregiver}}.`,

  SUMMARY: `You are the Caregiver Summary Agent. 
Based on the activity log: {{log}}
Provide a concise, empathetic summary of the senior's day so far for the family caregiver.
Suggest actions if necessary.`,

  CAREGIVER_RECAP: `You are the EasyMind Caregiver Recap Agent.
Use ONLY the provided activity log context.

Return JSON only in this exact shape:
{
  "recap": "2-3 short sentences summarizing key events",
  "conclusion": "One clear conclusion with one practical next step"
}

Keep it calm, practical, and empathetic.
Do not include markdown formatting in values (no **, *, or headings).`,
};

function stripJsonCodeFences(raw: string): string {
  return raw.replace(/```json\n?|```/g, "").trim();
}

function buildLogContext(log: ActivityLogEntry[], limit = 10): string {
  if (!log.length) {
    return "No activity events recorded yet today.";
  }

  return log
    .slice(0, limit)
    .map(
      (entry) =>
        `${entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} | ${entry.type} | ${entry.outcome} | ${entry.message || "No message"}`
    )
    .join("\n");
}

export async function generateCaregiverRecap(log: ActivityLogEntry[]): Promise<CaregiverRecap> {
  const logContext = buildLogContext(log, 12);
  const systemInstruction = `${AGENT_PROMPTS.CAREGIVER_RECAP}\n\nActivity log:\n${logContext}`;

  const response = await callGemini(
    systemInstruction,
    "Create a short recap and conclusion for the caregiver.",
    [],
    "application/json"
  );

  try {
    const parsed = JSON.parse(stripJsonCodeFences(response)) as Partial<CaregiverRecap>;
    return {
      recap: parsed.recap?.trim() || "No meaningful recap was generated from the current log.",
      conclusion: parsed.conclusion?.trim() || "Continue monitoring and check in again after the next reminder window.",
    };
  } catch (error) {
    console.error("Failed to parse caregiver recap response:", error);

    const completedCount = log.filter((item) => item.outcome === "Completed").length;
    const missedCount = log.filter((item) => item.outcome === "No Response").length;
    const emergencyCount = log.filter((item) => item.outcome === "Emergency").length;

    return {
      recap: `Today\'s log has ${log.length} events: ${completedCount} completed, ${missedCount} missed, and ${emergencyCount} emergency alerts.`,
      conclusion:
        emergencyCount > 0
          ? "At least one emergency was recorded. Please contact the senior now and verify immediate safety."
          : missedCount > 0
            ? "There were missed interactions. A direct check-in call is recommended in the next hour."
            : "Overall trend appears stable. Continue with normal monitoring and reminders.",
    };
  }
}

export async function routeRequest(
  profile: UserProfile,
  reminders: Reminder[],
  log: ActivityLogEntry[]
) {
  const time = new Date().toLocaleTimeString();
  const profileStr = JSON.stringify(profile);
  const remindersStr = JSON.stringify(reminders);
  const logStr = JSON.stringify(log.slice(0, 5));

  const systemInstruction = AGENT_PROMPTS.ORCHESTRATOR.replace(
    "{{profile}}",
    profileStr
  )
    .replace("{{time}}", time)
    .replace("{{reminders}}", remindersStr)
    .replace("{{log}}", logStr);

  const response = await callGemini(
    systemInstruction,
    "What should I do now?",
    [],
    "application/json"
  );

  try {
    const cleanResponse = response.replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(cleanResponse);
    return parsed as {
      agent: "daily_task" | "medication" | "chat";
      payload: { message: string; urgency: string; action?: string };
    };
  } catch (e) {
    console.error("Failed to parse orchestrator response:", e);
    return {
      agent: "chat" as const,
      payload: { message: "Hello, how can I help you today?", urgency: "low" },
    };
  }
}