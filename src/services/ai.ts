import { GoogleGenAI, Type } from "@google/genai";
import { Agent, CompanyContext, Message } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateTeam(industry: string, category: string, companyName: string): Promise<Agent[]> {
  const prompt = `You are an expert business consultant. A startup named "${companyName}" in the "${industry}" industry and "${category}" category needs a C-Suite executive team.
  Generate a team of 4 to 6 highly specialized C-Suite members (e.g., CEO, COO, CMO, CTO, Head of Sales, etc.) tailored to this specific business.
  Each member should have 28 years of experience and deep expertise.
  Return a JSON array of objects, where each object has:
  - id: a unique lowercase string (e.g., "ceo", "cmo")
  - role: their job title (e.g., "Chief Executive Officer")
  - name: a realistic full name
  - bio: a brief, professional biography highlighting their 28 years of experience and specific achievements relevant to the industry.
  - expertise: an array of 3-5 specific areas of expertise (strings).
  - avatarUrl: a realistic avatar URL using picsum (e.g., "https://picsum.photos/seed/ceo-${companyName.replace(/\\s+/g, '')}/200")
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            role: { type: Type.STRING },
            name: { type: Type.STRING },
            bio: { type: Type.STRING },
            expertise: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            avatarUrl: { type: Type.STRING }
          },
          required: ["id", "role", "name", "bio", "expertise", "avatarUrl"]
        }
      }
    }
  });

  try {
    let text = (response.text || "[]").trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\\n?/, '').replace(/\\n?```$/, '').trim();
    }
    return JSON.parse(text) as Agent[];
  } catch (e) {
    console.error("Failed to parse team generation response", e);
    return [];
  }
}

export async function generateGoals(objective: string, company: CompanyContext): Promise<{ smartGoals: string[], kpis: string[] }> {
  const prompt = `You are an expert business strategist. The company "${company.name}" in the "${company.industry}" industry has the following high-level objective:
  
  Objective: "${objective}"
  
  Generate 3 to 5 SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound) and 3 to 5 Key Performance Indicators (KPIs) to track progress toward this objective.
  
  Return a JSON object with:
  - smartGoals: an array of strings (the SMART goals)
  - kpis: an array of strings (the KPIs)
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          smartGoals: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          kpis: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["smartGoals", "kpis"]
      }
    }
  });

  try {
    let text = (response.text || "{}").trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    return JSON.parse(text) as { smartGoals: string[], kpis: string[] };
  } catch (e) {
    console.error("Failed to parse goals generation response", e);
    return { smartGoals: [], kpis: [] };
  }
}

export interface AgentResponse {
  agentId: string;
  message: string;
}

export async function chatWithBoardStream(
  company: CompanyContext,
  team: Agent[],
  history: Message[],
  userMessage: string,
  onAgentStart: (agentId: string) => void,
  onStreamChunk: (agentId: string, chunk: string) => void,
  onAgentComplete: (agentId: string, fullText: string) => void
): Promise<void> {
  const systemInstruction = `You are the CEO and Orchestrator of a virtual C-Suite boardroom for a startup.
  Company Context:
  Name: ${company.name}
  Industry: ${company.industry}
  Category: ${company.category}
  Description: ${company.description}

  The Team:
  ${team.map(a => `- ${a.id} (${a.role}): ${a.bio}. Expertise: ${a.expertise.join(", ")}`).join("\\n")}

  The user is the Founder/Chairperson addressing the board.
  
  ROLE-BASED ADDRESSING:
  - If the Founder addresses a specific role (e.g., "CEO", "CTO"), that specific board member MUST be included in the response list.
  - If the Founder addresses the "Board" or "Team" generally, select the most relevant 1 to 3 members.
  
  Your task:
  1. Determine which 1 to 3 board members should respond to the user's message based on their specific roles and expertise.
  2. Return a JSON array of their agent IDs in the order they should speak.
  `;

  const chatHistoryText = history.slice(-10).map(msg => {
    const sender = msg.senderId === 'user' ? 'Founder' : team.find(a => a.id === msg.senderId)?.name || msg.senderId;
    return `${sender}: ${msg.text}`;
  }).join("\n\n");

  const prompt = `Chat History:\\n${chatHistoryText}\\n\\nFounder: ${userMessage}\\n\\nWhich agents should respond? Return a JSON array of strings (agent IDs).`;

  const hasUrl = /https?:\/\/[^\s]+/.test(prompt);
  const toolsConfig = hasUrl ? [{ urlContext: {} }] : undefined;

  let selectedAgents: string[] = [];
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        ...(toolsConfig && { tools: toolsConfig })
      }
    });

    let text = (response.text || "[]").trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\\n?/, '').replace(/\\n?```$/, '').trim();
    }
    selectedAgents = JSON.parse(text) as string[];
  } catch (e) {
    console.error("Failed to parse orchestrator response", e);
    // Fallback to CEO or first agent
    selectedAgents = [team[0]?.id].filter(Boolean);
  }

  // Ensure valid agents and remove duplicates
  selectedAgents = Array.from(new Set(selectedAgents.filter(id => team.some(a => a.id === id)))).slice(0, 3);
  if (selectedAgents.length === 0 && team.length > 0) {
    selectedAgents = [team[0].id];
  }

  // Now, stream responses for each selected agent sequentially
  let currentHistory = `${chatHistoryText}\\n\\nFounder: ${userMessage}`;

  for (const agentId of selectedAgents) {
    const agent = team.find(a => a.id === agentId)!;
    onAgentStart(agentId);

    const agentPrompt = `You are ${agent.name}, the ${agent.role} of ${company.name}.
    Company Context: ${company.description}
    Your Bio: ${agent.bio}
    Your Expertise: ${agent.expertise.join(", ")}

    The Founder has addressed the board. Respond from your specific perspective and expertise.
    
    VOICE & PERSONALITY:
    - DO NOT sound like a robotic AI assistant.
    - Use natural, human-like speech patterns.
    - Use professional yet conversational language.
    - Be decisive and strategic.
    
    INSTRUCTIONS:
    - Keep your response concise, actionable, and professional. Use markdown.
    - Do not introduce yourself (e.g., "Hi, I'm the CEO"), just give your advice directly as the character.
    
    Current Conversation:
    ${currentHistory}
    
    Your Response:`;

    try {
      const stream = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: agentPrompt,
        config: {
          ...(toolsConfig && { tools: toolsConfig })
        }
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        if (chunk.text) {
          fullResponse += chunk.text;
          onStreamChunk(agentId, chunk.text);
        }
      }
      
      // Append this agent's response to the history for the next agent
      currentHistory += `\\n\\n${agent.name}: ${fullResponse}`;
      onAgentComplete(agentId, fullResponse);
    } catch (e) {
      console.error(`Failed to stream response for agent ${agentId}`, e);
      onStreamChunk(agentId, "\\n*(Encountered an error while speaking)*");
      onAgentComplete(agentId, "\\n*(Encountered an error while speaking)*");
    }
  }
}
