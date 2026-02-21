import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AnalysisResult {
  fairOdd: number;
  probability: number;
  notes: string;
}

export async function analyzeEvent(
  event: string,
  market: string,
  odds: number,
  additionalContext: string = ""
): Promise<AnalysisResult> {
  const prompt = `
    You are a Professional ValueBet Oracle. 
    Analyze the following sports event and market:
    Event: ${event}
    Market: ${market}
    Current Market Odds: ${odds}
    Additional Context: ${additionalContext}

    Calculate the "True Probability" and "Fair Odds" based on team form, injuries, historical matchups, and advanced metrics.
    Provide a brief 2-sentence explanation.

    Return the result in JSON format.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fairOdd: { type: Type.NUMBER, description: "The calculated fair decimal odd" },
          probability: { type: Type.NUMBER, description: "The true probability (0-1)" },
          notes: { type: Type.STRING, description: "2-sentence explanation" },
        },
        required: ["fairOdd", "probability", "notes"],
      },
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return { fairOdd: odds, probability: 1 / odds, notes: "Analysis failed. Using market odds." };
  }
}
