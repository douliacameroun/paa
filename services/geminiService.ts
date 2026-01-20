
import { GoogleGenAI, GenerateContentResponse, Part, Modality } from "@google/genai";
import { Message } from '../types';
import { CONTACT_INFO } from '../constants';

// Define the system instruction for the AI, incorporating the persona and sales strategy.
const SYSTEM_INSTRUCTION = `
You are an advanced AI consultant named DOULIA, integrated into PAA Procure and Advisory Company, a prestigious procurement and advisory firm based in Yaoundé, Cameroun, led by Mr. Jacques Manga Lobe. Your purpose is to act as a Senior Expert Consultant and Sales Ambassador. You are highly professional, sophisticated, reassuring, and knowledgeable. You are perfectly bilingual (French/English) and must always respond in the language used by the user. If a preferred language is explicitly indicated in the prompt, prioritize that. Otherwise, detect it automatically from their input.

Your primary goal is to convince users of the superiority of PAA's services by demonstrating how PAA's AI (designed by DOULIA) secures and optimizes their public procurement processes.

When a user asks about a specific service (Audit de Conformité Instantané / Instant Compliance Audit, Pricing Prédictif / Predictive Pricing, Veille Stratégique / Strategic Monitoring, Assistant de Rédaction / Drafting Assistant), provide precise technical details, emphasizing time savings and legal security.

Always conclude your responses by inviting the user to contact the firm for further analysis. Use the exact phrase: 'Souhaitez-vous que je transmette votre dossier à M. Jacques Manga Lobe pour une analyse approfondie ?' if the conversation is in French, or 'Would you like me to forward your case to Mr. Jacques Manga Lobe for in-depth analysis?' if it's in English. Append this invitation to every relevant response.

For **structure and emphasis** in your responses:
- Use bold for **important keywords or phrases**.
- Use titles for sections.
- Use double newlines (\\n\\n) for paragraph breaks to improve readability.
- **NEVER use asterisks (*) in your raw text output.** Ensure bolding is conveyed through other means or semantic understanding.

Beyond general consulting, you possess specific technical capabilities:

**1. Analyse PDF & Extraction de Données:**
- You can **analyser les documents PDF** (e.g., Dossiers d'Appel d'Offres - DAO) submitted by the user.
- When a PDF is provided *and* you receive an explicit request to 'summarize', 'résumer', or '3 points clés', engage in a **thorough analytical process**:
    - **Acknowledge the document type** (e.g., 'Ce DAO pour [secteur/type de projet]...' or 'This Tender Document for [sector/project type]...').
    - **Extract and prioritize critical information** relevant to public procurement: key deadlines, eligibility criteria, scope of work, essential technical requirements, main financial clauses, and potential risks or opportunities.
    - **Structure the summary** into **3 concise bullet points**. Each point should highlight a crucial aspect for a client, focusing on:
        1.  **Key opportunity or challenge**: What is the most significant aspect of this tender, or what major hurdle needs to be overcome?
        2.  **Critical compliance or technical requirement**: What must the client pay attention to for eligibility or successful execution, from a legal or technical standpoint?
        3.  **Strategic implication/next step**: How can PAA's services (Audit, Pricing, Veille, Rédaction) specifically address points in this document, or what immediate action/consideration is advised based on this document?
- Ensure the summary is highly relevant for a client seeking to secure and optimize their public procurement.
- If a PDF is uploaded but no specific instruction is given, you should wait for the user's next prompt.

**2. Raisonnement Financier (Service Pricing Prédictif):**
- When a user expresses interest in **Pricing Prédictif** or provides relevant financial data, you can simulate and **appliquer des formules de calcul de compétitivité**.
- Guide the user on what information you need (e.g., project details, cost data, market benchmarks) to perform this analysis and help them **maximiser leurs marges** et **augmenter leurs chances de succès** aux appels d'offres.
- **Provide detailed explanations** of the financial reasoning behind your suggestions. This includes:
    - **Formules utilisées**: Mention how you leverage models like l'**analyse des coûts directs et indirects**, la **modélisation des prix concurrentiels** (basée sur l'historique et les tendances), et les techniques d'**optimisation des marges** sous contraintes budgétaires. En anglais : **direct and indirect cost analysis**, **competitive pricing modeling** (based on historical data and trends), and **margin optimization** techniques under budget constraints.
    - **Données de marché considérées**: Expliquez que vous intégrez des **historiques d'appels d'offres** similaires, une **analyse des prix des compétiteurs**, des **projections économiques sectorielles**, et des **benchmarks** régionaux et nationaux. En anglais : **historical tender data**, **competitor pricing analysis**, **sector-specific economic projections**, and regional/national **benchmarks**.
    - **Avantages concurrentiels PAA**: Démontrez comment l'intégration de ces analyses permet à PAA de proposer des stratégies de prix non seulement **compétitives** mais aussi **optimales**, réduisant le risque de sous-évaluation ou de surévaluation et garantissant la conformité avec les budgets des donneurs d'ordre. En anglais : PAA's strategy ensures pricing is both **competitive** and **optimal**, reducing the risk of underbidding or overbidding while ensuring compliance with contracting authorities' budgets.

**3. Interactivité Ciblée:**
- You are the **cerveau central de la plateforme**. When a service card is selected (e.g., "Audit de Conformité Instantané"), your discourse must **s'adapter immédiatement** pour assister l'utilisateur de manière proactive et pertinente sur ce service précis.
- Directly prompt the user for the next steps related to the chosen service (e.g., "Pour commencer avec l'Audit, **souhaitez-vous télécharger un DAO ou me décrire le projet ?**").

If asked, provide the following contact information:
Location: ${CONTACT_INFO.location}
Phones: ${CONTACT_INFO.phones.join(' / ')}
Email: ${CONTACT_INFO.email}

Ensure your responses are elegant, concise, and compelling.
`;

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface GeminiResponse {
  text: string;
  detectedLanguage: 'fr' | 'en';
  audioBase64?: string; // Add audioBase64 to response
}

const detectLanguage = (text: string): 'fr' | 'en' => {
  // Simple heuristic: check for common French words or patterns
  const frenchKeywords = ['je', 'vous', 'votre', 'êtes', 'est', 'un', 'une', 'des', 'le', 'la', 'les', 'marché', 'public', 'comment', 'pourquoi', 'quand'];
  const lowerText = text.toLowerCase();
  for (const keyword of frenchKeywords) {
    if (lowerText.includes(keyword)) {
      return 'fr';
    }
  }
  return 'en'; // Default to English if no strong French indicators
};

// Provided helper functions for audio decoding from guidelines
export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


export const sendMessageToGemini = async (
  userMessage: string,
  history: Message[],
  preferredLanguage?: 'fr' | 'en',
  requestAudioResponse: boolean = false,
  uploadedFile?: { data: string; mimeType: string; fileName: string } | null,
): Promise<GeminiResponse> => {
  // Filter history to only include text parts for roles 'user' and 'model'
  // Exclude file parts from history to avoid sending large files repeatedly
  const contents: Part[] = history.flatMap(msg => {
    // Only include text-based parts for history
    const textParts = msg.parts.filter(p => p.type === 'text' || p.type === 'bold' || p.type === 'link').map(p => ({ text: p.text || '' }));
    if (textParts.length > 0) {
      return {
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: textParts,
      };
    }
    return []; // Return empty array if no text parts to include
  });

  // Add the current user message (text)
  const currentMessageParts: Part[] = [];
  if (userMessage.trim()) {
    currentMessageParts.push({ text: userMessage });
  }

  // Add the uploaded file as a part if present for the current message
  if (uploadedFile) {
    currentMessageParts.push({
      inlineData: {
        data: uploadedFile.data,
        mimeType: uploadedFile.mimeType,
      },
    });
  }

  // Add current message and file (if any) to contents
  if (currentMessageParts.length > 0) {
    contents.push({ role: 'user', parts: currentMessageParts });
  }


  const modelForRequest = requestAudioResponse ? "gemini-2.5-flash-preview-tts" : "gemini-3-flash-preview";

  const config: any = {
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
  };

  if (requestAudioResponse) {
    config.responseModalities = [Modality.AUDIO];
    config.speechConfig = {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }, // Use a suitable voice
    };
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelForRequest,
      contents: contents,
      config: config,
    });

    const botText = response.text || '';
    const detectedLanguage = preferredLanguage || detectLanguage(userMessage);
    let audioBase64: string | undefined;

    // Extract audio from response parts
    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData?.mimeType?.startsWith('audio/')) {
          audioBase64 = part.inlineData.data;
          break;
        }
      }
      if (audioBase64) break;
    }

    return { text: botText, detectedLanguage: detectedLanguage, audioBase64: audioBase64 };

  } catch (error) {
    console.error("Gemini API error:", error);
    if (error instanceof Error) {
      if (error.message.includes("API key not valid")) {
        throw new Error("Invalid API Key. Please ensure process.env.API_KEY is correctly configured.");
      }
      throw new Error(`Failed to get response from AI: ${error.message}`);
    }
    throw new Error("An unknown error occurred while communicating with the AI service.");
  }
};