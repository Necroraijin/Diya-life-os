import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Ensure the Gemini API key is available
const apiKey = process.env.GEMINI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured in environment variables." },
        { status: 500 }
      );
    }

    const { input, currentTime } = await req.json();

    if (!input || typeof input !== "string") {
      return NextResponse.json(
        { error: "Input text is required." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      You are the core behavioral intelligence engine for DIYA Life OS.
      Analyze the following user text or voice transcript and extract key schedule tasks, plans, thoughts, deadlines, or bills.
      
      Current Time: ${currentTime || new Date().toISOString()}

      User Input: "${input}"

      Respond with a JSON object that adheres strictly to this schema:
      {
        "title": "A concise, actionable title for the item",
        "priority": "high" | "medium" | "normal",
        "frictionScore": 1 to 10 (Integer representing how complex/hard this is. High friction = lots of steps/logins/docs, low friction = 1 click/quick win),
        "category": "task" | "plan" | "thought" | "deadline" | "bill" | "appointment",
        "deadlineTime": "ISO 8601 string representing the exact deadline, or empty if none",
        "consequence": "A compelling, realistic sentence explaining the personal/work consequence if they do not act now. Example: 'If you don't start this in 2 hours, you'll need 4 hours tonight to finish.' or 'Postponing this will double the anxiety for tomorrow morning's meeting.' Make it specific to the task.",
        "preparation": {
          "type": "email_draft" | "bill_payment" | "prefilled_form" | "quick_reply" | "general",
          "title": "A summary of what DIYA prepared for the user",
          "description": "What they need to review or click (e.g. 'Drafted response to client ready to copy', 'Direct payment page link ready', 'Pre-filled form queue')",
          "content": "The actual draft, URL, pre-filled form fields, or quick-reply text. If email_draft, write the elegant, professional draft email body. If bill_payment, provide a plausible simulation link (e.g. simulated payment page with account info) or text representation of payment steps. If prefilled_form, write the structured key-values."
        }
      }

      Guidelines:
      - Always think about what happens if they don't do it right away. Generate real, believable consequence modeling!
      - Create highly useful preparation assets. If it's a bill, specify a payment action. If they mentioned replying to someone, write the actual draft.
      - Keep priorities accurate: Urgent deadlines are high, simple tasks are normal.
      - Ensure the response is valid, clean JSON with no extra markdown formatting (no wrapper code blocks besides standard JSON response).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    const data = JSON.parse(text.trim());

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error processing input with Gemini:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process inputs using AI" },
      { status: 500 }
    );
  }
}
