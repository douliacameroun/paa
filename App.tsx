
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SERVICES, CONTACT_INFO } from './constants';
import { ServiceCard } from './components/ServiceCard';
import { ChatWindow } from './components/ChatWindow';
import { Message, MessagePart } from './types';
import { sendMessageToGemini, decode, decodeAudioData } from './services/geminiService';
import { Spinner } from './components/Spinner';

// Fix: Define SpeechRecognition and related types if not implicitly available (e.g., if 'dom' lib is not fully configured)
declare global {
  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: SpeechRecognitionErrorCode;
    readonly message: string;
  }

  type SpeechRecognitionErrorCode =
    | "no-speech"
    | "aborted"
    | "audio-capture"
    | "network"
    | "not-allowed"
    | "service-not-allowed"
    | "bad-grammar"
    | "language-not-supported";

  interface SpeechRecognition extends EventTarget {
    grammars: any; // Simplified type for grammars
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    serviceURI: string;

    onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;

    abort(): void;
    start(): void;
    stop(): void;
  }

  // Extend the Window interface for SpeechRecognition and webkitAudioContext compatibility
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
      prototype: SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
      prototype: SpeechRecognition;
    };
    webkitAudioContext: typeof AudioContext; // Fix: Add webkitAudioContext to Window interface
  }
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  // currentLanguage for chatbot interaction and input placeholder, can be detected by Gemini.
  const [currentLanguage, setCurrentLanguage] = useState<'fr' | 'en'>('fr');
  // displayLanguage for static UI elements (cards, headers), controlled by user toggle.
  const [displayLanguage, setDisplayLanguage] = useState<'fr' | 'en'>('fr');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Voice interaction states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [interimText, setInterimText] = useState<string>('');
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false); // New state to track if bot is speaking

  // File upload state for current message being composed (transient)
  const [stagedFile, setStagedFile] = useState<{ data: string; mimeType: string; fileName: string } | null>(null);
  // File upload state for a PDF that has been uploaded and is awaiting summary confirmation (persistent across turns)
  const [pdfToSummarize, setPdfToSummarize] = useState<{ data: string; mimeType: string; fileName: string } | null>(null);


  // Initialize AudioContext
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Initial welcome message from the AI
  useEffect(() => {
    const welcomeMessageParts: MessagePart[] = [
      { text: 'Bonjour ! Je suis DOULIA, votre consultant expert en IA pour PAA Procure and Advisory Company. ', type: 'text' },
      { text: 'Comment puis-je vous aider à sécuriser et optimiser vos marchés publics aujourd\'hui ?', type: 'text' },
      { text: '\n\nHello! I am DOULIA, your AI expert consultant for PAA Procure and Advisory Company. ', type: 'text' },
      { text: 'How can I assist you in securing and optimizing your public procurement today?', type: 'text' },
    ];
    setMessages([{ id: 'welcome', sender: 'bot', parts: welcomeMessageParts }]);
  }, []);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);

  const playAudio = useCallback(async (audioBase64: string) => {
    if (!audioContextRef.current) return;

    setIsSpeaking(true);
    try {
      const audioData = decode(audioBase64);
      const audioBuffer = await decodeAudioData(audioData, audioContextRef.current, 24000, 1);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        setIsSpeaking(false);
      };
      source.start();
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsSpeaking(false);
    }
  }, []);

  const isSummaryConfirmation = (text: string) => {
    const lowerText = text.toLowerCase();
    const isFrenchConfirmation = lowerText.includes('oui') || lowerText.includes('résumez');
    const isEnglishConfirmation = lowerText.includes('yes') || lowerText.includes('summarize');
    return isFrenchConfirmation || isEnglishConfirmation;
  };

  const handleSendMessage = useCallback(async (userMessage: string, isVoiceInput: boolean = false) => {
    const currentInputText = userMessage.trim() || interimText.trim();

    // Determine the actual message and file to send to Gemini
    let promptForGemini = currentInputText;
    let fileForGemini: { data: string; mimeType: string; fileName: string } | null = null;
    let isSummarizingAction = false;

    if (isSummaryConfirmation(currentInputText) && pdfToSummarize) {
      // User is confirming to summarize the previously uploaded PDF
      promptForGemini = currentLanguage === 'fr' ? "Veuillez résumer ce document en 3 points clés." : "Please summarize this document into 3 key bullet points.";
      fileForGemini = pdfToSummarize;
      isSummarizingAction = true;
    } else if (stagedFile) {
      // User is sending a text message along with a newly staged file
      fileForGemini = stagedFile;
      // If user typed nothing but attached a file, the prompt will be empty, which Gemini should handle
    }

    if (!promptForGemini && !fileForGemini) {
      return; // Nothing to send
    }

    // Create user message for display in the chat window
    const newUserMessageParts: MessagePart[] = [];
    if (promptForGemini) {
        newUserMessageParts.push({ text: currentInputText, type: 'text' }); // Display user's actual typed text
    }
    if (fileForGemini && isSummarizingAction) { // If it's a summary action, re-display the file for context in chat history
      newUserMessageParts.push({ type: 'file', fileName: fileForGemini.fileName, mimeType: fileForGemini.mimeType });
    } else if (stagedFile && !isSummarizingAction && promptForGemini) { // If a new file is sent with a text prompt
        newUserMessageParts.push({ type: 'file', fileName: stagedFile.fileName, mimeType: stagedFile.mimeType });
    }

    // Fallback if somehow no parts were added but there's a prompt
    // Fix: Explicitly type the fallback array to MessagePart[] to resolve type incompatibility
    const finalNewUserMessageParts: MessagePart[] = newUserMessageParts.length ? newUserMessageParts : [{ text: promptForGemini, type: 'text' }];
    const newUserMessage: Message = { id: Date.now().toString() + '-user', sender: 'user', parts: finalNewUserMessageParts };
    setMessages((prevMessages) => [...prevMessages, newUserMessage]);

    setIsChatLoading(true);
    setInterimText(''); // Clear interim text
    setStagedFile(null); // Clear staged file

    // Clear pdfToSummarize if the user confirmed summary or sent a different message
    if (isSummarizingAction || (pdfToSummarize && !isSummaryConfirmation(currentInputText))) {
        setPdfToSummarize(null);
    }

    try {
      const response = await sendMessageToGemini(promptForGemini, messages, currentLanguage, isVoiceInput, fileForGemini);
      const botResponseParts: MessagePart[] = [{ text: response.text || 'Désolé, je n\'ai pas pu générer de réponse.', type: 'text' }];

      if (response.audioBase64) {
        botResponseParts.push({ type: 'audio', audioBase64: response.audioBase64 });
      }

      const botMessage: Message = { id: Date.now().toString() + '-bot', sender: 'bot', parts: botResponseParts };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
      setCurrentLanguage(response.detectedLanguage);

      if (response.audioBase64) {
        await playAudio(response.audioBase64);
      }
    } catch (error) {
      console.error('Error sending message to Gemini:', error);
      const errorMessage: Message = { id: Date.now().toString() + '-error', sender: 'bot', parts: [{ text: 'Désolé, une erreur est survenue lors de la communication avec le service. Veuillez réessayer plus tard.', type: 'error' }] };
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  }, [messages, currentLanguage, interimText, stagedFile, pdfToSummarize, playAudio]);

  const startSpeechToText = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(currentLanguage === 'fr' ? "Votre navigateur ne supporte pas la reconnaissance vocale." : "Your browser ne supporte pas la reconnaissance vocale.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Set to false to stop after a pause
    recognition.interimResults = true; // Get interim results
    recognition.lang = currentLanguage === 'fr' ? 'fr-FR' : 'en-US'; // Set language for recognition

    recognition.onstart = () => {
      setIsRecording(true);
      setInterimText('');
      console.log('Voice recognition started.');
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInterimText(final + interim); // Show both final and interim
      if (final) {
        // If there's a final result, send it immediately and stop recognition
        recognition.stop();
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      console.log('Voice recognition ended.');
      if (interimText.trim()) {
        handleSendMessage(interimText, true); // Send the accumulated text
      }
      setInterimText('');
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      setInterimText(''); // Clear interim text on error
      if (event.error === 'no-speech') {
        alert(currentLanguage === 'fr' ? "Aucune parole détectée. Veuillez réessayer." : "No speech detected. Please try again.");
      } else if (event.error === 'not-allowed') {
        alert(currentLanguage === 'fr' ? "Permission du microphone refusée. Veuillez l'activer dans les paramètres du navigateur." : "Microphone permission denied. Please enable it in your browser settings.");
      }
    };

    speechRecognitionRef.current = recognition;
    recognition.start();
  };

  const stopSpeechToText = () => {
    if (speechRecognitionRef.current && isRecording) {
      speechRecognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleSpeechToText = () => {
    if (isRecording) {
      stopSpeechToText();
    } else {
      startSpeechToText();
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Extract base64 part, removing the data URL prefix
          const base64Data = reader.result.split(',')[1];
          const fileData = {
            data: base64Data,
            mimeType: file.type,
            fileName: file.name,
          };

          // Store the file for potential summarization
          setPdfToSummarize(fileData);
          setStagedFile(null); // Clear any other staged file

          // Add user message displaying the file
          const uploadMessage: Message = {
            id: Date.now().toString() + '-file-upload',
            sender: 'user',
            parts: [{ type: 'file', fileName: file.name, mimeType: file.type }],
          };
          setMessages((prev) => [...prev, uploadMessage]);

          // Immediately add a bot message asking for summary confirmation
          const botSummaryPromptText = currentLanguage === 'fr'
            ? `J'ai reçu votre document (**${file.name}**). Souhaitez-vous que je le résume en 3 points clés ?`
            : `I have received your document (**${file.name}**). Would you like me to summarize it into 3 key bullet points?`;
          setMessages((prev) => [...prev, { id: Date.now().toString() + '-bot-summary-prompt', sender: 'bot', parts: [{ text: botSummaryPromptText, type: 'text' }] }]);
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert(currentLanguage === 'fr' ? "Veuillez ne télécharger que des fichiers PDF." : "Please upload PDF files only.");
    }
    // Clear the input after selection
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleCardClick = useCallback(async (serviceId: string) => {
    const service = SERVICES.find(s => s.id === serviceId);
    if (service) {
      const serviceTitleFr = service.titleFr;
      const serviceTitleEn = service.titleEn;
      const serviceTitle = displayLanguage === 'fr' ? serviceTitleFr : serviceTitleEn;

      let initialPromptFr = '';
      let initialPromptEn = '';

      // Adjust prompts based on service for enhanced interactivity and capability demonstration
      if (serviceId === 'audit') {
        initialPromptFr = `Je vois que vous êtes intéressé par l'**${serviceTitleFr}**. Pour commencer, **souhaitez-vous télécharger un Dossier d'Appel d'Offres (DAO) ou me décrire votre besoin spécifique ?** Je vous expliquerai ensuite comment cet outil réduit les rejets de 85%.`;
        initialPromptEn = `I see you are interested in **${serviceTitleEn}**. To get started, **would you like to upload a Tender Document (DAO) or describe your specific needs?** I'll then explain how this tool reduces rejections by 85%.`;
      } else if (serviceId === 'pricing') {
        initialPromptFr = `Je vois que vous êtes intéressé par le **${serviceTitleFr}**. Pour **maximiser vos marges et votre succès**, **souhaitez-vous que j'analyse des données de marché ou que j'applique des formules de calcul de compétitivité pour un projet spécifique ?**`;
        initialPromptEn = `I see you are interested in **${serviceTitleEn}**. To **maximize your margins and success**, **would you like me to analyze market data or apply competitiveness formulas for a specific project?**`;
      } else if (serviceId === 'veille') {
        initialPromptFr = `Excellent choix ! Le service de **${serviceTitleFr}** vous tiendra informé. **Quel type de marchés ARMP vous intéresse le plus ou avez-vous des critères spécifiques à surveiller ?** Je peux configurer vos alertes en temps réel.`;
        initialPromptEn = `Excellent choice! Our **${serviceTitleEn}** service will keep you informed. **What type of ARMP markets are you most interested in, or do you have specific criteria to monitor?** I can set up your real-time alerts.`;
      } else if (serviceId === 'redaction') {
        initialPromptFr = `Parfait ! L'**${serviceTitleFr}** est là pour vous. **Sur quel type de mémoire technique travaillez-vous, ou avez-vous besoin d'aide pour structurer des arguments complexes ?** Je suis prêt à vous assister dans la rédaction de documents de haut niveau.`;
        initialPromptEn = `Perfect! The **${serviceTitleEn}** is here to help. **What type of technical brief are you working on, or do you need assistance structuring complex arguments?** I'm ready to assist you in drafting high-level documents.`;
      } else {
        initialPromptFr = `Je vois que vous êtes intéressé par l'${serviceTitle}. Souhaitez-vous que je vous explique comment nous avons aidé nos derniers clients avec cet outil ?`;
        initialPromptEn = `I see you are interested in '${serviceTitle}'. Would you like me to explain how we have helped our latest clients with this tool?`;
      }


      const prompt = displayLanguage === 'fr' ? initialPromptFr : initialPromptEn;

      // Sync current chat language with display language for the prompt and subsequent response
      setCurrentLanguage(displayLanguage);

      // Simulate user clicking by sending the prompt as a user message
      const userMessage: Message = { id: Date.now().toString() + '-user-card', sender: 'user', parts: [{ text: prompt, type: 'text' }] };
      setMessages((prevMessages) => [...prevMessages, userMessage]);
      setIsChatLoading(true);

      // Clear any pending summary offer or staged file when a new service card is clicked
      setPdfToSummarize(null);
      setStagedFile(null);

      try {
        const response = await sendMessageToGemini(prompt, messages, displayLanguage, false); // No audio response for card clicks by default
        const botResponseParts: MessagePart[] = [{ text: response.text || 'Désolé, je n\'ai pas pu générer de réponse.', type: 'text' }];
        const botMessage: Message = { id: Date.now().toString() + '-bot-card', sender: 'bot', parts: botResponseParts };
        setMessages((prevMessages) => [...prevMessages, botMessage]);
        setCurrentLanguage(response.detectedLanguage); // Update based on actual Gemini response
      } catch (error) {
        console.error('Error sending card click message to Gemini:', error);
        const errorMessage: Message = { id: Date.now().toString() + '-error-card', sender: 'bot', parts: [{ text: 'Désolé, une erreur est survenue lors de la communication avec le service. Veuillez réessayer plus tard.', type: 'error' }] };
        setMessages((prevMessages) => [...prevMessages, errorMessage]);
      } finally {
        setIsChatLoading(false);
      }
    }
  }, [messages, displayLanguage, currentLanguage, handleSendMessage]); // Depend on messages, displayLanguage, currentLanguage and handleSendMessage

  return (
    <div className="flex flex-col lg:flex-row h-screen font-sans text-[#002366] ai-gradient-background"> {/* Bleu Nuit text with AI gradient background */}
      {/* Left Panel: Service Catalogue */}
      <div className="relative lg:w-1/2 p-6 md:p-10 flex flex-col justify-start items-center overflow-y-auto bg-neutral-100 bg-opacity-80 backdrop-blur-sm"> {/* Blanc Cassé background */}
        {/* Language Toggle */}
        <div className="absolute top-4 right-4 flex space-x-2 z-10">
            <button
                className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors duration-200 ${displayLanguage === 'fr' ? 'bg-[#D4AF37] text-white' : 'bg-neutral-200 text-[#002366] hover:bg-neutral-300'}`}
                onClick={() => setDisplayLanguage('fr')}
            >
                FR
            </button>
            <button
                className={`px-3 py-1 rounded-md text-sm font-semibold transition-colors duration-200 ${displayLanguage === 'en' ? 'bg-[#D4AF37] text-white' : 'bg-neutral-200 text-[#002366] hover:bg-neutral-300'}`}
                onClick={() => setDisplayLanguage('en')}
            >
                EN
            </button>
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold mb-8 text-center leading-tight">
          <span className="text-[#D4AF37]">PAA</span> <span className="block mt-2">Expert Consultant</span>
        </h1>
        <p className="text-lg md:text-xl text-center max-w-2xl mb-12 opacity-80">
          {displayLanguage === 'fr' ? 'Votre partenaire stratégique pour l\'optimisation et la sécurisation de vos marchés publics.' : 'Your strategic partner for optimizing and securing your public procurement.'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          {SERVICES.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onClick={() => handleCardClick(service.id)}
              displayLanguage={displayLanguage} // Pass displayLanguage prop
            />
          ))}
        </div>
        <div className="mt-12 text-center text-sm opacity-70">
          <p>{CONTACT_INFO.location}</p>
          <p>Tél: {CONTACT_INFO.phones.join(' / ')}</p>
          <p>Email: {CONTACT_INFO.email}</p>
        </div>
        {/* Social Proof Text */}
        <div className="mt-8 text-center text-sm opacity-60 italic max-w-2xl">
          {displayLanguage === 'fr' ? 'Une innovation exclusive de PAA Procure and Advisory, développée pour le marché camerounais.' : 'An exclusive innovation from PAA Procure and Advisory, developed for the Cameroonian market.'}
        </div>
      </div>

      {/* Right Panel: Chatbot Interface */}
      <div className="lg:w-1/2 flex flex-col bg-white bg-opacity-80 backdrop-blur-sm border-l border-neutral-200">
        <div className="flex-1 overflow-y-auto p-4 md:p-8" ref={chatWindowRef}>
          <ChatWindow messages={messages} isLoading={isChatLoading} isSpeaking={isSpeaking} />
        </div>
        {/* Chat Input Area (sticky at bottom) */}
        <div className="sticky bottom-0 bg-white bg-opacity-90 backdrop-blur-sm p-4 md:p-6 border-t border-neutral-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem('chatInput') as HTMLInputElement;
              if (input) {
                handleSendMessage(input.value, false); // Explicitly indicate text input
                input.value = '';
              }
            }}
            className="flex gap-4"
          >
            {/* File Upload Button */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              disabled={isChatLoading || isRecording || isSpeaking}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`p-3 rounded-lg shadow-md transition-all duration-300
                ${stagedFile || pdfToSummarize ? 'bg-[#D4AF37] text-white' : 'bg-neutral-200 text-[#002366] hover:bg-neutral-300'}
                disabled:opacity-50 disabled:cursor-not-allowed`}
              disabled={isChatLoading || isRecording || isSpeaking}
              aria-label={currentLanguage === 'fr' ? "Charger un fichier PDF" : "Upload a PDF file"}
            >
              {stagedFile || pdfToSummarize ? '📄✅' : '📄'} {/* PDF icon with checkmark if file is staged or awaiting summary */}
            </button>

            <input
              type="text"
              name="chatInput"
              value={interimText || (stagedFile ? stagedFile.fileName : '') || undefined} // Show filename if staged, otherwise interimText
              onChange={(e) => {
                setInterimText(e.target.value);
                setStagedFile(null); // Clear staged file if user starts typing
              }}
              placeholder={currentLanguage === 'fr' ? "Écrivez votre message..." : "Type your message..."}
              className="flex-1 p-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37] text-gray-900"
              disabled={isChatLoading || isRecording || isSpeaking}
            />
            <button
              type="button"
              onClick={toggleSpeechToText}
              className={`p-3 rounded-lg shadow-md transition-all duration-300
                ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-neutral-200 text-[#002366] hover:bg-neutral-300'}
                disabled:opacity-50 disabled:cursor-not-allowed`}
              disabled={isChatLoading || isSpeaking || !!stagedFile} // Disable voice if file is staged
              aria-label={isRecording ? (currentLanguage === 'fr' ? "Arrêter l'enregistrement" : "Stop recording") : (currentLanguage === 'fr' ? "Démarrer l'enregistrement vocal" : "Start voice recording")}
            >
              {isRecording ? '🔴' : '🎤'}
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-[#002366] text-white font-semibold rounded-lg shadow-md hover:bg-opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isChatLoading || isRecording || isSpeaking || (!interimText.trim() && !stagedFile && !pdfToSummarize)} // Disable send if no text, staged file, or pending summary
            >
              {isChatLoading ? (
                <div className="flex items-center justify-center">
                  <Spinner />
                  <span className="ml-2">{currentLanguage === 'fr' ? 'Envoi...' : 'Sending...'}</span>
                </div>
              ) : (
                currentLanguage === 'fr' ? 'Envoyer' : 'Send'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default App;