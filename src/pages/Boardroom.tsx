import React, { useState, useRef, useEffect } from 'react';
import { useCSuite } from '../store';
import { ChatMessage } from '../components/ChatMessage';
import { chatWithBoardStream } from '../services/ai';
import { Send, Loader2, Sparkles, Paperclip, X, Mic, MicOff, Volume2, AlertCircle, Plus, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { Message, Agent } from '../types';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { cn } from '../components/Layout';

export function Boardroom() {
  const { user, company, companyLoading, team, messages, addMessage, updateMessage } = useCSuite();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [sharedCount, setSharedCount] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isConnected, isRecording, error: voiceError, volume, isThinking, activeAgentId, isMuted, setIsMuted, connect, disconnect, sendImage, sendText } = useGeminiLive({
    company: company!,
    team,
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (voiceMode && isConnected) {
      interval = setInterval(() => {
        setMeetingDuration(prev => prev + 1);
      }, 1000);
    } else {
      setMeetingDuration(0);
    }
    return () => clearInterval(interval);
  }, [voiceMode, isConnected]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleShareLink = () => {
    const url = prompt("Enter a link to share with the board:");
    if (url) {
      sendText(`Founder shared a link: ${url}. Please review and discuss.`);
      setSharedCount(prev => prev + 1);
      addMessage({
        id: uuidv4(),
        companyId: company!.id,
        senderId: 'user',
        text: `Shared a link: ${url}`,
        timestamp: Date.now()
      });
      setShowShareMenu(false);
    }
  };

  const handleShareFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = (event.target?.result as string).split(',')[1];
          sendImage(base64, file.type);
          setSharedCount(prev => prev + 1);
          addMessage({
            id: uuidv4(),
            companyId: company!.id,
            senderId: 'user',
            text: `Shared an image: ${file.name}`,
            timestamp: Date.now()
          });
        };
        reader.readAsDataURL(file);
      } else {
        const text = await file.text();
        sendText(`Founder shared a document (${file.name}):\n\n${text}\n\nPlease review and discuss.`);
        setSharedCount(prev => prev + 1);
        addMessage({
          id: uuidv4(),
          companyId: company!.id,
          senderId: 'user',
          text: `Shared a document: ${file.name}`,
          timestamp: Date.now()
        });
      }
      setShowShareMenu(false);
    } catch (err) {
      console.error("Failed to share file", err);
      alert("Could not share file.");
    }
  };

  const toggleVoiceMode = () => {
    if (voiceMode) {
      disconnect();
      setVoiceMode(false);
      setIsMuted(false);
      setShowShareMenu(false);
      setSharedCount(0);
    } else {
      setVoiceMode(true);
      connect();
    }
  };

  useEffect(() => {
    if (editingMessage) {
      setInput(editingMessage.text);
    }
  }, [editingMessage]);

  const [showTagMenu, setShowTagMenu] = useState(false);

  useEffect(() => {
    if (input.endsWith('@')) {
      setShowTagMenu(true);
    } else if (showTagMenu && !input.includes('@')) {
      setShowTagMenu(false);
    }
  }, [input, showTagMenu]);

  const tagAgent = (agentName: string) => {
    setInput(prev => prev.replace(/@$/, '') + `@${agentName} `);
    setShowTagMenu(false);
  };

  const cancelAction = () => {
    setReplyingTo(null);
    setEditingMessage(null);
    setInput('');
    setShowTagMenu(false);
  };

  // Temporary state for streaming messages before they are finalized
  const [streamingMessages, setStreamingMessages] = useState<Record<string, { text: string, timestamp: number }>>({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessages, loading]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    // Read file content (basic text/markdown support)
    try {
      const text = await selectedFile.text();
      setFileContent(text);
    } catch (err) {
      console.error("Failed to read file", err);
      alert("Could not read file. Please upload a text-based file (.txt, .md, .csv).");
      setFile(null);
      setFileContent('');
    }
    
    // Reset input
    e.target.value = '';
  };

  const clearFile = () => {
    setFile(null);
    setFileContent('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !fileContent) || !company || loading) return;

    let messageText = input.trim();
    if (fileContent) {
      messageText += `\n\n[Attached File: ${file?.name}]\n\`\`\`\n${fileContent.substring(0, 10000)}\n\`\`\``;
    }

    if (editingMessage) {
      await updateMessage(editingMessage.id, { text: messageText });
      cancelAction();
      return;
    }

    const userMessage = {
      id: uuidv4(),
      companyId: company.id,
      senderId: 'user',
      text: replyingTo ? `Replying to: "${replyingTo.text.substring(0, 50)}..."\n\n${messageText}` : messageText,
      timestamp: Date.now()
    };

    addMessage(userMessage);
    cancelAction();
    setLoading(true);
    setStreamingMessages({});

    try {
      await chatWithBoardStream(
        company,
        team,
        messages,
        userMessage.text,
        (agentId) => {
          setStreamingMessages(prev => ({
            ...prev,
            [agentId]: { text: '', timestamp: Date.now() }
          }));
        },
        (agentId, chunk) => {
          setStreamingMessages(prev => {
            const existing = prev[agentId] || { text: '', timestamp: Date.now() };
            return {
              ...prev,
              [agentId]: { 
                ...existing, 
                text: existing.text + chunk 
              }
            };
          });
        },
        (agentId, fullText) => {
          setStreamingMessages(prev => {
            const timestamp = prev[agentId]?.timestamp || Date.now();
            
            if (fullText.trim()) {
              addMessage({
                id: uuidv4(),
                companyId: company.id,
                senderId: agentId,
                text: fullText,
                timestamp: timestamp
              });
            }

            const next = { ...prev };
            delete next[agentId];
            return next;
          });
        }
      );

    } catch (error) {
      console.error('Failed to get board response', error);
      addMessage({
        id: uuidv4(),
        companyId: company.id,
        senderId: 'system',
        text: 'The board encountered an error processing your request.',
        timestamp: Date.now()
      });
    } finally {
      setLoading(false);
    }
  };

  if (companyLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-500">No company data. Please complete onboarding.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 font-sans relative">
      <AnimatePresence>
        {voiceMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col overflow-hidden"
          >
            {/* Meeting Header */}
            <div className="p-6 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                  <Volume2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold tracking-tight">Executive Strategy Session</h2>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Live Discussion</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {isThinking && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-indigo-500/20 text-indigo-400 px-4 py-2 rounded-full text-xs font-bold border border-indigo-500/30 flex items-center gap-2"
                  >
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Processing Strategy...
                  </motion.div>
                )}
                <div className="text-zinc-500 text-sm font-mono flex flex-col items-end">
                  <div className="text-white font-bold">{formatDuration(meetingDuration)}</div>
                  {sharedCount > 0 && (
                    <div className="text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />
                      {sharedCount} SHARED
                    </div>
                  )}
                  <div>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            </div>

            {/* Meeting Grid */}
            <div className="flex-1 p-8 overflow-y-auto">
              <div className={cn(
                "grid gap-6 max-w-6xl mx-auto h-full content-center",
                team.length + 1 <= 2 ? "grid-cols-1 md:grid-cols-2" : 
                team.length + 1 <= 4 ? "grid-cols-2" : 
                "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              )}>
                {/* Founder (User) Tile */}
                <motion.div
                  layout
                  className={cn(
                    "relative aspect-video bg-zinc-900 rounded-3xl overflow-hidden border-2 transition-all duration-500 group",
                    isConnected && isRecording && volume > 0.02 && !isMuted ? "border-emerald-500 shadow-lg shadow-emerald-500/20 scale-[1.02]" : "border-zinc-800"
                  )}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Founder" className="w-full h-full object-cover opacity-60" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-600 text-3xl font-bold">
                        {user?.email?.[0].toUpperCase() || 'F'}
                      </div>
                    )}
                  </div>
                  
                  {/* User Visualizer Overlay */}
                  {isConnected && isRecording && volume > 0.02 && !isMuted && (
                    <div className="absolute inset-0 pointer-events-none">
                      <motion.div 
                        animate={{ opacity: [0, 0.2, 0] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="absolute inset-0 bg-emerald-500/10 ring-inset ring-4 ring-emerald-500/30"
                      />
                      <div className="absolute top-4 right-4">
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg border border-emerald-400"
                        >
                          <Mic className="w-3 h-3" />
                          SPEAKING
                        </motion.div>
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 border border-white/10">
                      <div className={cn("w-2 h-2 rounded-full", isMuted ? "bg-red-500" : "bg-emerald-500")} />
                      <span className="text-white text-xs font-bold">Founder (You) {isMuted && "(Muted)"}</span>
                    </div>
                    {isConnected && isRecording && volume > 0.02 && !isMuted && (
                      <div className="flex gap-0.5 items-end h-4">
                        {[1, 2, 3, 4].map(i => (
                          <motion.div
                            key={i}
                            animate={{ height: [4, 12, 4] }}
                            transition={{ duration: 0.3, delay: i * 0.1, repeat: Infinity }}
                            className="w-1 bg-emerald-500 rounded-full"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Agent Tiles */}
                {team.map(agent => (
                  <motion.div
                    key={agent.id}
                    layout
                    onClick={() => setSelectedAgent(agent)}
                    className={cn(
                      "relative aspect-video bg-zinc-900 rounded-3xl overflow-hidden border-2 transition-all duration-500 group cursor-pointer",
                      activeAgentId === agent.id ? "border-indigo-500 shadow-lg shadow-indigo-500/20 scale-[1.02]" : "border-zinc-800 hover:border-zinc-700",
                      isThinking && "animate-pulse shadow-indigo-500/10"
                    )}
                  >
                    <img 
                      src={agent.avatarUrl} 
                      alt={agent.name} 
                      className={cn(
                        "w-full h-full object-cover transition-all duration-700",
                        activeAgentId === agent.id ? "opacity-100 scale-110" : "opacity-60 grayscale-[0.5] group-hover:opacity-40 group-hover:scale-105"
                      )}
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Hover Info Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-center p-6 text-center">
                      <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest mb-1">{agent.role}</p>
                      <p className="text-white text-sm line-clamp-3 italic">"{agent.bio.substring(0, 120)}..."</p>
                      <div className="mt-4 flex justify-center">
                        <span className="text-[10px] bg-white/10 text-white/60 px-2 py-1 rounded-full border border-white/10">Click for full profile</span>
                      </div>
                    </div>

                    {/* Agent Speaking Overlay */}
                    {activeAgentId === agent.id && (
                      <div className="absolute inset-0 pointer-events-none">
                        <motion.div 
                          animate={{ opacity: [0, 0.2, 0] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="absolute inset-0 bg-indigo-500/10 ring-inset ring-4 ring-indigo-500/30"
                        />
                        <div className="absolute top-4 right-4">
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg border border-indigo-400"
                          >
                            <Volume2 className="w-3 h-3" />
                            SPEAKING
                          </motion.div>
                        </div>
                      </div>
                    )}

                    {/* Thinking Indicator Overlay */}
                    {isThinking && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              animate={{ 
                                scale: [1, 1.5, 1],
                                opacity: [0.3, 1, 0.3]
                              }}
                              transition={{ 
                                duration: 1, 
                                repeat: Infinity, 
                                delay: i * 0.2 
                              }}
                              className="w-2 h-2 bg-indigo-400 rounded-full"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                      <div className={cn(
                        "backdrop-blur-md px-3 py-1.5 rounded-lg flex flex-col border transition-colors duration-300",
                        activeAgentId === agent.id 
                          ? "bg-indigo-600/80 border-indigo-400/50" 
                          : "bg-black/60 border-white/10"
                      )}>
                        <span className="text-white text-xs font-bold">{agent.name}</span>
                        <span className={cn(
                          "text-[10px] font-medium uppercase tracking-tighter",
                          activeAgentId === agent.id ? "text-indigo-100" : "text-zinc-400"
                        )}>{agent.role}</span>
                      </div>
                      {activeAgentId === agent.id && (
                        <div className="flex gap-0.5 items-end h-4">
                          {[1, 2, 3, 4].map(i => (
                            <motion.div
                              key={i}
                              animate={{ height: [4, 12, 4] }}
                              transition={{ duration: 0.3, delay: i * 0.1, repeat: Infinity }}
                              className="w-1 bg-indigo-500 rounded-full"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Meeting Controls */}
            <div className="p-8 bg-gradient-to-t from-black/80 to-transparent relative">
              {/* Share Menu */}
              <AnimatePresence>
                {showShareMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 shadow-2xl flex gap-2"
                  >
                    <button 
                      onClick={handleShareLink}
                      className="flex flex-col items-center gap-2 p-4 hover:bg-zinc-800 rounded-xl transition-colors min-w-[100px]"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                        <LinkIcon className="w-5 h-5" />
                      </div>
                      <span className="text-xs text-white font-medium">Share Link</span>
                    </button>
                    <label className="flex flex-col items-center gap-2 p-4 hover:bg-zinc-800 rounded-xl transition-colors min-w-[100px] cursor-pointer">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="text-xs text-white font-medium">Upload File</span>
                      <input type="file" className="hidden" onChange={handleShareFile} />
                    </label>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Agent Bio Modal */}
              <AnimatePresence>
                {selectedAgent && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedAgent(null)}
                      className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
                    >
                      <button 
                        onClick={() => setSelectedAgent(null)}
                        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors z-10"
                      >
                        <X className="w-5 h-5" />
                      </button>

                      <div className="flex flex-col md:flex-row h-full">
                        <div className="w-full md:w-2/5 aspect-square md:aspect-auto relative">
                          <img 
                            src={selectedAgent.avatarUrl} 
                            alt={selectedAgent.name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent md:bg-gradient-to-r" />
                        </div>

                        <div className="flex-1 p-8 md:p-10">
                          <div className="mb-6">
                            <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest block mb-2">{selectedAgent.role}</span>
                            <h2 className="text-3xl font-bold text-white mb-1">{selectedAgent.name}</h2>
                          </div>

                          <div className="space-y-6">
                            <div>
                              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-2">Professional Bio</h3>
                              <p className="text-zinc-300 text-sm leading-relaxed italic">
                                "{selectedAgent.bio}"
                              </p>
                            </div>

                            <div>
                              <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-2">Core Expertise</h3>
                              <div className="flex flex-wrap gap-2">
                                {selectedAgent.expertise.map((skill, idx) => (
                                  <span 
                                    key={idx}
                                    className="bg-indigo-500/10 text-indigo-300 text-[10px] font-bold px-3 py-1 rounded-full border border-indigo-500/20"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-10 pt-6 border-t border-zinc-800 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Active in current session</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              <div className="max-w-md mx-auto flex items-center justify-center gap-6">
                <button 
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className={cn(
                    "w-14 h-14 rounded-full border transition-all flex items-center justify-center",
                    showShareMenu ? "bg-indigo-600 border-indigo-500 text-white" : "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                  )}
                  title="Share Resources"
                >
                  <Plus className={cn("w-6 h-6 transition-transform", showShareMenu && "rotate-45")} />
                </button>
                <button 
                  onClick={() => setIsMuted(!isMuted)}
                  className={cn(
                    "w-14 h-14 rounded-full border transition-all flex items-center justify-center",
                    isMuted 
                      ? "bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500/30" 
                      : "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                  )}
                  title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>
                <button 
                  onClick={toggleVoiceMode}
                  className="px-8 py-4 bg-red-600 text-white rounded-full font-bold flex items-center gap-3 hover:bg-red-700 transition-all shadow-xl shadow-red-900/20"
                >
                  <MicOff className="w-5 h-5" />
                  End Strategy Session
                </button>
                <button 
                  className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white hover:bg-zinc-700 transition-all"
                  title="Settings"
                >
                  <AlertCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Error Alert Overlay */}
            {voiceError && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-3 p-4 bg-red-500 text-white rounded-2xl shadow-2xl z-50"
              >
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm font-bold">{voiceError}</p>
                <button onClick={() => disconnect()} className="ml-4 p-1 hover:bg-white/20 rounded-full">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="bg-white border-b border-zinc-200 p-6 flex-shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">The Boardroom</h1>
            <p className="text-sm text-zinc-500">Discuss strategy with your executive team.</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleVoiceMode}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm border",
                voiceMode 
                  ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" 
                  : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
              )}
            >
              {voiceMode ? (
                <>
                  <MicOff className="w-4 h-4" />
                  Exit Voice Mode
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Start Voice Discussion
                </>
              )}
            </button>
            <div className="flex -space-x-2">
            {team.slice(0, 5).map(agent => (
              <div key={agent.id} className="relative">
                <img
                  src={agent.avatarUrl}
                  alt={agent.name}
                  className={cn(
                    "w-10 h-10 rounded-full border-2 object-cover transition-all duration-300",
                    activeAgentId === agent.id ? "border-indigo-500 scale-110 z-10 shadow-lg shadow-indigo-500/50" : "border-white"
                  )}
                  referrerPolicy="no-referrer"
                  title={`${agent.name} (${agent.role})`}
                />
                {activeAgentId === agent.id && (
                  <motion.div
                    layoutId="speaking-indicator"
                    className="absolute -bottom-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg"
                    initial={{ scale: 0 }}
                    animate={{ 
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      scale: { repeat: Infinity, duration: 1 }
                    }}
                  >
                    <Volume2 className="w-2 h-2 text-white" />
                  </motion.div>
                )}
              </div>
            ))}
            {team.length > 5 && (
              <div className="w-10 h-10 rounded-full border-2 border-white bg-zinc-100 flex items-center justify-center text-xs font-medium text-zinc-600">
                +{team.length - 5}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

      <div className="flex-1 overflow-y-auto p-6 relative">
        <div className="max-w-4xl mx-auto space-y-2">
          {messages.length === 0 && Object.keys(streamingMessages).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-indigo-500" />
              </div>
              <h2 className="text-xl font-bold text-zinc-900 mb-2">Welcome to the Boardroom</h2>
              <p className="text-zinc-500 max-w-md">
                Your C-Suite is ready. Ask a question, present a challenge, upload a document, or paste a website link to get started.
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <ChatMessage 
                    message={msg} 
                    agent={team.find(a => a.id === msg.senderId)} 
                    onReply={setReplyingTo}
                    onEdit={setEditingMessage}
                  />
                </motion.div>
              ))}
              
              {/* Render streaming messages */}
              {Object.entries(streamingMessages).map(([agentId, data]) => (
                <motion.div
                  key={`stream-${agentId}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <ChatMessage 
                    message={{
                      id: `stream-${agentId}`,
                      companyId: company.id,
                      senderId: agentId,
                      text: data.text || '...',
                      timestamp: data.timestamp
                    }} 
                    agent={team.find(a => a.id === agentId)} 
                    onReply={setReplyingTo}
                  />
                </motion.div>
              ))}
            </>
          )}
          
          {loading && Object.keys(streamingMessages).length === 0 && (
            <div className="flex items-center gap-3 py-4 text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">The CEO is deciding who should speak...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-white border-t border-zinc-200 p-6 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          {(file || replyingTo || editingMessage) && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-zinc-100 rounded-lg w-fit">
              {file && <Paperclip className="w-4 h-4 text-zinc-500" />}
              {replyingTo && <span className="text-xs font-semibold text-indigo-600">Replying to: {replyingTo.text.substring(0, 20)}...</span>}
              {editingMessage && <span className="text-xs font-semibold text-amber-600">Editing message...</span>}
              <button onClick={cancelAction} className="p-1 hover:bg-zinc-200 rounded-full text-zinc-500">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
            {showTagMenu && (
              <div className="absolute bottom-full left-0 mb-2 bg-white border border-zinc-200 rounded-lg shadow-lg p-2 z-50">
                {team.map(agent => (
                  <button type="button" key={agent.id} onClick={() => tagAgent(agent.name)} className="block w-full text-left px-3 py-2 hover:bg-zinc-100 rounded text-sm">
                    @{agent.name}
                  </button>
                ))}
              </div>
            )}
            <div className="relative flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Address the board or paste a link..."
                  disabled={loading}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-full pl-6 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:opacity-50"
                />
                <label className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-zinc-600 cursor-pointer transition-colors">
                  <input type="file" className="hidden" onChange={handleFileChange} disabled={loading} accept=".txt,.md,.csv,.json" />
                  <Paperclip className="w-5 h-5" />
                </label>
              </div>
              <button
                type="button"
                onClick={toggleVoiceMode}
                className="w-12 h-12 flex-shrink-0 bg-white border border-zinc-200 text-zinc-600 rounded-full flex items-center justify-center hover:bg-zinc-50 transition-colors shadow-sm"
                title="Start Voice Discussion"
              >
                <Mic className="w-5 h-5" />
              </button>
            </div>
            <button
              type="submit"
              disabled={(!input.trim() && !fileContent) || loading}
              className="w-12 h-12 flex-shrink-0 bg-zinc-900 text-white rounded-full flex items-center justify-center hover:bg-zinc-800 disabled:opacity-50 disabled:hover:bg-zinc-900 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <p className="text-xs text-center text-zinc-400 mt-3">
            AI executives provide simulated advice. Always verify critical business decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
