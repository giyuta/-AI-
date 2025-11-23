import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Token } from "../types";

// Use 'Fenrir' for a magnetic male voice suitable for learning
const VOICE_NAME = 'Fenrir'; 

// Gemini TTS typically uses 24kHz for speech generation
const SAMPLE_RATE = 24000;

export const generateJapaneseSpeech = async (text: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: VOICE_NAME },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      throw new Error("No content generated");
    }

    const audioPart = parts[0];
    if (!audioPart.inlineData || !audioPart.inlineData.data) {
       throw new Error("No audio data found in response");
    }

    // Convert Base64 to binary
    const binaryString = atob(audioPart.inlineData.data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Gemini returns raw PCM (16-bit, 24kHz, Mono). 
    // Browsers cannot play raw PCM in <audio> tag. We must wrap it in a WAV container.
    const wavBuffer = pcmToWav(bytes, SAMPLE_RATE);
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
};

/**
 * Analyzes Japanese text to provide readings (Furigana) for Kanji.
 */
export const analyzeJapaneseText = async (text: string): Promise<Token[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are a Japanese morphological analyzer. 
      Task: Analyze the following text and split it into tokens/words.
      Requirement 1: The concatenation of 'surface' values MUST equal the original text exactly (preserve all spaces and punctuation).
      Requirement 2: For any token containing Kanji, provide the reading in **Hiragana** in the 'reading' field.
      Requirement 3: If a token has no Kanji (e.g., pure Hiragana, Katakana, punctuation), DO NOT include the 'reading' field.
      
      Text to analyze: ${text}`,
      config: {
        temperature: 0.0, // Zero temperature for maximum stability and accuracy
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              surface: { type: Type.STRING, description: "The word surface form" },
              reading: { type: Type.STRING, description: "Hiragana reading for Kanji words only" },
            },
            required: ["surface"],
          },
        },
      },
    });

    let jsonStr = response.text || "[]";
    // Remove any markdown formatting if present (though responseMimeType usually prevents this)
    jsonStr = jsonStr.replace(/^```json\s*/, "").replace(/\s*```$/, "");

    return JSON.parse(jsonStr) as Token[];
  } catch (error) {
    console.warn("Text analysis failed, falling back to raw text", error);
    // Return an empty array or basic tokenization fallback could be handled here
    // But for now we return empty so UI falls back to standard segmentation
    return [];
  }
};

/**
 * Wraps raw PCM data into a WAV file format
 */
function pcmToWav(pcmData: Uint8Array, sampleRate: number): ArrayBuffer {
    const numChannels = 1; // Mono
    const bitsPerSample = 16; // 16-bit
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const dataSize = pcmData.length;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, byteRate, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample

    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM data
    const pcmBytes = new Uint8Array(buffer, 44);
    pcmBytes.set(pcmData);

    return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}