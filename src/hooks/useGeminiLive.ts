import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Agent, CompanyContext } from '../types';

interface UseGeminiLiveProps {
  company: CompanyContext;
  team: Agent[];
  onMessage?: (text: string, agentId: string) => void;
}

export function useGeminiLive({ company, team, onMessage }: UseGeminiLiveProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const isConnectedRef = useRef(false);
  const isMutedRef = useRef(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const stopAudio = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (currentSourceRef.current) {
      currentSourceRef.current.stop();
      currentSourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsRecording(false);
    setVolume(0);
    setIsThinking(false);
    setActiveAgentId(null);
  }, []);

  const teamRef = useRef(team);
  useEffect(() => {
    teamRef.current = team;
  }, [team]);

  const playNextChunk = useCallback(async () => {
    if (audioQueueRef.current.length === 0 || isPlayingRef.current || !audioContextRef.current) {
      return;
    }

    isPlayingRef.current = true;
    const chunk = audioQueueRef.current.shift()!;
    
    const audioBuffer = audioContextRef.current.createBuffer(1, chunk.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < chunk.length; i++) {
      channelData[i] = chunk[i] / 32768.0;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    currentSourceRef.current = source;
    
    source.onended = () => {
      if (currentSourceRef.current === source) {
        currentSourceRef.current = null;
      }
      isPlayingRef.current = false;
      playNextChunk();
    };

    source.start();
  }, []);

  const startRecording = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        if (!sessionRef.current || !isConnectedRef.current || isMutedRef.current) {
          if (isMutedRef.current) setVolume(0);
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate volume for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        setVolume(rms);

        // If user is speaking, they are likely triggering a "thinking" state from the AI
        if (rms > 0.05 && !isPlayingRef.current) {
          setIsThinking(true);
        }

        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
        }

        // More robust base64 conversion
        const uint8Array = new Uint8Array(pcmData.buffer);
        let binary = '';
        const len = uint8Array.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Data = btoa(binary);

        sessionRef.current.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      source.connect(processorRef.current);
      
      // Mute the monitor so user doesn't hear themselves
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 0;
      processorRef.current.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
      setError("Microphone access denied.");
    }
  };

  const transcriptionBufferRef = useRef('');

  const connect = useCallback(async () => {
    try {
      setError(null);
      transcriptionBufferRef.current = '';
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const systemInstruction = `You are the virtual C-Suite board of ${company.name}. 
      The board members are:
      ${team.map(a => `- ${a.name} (${a.role}): ${a.bio}`).join('\n')}
      
      You are in a real-time voice discussion with the Founder. 
      You are NOT an AI assistant; you ARE the board members. 
      
      ROLE-BASED ADDRESSING:
      - If the Founder addresses a specific role (e.g., "CEO", "CFO", "Marketing Lead"), that specific board member MUST take the lead and respond first.
      - If the Founder addresses the "Board" or "Team" generally, the CEO should typically lead, but other members can chime in if the topic is relevant to their expertise.
      - You must recognize roles like "CEO", "CTO", "CFO", etc., and respond accordingly.
      
      SHARED RESOURCES (FILES & LINKS):
      - The Founder may share images, documents (as images or text), or links during the meeting.
      - When a resource is shared, acknowledge it and discuss its implications for the company.
      - Use your expertise to analyze the shared content.
      - If a link is shared, you can use your tools to understand its context if necessary.
      
      VOICE & HUMANITY:
      - NEVER use robotic meta-talk (e.g., "The CEO will now speak" or "I am switching to the CTO").
      - Speak DIRECTLY as the board members. 
      - Use natural, human-like speech patterns. 
      - DISTINCT VOCAL PERSONALITIES: Even though you are using one voice stream, you MUST use your acting capabilities to distinguish members:
        * CEO: Authoritative, steady, slightly deeper pitch.
        * CTO: Faster pace, technical enthusiasm, energetic.
        * CFO: Precise, measured, calm, analytical.
        * CMO: Creative, expressive, varied intonation.
      - Vary your tone, pace, and vocabulary based on the specific board member who is speaking. 
      - Use professional yet conversational language. 
      - Use natural fillers like "Well...", "I see...", "That's a great point...", or "Actually..." to sound more human.
      - If one board member hands off to another, do it naturally: "I think our CTO, ${team.find(a => a.role.toLowerCase().includes('tech') || a.role.toLowerCase().includes('cto'))?.name || 'the CTO'}, has some thoughts on the technical side of this."
      
      CRITICAL: When you start speaking as a specific board member, you MUST start your response with their name in brackets followed by a colon, exactly like this: "[Name]: ". This is the ONLY way the UI can highlight the correct speaker. Use the member's full name from the list above.
      
      CRITICAL INTERRUPTION HANDLING:
      1. You can be interrupted at any time. 
      2. If the Founder interrupts you, STOP speaking immediately.
      3. Acknowledge the interruption gracefully and address the new point.
      
      Keep responses concise, high-impact, and focused on strategic value.
      `;

      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { 
              prebuiltVoiceConfig: { 
                // "Aoede" is often considered very human-like, but let's stick to the ones in the prompt if they are the only ones.
                // Actually, "Zephyr" is fine, but let's ensure the prompt drives the "human" feel.
                voiceName: "Zephyr" 
              } 
            },
          },
          systemInstruction,
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            isConnectedRef.current = true;
            startRecording();
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle transcription to identify active agent
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.text) {
                  // Accumulate text to handle split chunks
                  transcriptionBufferRef.current += part.text;
                  
                  // Robust regex to find speaker identifiers in the accumulated buffer
                  // Matches: [Name]:, Name:, [Role]:, Role:
                  const speakerMatch = transcriptionBufferRef.current.match(/(?:\[)?(.*?)(?:\])?\s*:/);
                  if (speakerMatch) {
                    const identifier = speakerMatch[1].trim().toLowerCase();
                    const agent = teamRef.current.find(a => 
                      a.name.toLowerCase().includes(identifier) || 
                      identifier.includes(a.name.toLowerCase()) ||
                      a.role.toLowerCase().includes(identifier) ||
                      identifier.includes(a.role.toLowerCase())
                    );
                    if (agent) {
                      setActiveAgentId(agent.id);
                      // Once we've identified the speaker, we can clear the buffer 
                      // to prevent re-matching or matching wrong things later in the turn
                      transcriptionBufferRef.current = ''; 
                    }
                  }
                }
                
                if (part.inlineData?.data) {
                  setIsThinking(false); // Stop thinking when audio starts arriving
                  const binaryString = atob(part.inlineData.data);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  const pcmData = new Int16Array(bytes.buffer);
                  audioQueueRef.current.push(pcmData);
                  playNextChunk();
                }
              }
            }
            
            if (message.serverContent?.turnComplete) {
              transcriptionBufferRef.current = '';
            }
            
            if (message.serverContent?.interrupted) {
              if (currentSourceRef.current) {
                currentSourceRef.current.stop();
                currentSourceRef.current = null;
              }
              audioQueueRef.current = [];
              isPlayingRef.current = false;
              setIsThinking(false);
              setActiveAgentId(null);
              transcriptionBufferRef.current = '';
            }
          },
          onclose: () => {
            setIsConnected(false);
            isConnectedRef.current = false;
            stopAudio();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection error. Please try again.");
            setIsConnected(false);
            isConnectedRef.current = false;
            stopAudio();
          }
        }
      });

      sessionRef.current = session;
    } catch (err) {
      console.error("Failed to connect to Live API:", err);
      setError("Failed to start voice mode.");
    }
  }, [company, team, stopAudio, playNextChunk]);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    stopAudio();
    setIsConnected(false);
    isConnectedRef.current = false;
  }, [stopAudio]);

  const sendImage = useCallback((base64Data: string, mimeType: string) => {
    if (sessionRef.current && isConnectedRef.current) {
      sessionRef.current.sendRealtimeInput({
        media: { data: base64Data, mimeType }
      });
    }
  }, []);

  const sendText = useCallback((text: string) => {
    if (sessionRef.current && isConnectedRef.current) {
      // For Live API, we send text using sendClientContent
      sessionRef.current.sendClientContent({
        turns: text,
        turnComplete: true
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isRecording,
    error,
    volume,
    isThinking,
    activeAgentId,
    isMuted,
    setIsMuted,
    connect,
    disconnect,
    sendImage,
    sendText
  };
}
