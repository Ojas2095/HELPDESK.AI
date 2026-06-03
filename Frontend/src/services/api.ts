import axios from 'axios';
import { MOCK_TICKETS } from './mockData';
import { API_CONFIG } from '../config';
import { Ticket, AIAnalysisResult } from '../types';

const USE_MOCK = true;
const API_BASE_URL = API_CONFIG.BACKEND_URL;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Safe helper to get data from storage or default
const getStorage = <T>(key: string, defaultData: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) {
      setStorage(key, defaultData);
      return defaultData;
    }
    return JSON.parse(stored) as T;
  } catch (error) {
    console.warn(`[Storage Error] Failed to read or parse '${key}':`, error);
    return defaultData;
  }
};

// Safe helper to set data and handle QuotaExceeded
const setStorage = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn(`[Storage Error] Failed to write '${key}'. Possible quota exceeded:`, error);
  }
};

export const api = {
  getTickets: async (): Promise<Ticket[] | undefined> => {
    if (USE_MOCK) {
      await delay(500);
      return getStorage<Ticket[]>('tickets', MOCK_TICKETS as Ticket[]);
    }
  },

  createTicket: async (ticketData: Partial<Ticket>): Promise<{ data: Ticket } | undefined> => {
    if (USE_MOCK) {
      await delay(800);
      const tickets = getStorage<Ticket[]>('tickets', MOCK_TICKETS as Ticket[]);
      const newTicket: Ticket = {
        ticket_id: "TCKT-" + Math.floor(Math.random() * 10000),
        status: 'Open',
        createdAt: new Date().toISOString(),
        priority: ticketData.priority || 'Medium',
        category: ticketData.category || 'Other',
        ...ticketData,
        messages: [
          {
            sender: 'user',
            message: ticketData.description || ticketData.summary || '',
            timestamp: new Date().toISOString()
          }
        ]
      };
      tickets.unshift(newTicket);
      setStorage('tickets', tickets);
      return { data: newTicket };
    }
  },

  predictTicket: async (issueText: string, imageBase64: string = ""): Promise<{ data: Partial<AIAnalysisResult> & { ticket_id: string } }> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/ai/analyze_ticket`, {
        text: issueText,
        image_base64: imageBase64,
        image_text: ""
      });

      const result = response.data;

      return {
        data: {
          ticket_id: "TCKT-" + Math.floor(Math.random() * 10000),
          category: result.category,
          subcategory: result.subcategory,
          priority: result.priority,
          assigned_team: result.assigned_team,
          auto_resolve: result.auto_resolve,
          confidence: result.confidence,
          duplicate_ticket: {
            similarity: result.duplicate_ticket.similarity,
            duplicate_ticket_id: result.duplicate_ticket.duplicate_ticket_id
          },
          summary: result.summary,
          entities: result.entities,
          reasoning: result.reasoning,
          decision_factors: result.decision_factors,
          image_description: result.image_description,
          ocr_text: result.ocr_text
        }
      };
    } catch (error) {
      console.error("AI Backend Error, falling back to mock:", error);
      await delay(1000);
      return {
        data: {
          ticket_id: "TCKT-MOCK-" + Math.floor(Math.random() * 10000),
          category: "Hardware",
          priority: "Medium",
          assigned_team: "Hardware Support",
          auto_resolve: false,
          confidence: 0.5,
          duplicate_ticket: { similarity: 0.0 },
          summary: issueText.substring(0, 50) + "...",
          entities: [],
          reasoning: "Mock fallback",
          decision_factors: ["Mocked"]
        }
      };
    }
  },

  logCorrection: async (correctionPayload: any): Promise<void> => {
    try {
      await axios.post(`${API_BASE_URL}/ai/log_correction`, correctionPayload);
    } catch (error) {
      console.warn("[Correction Log] Failed to save correction:", error);
    }
  }
};
