import { GoogleGenAI } from "@google/genai";
import { HealthRecord } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function getHealthInsights(records: HealthRecord[]) {
  if (records.length === 0) return "No hay datos suficientes para generar recomendaciones.";

  const prompt = `
    Actúa como un asistente de salud inteligente. Analiza los siguientes registros de salud de un usuario:
    ${JSON.stringify(records.slice(0, 20))}

    El usuario está monitoreando:
    - Hipertensión (Sistólica/Diastólica y Pulso/Frecuencia Cardíaca)
    - Glicemia (mg/dL)
    - Peso (kg)

    Proporciona un resumen breve (máximo 3 párrafos) en español sobre las tendencias observadas y consejos generales de estilo de vida. 
    IMPORTANTE: Incluye siempre un descargo de responsabilidad indicando que no eres un médico y que el usuario debe consultar a un profesional.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating insights:", error);
    return "No se pudo generar el análisis en este momento.";
  }
}
