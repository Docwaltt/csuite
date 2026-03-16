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
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

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
  }, []);

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

  const connect = useCallback(async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const systemInstruction = `You are the virtual C-Suite board of ${company.name}. 
      The board members are:
      ${team.map(a => `- ${a.name} (${a.role}): ${a.bio}`).join('\n')}
      
      You are in a real-time voice discussion with the Founder. 
      You should respond as the appropriate board members. 
      
      CRITICAL INTERRUPTION HANDLING:
      1. You can be interrupted at any time. 
      2. If the Founder interrupts you, STOP speaking immediately (the system handles the audio cut, but you must pivot your thought).
      3. Acknowledge the interruption gracefully (e.g., "I see your point," or "That's a valid concern").
      4. Address the new concern or question immediately.
      5. After addressing the new point, try to re-contextualize or repurpose what you were saying before the interruption to align with the new direction.
      
      Keep responses concise, conversational, and professional.
      When a specific member speaks, start with "[Name]: " in your transcription if possible, but focus on the audio.
      `;

      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            startRecording();
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
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
            
            if (message.serverContent?.interrupted) {
              // Stop current playback immediately
              if (currentSourceRef.current) {
                currentSourceRef.current.stop();
                currentSourceRef.current = null;
              }
              audioQueueRef.current = [];
              isPlayingRef.current = false;
            }
          },
          onclose: () => {
            setIsConnected(false);
            stopAudio();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            setError("Connection error. Please try again.");
            setIsConnected(false);
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

  const startRecording = async () => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        if (!sessionRef.current || !isConnected) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
        }

        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        sessionRef.current.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
      setError("Microphone access denied.");
    }
  };

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    stopAudio();
    setIsConnected(false);
  }, [stopAudio]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isRecording,
    error,
    connect,
    disconnect
  };
}
