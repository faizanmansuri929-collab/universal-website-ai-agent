import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export interface CrawlJob {
  id: string;
  agent_id: string;
  status: string;
  pages_discovered: number;
  pages_processed: number;
  pages_indexed: number;
  pages_failed: number;
  pages_skipped: number;
  current_page_url?: string;
  started_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface Entity {
  id: string;
  entity_type: string;
  entity_name: string;
  attributes: Record<string, any>;
  source_url: string;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  website_url: string;
  scope: 'current_page' | 'subpath' | 'entire_website';
  status: 'QUEUED' | 'CRAWLING' | 'PROCESSING' | 'INDEXING' | 'COMPLETED' | 'FAILED';
  primary_color: string;
  welcome_message: string;
  detected_sector: string;
  sector_confidence: number;
  sector_reason: string;
  created_at: string;
  last_crawled_at?: string;
  indexed_pages_count: number;
  structured_entities_count: number;
  total_chunks_count: number;
  active_job?: CrawlJob;
}

export interface Page {
  id: string;
  url: string;
  title: string;
  char_count: number;
  http_status: number;
  crawled_at: string;
}

export interface PageDetail extends Page {
  description: string;
  content_text: string;
  entities: Entity[];
}

export interface Citation {
  url: string;
  title: string;
  snippet: string;
}

export interface DebugTraceItem {
  chunk_id: string;
  title: string;
  url: string;
  score: number;
  matched_entity?: string;
  snippet: string;
}

export interface DebugTrace {
  detected_intent: string;
  detected_entity_type?: string;
  detected_entity?: string;
  applied_filters: Record<string, any>;
  matched_structured_entities: string[];
  retrieved_sources: string[];
  reranked_chunks: DebugTraceItem[];
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  debug_trace?: DebugTrace;
}

export const api = {
  createAgent: async (url: string, scope: string = 'entire_website', name?: string): Promise<Agent> => {
    const res = await axios.post(`${API_BASE}/agents`, { url, scope, name });
    return res.data;
  },

  getAgent: async (id: string): Promise<Agent> => {
    const res = await axios.get(`${API_BASE}/agents/${id}`);
    return res.data;
  },

  updateAgent: async (id: string, data: { name?: string; primary_color?: string; welcome_message?: string }): Promise<Agent> => {
    const res = await axios.patch(`${API_BASE}/agents/${id}`, data);
    return res.data;
  },

  recrawlAgent: async (id: string): Promise<CrawlJob> => {
    const res = await axios.post(`${API_BASE}/agents/${id}/recrawl`);
    return res.data;
  },

  getAgentPages: async (id: string): Promise<Page[]> => {
    const res = await axios.get(`${API_BASE}/agents/${id}/pages`);
    return res.data;
  },

  getPageDetail: async (agentId: string, pageId: string): Promise<PageDetail> => {
    const res = await axios.get(`${API_BASE}/agents/${agentId}/pages/${pageId}`);
    return res.data;
  },

  getAgentEntities: async (agentId: string): Promise<Entity[]> => {
    const res = await axios.get(`${API_BASE}/agents/${agentId}/entities`);
    return res.data;
  },

  chatWithAgent: async (
    id: string,
    message: string,
    history: { role: string; content: string }[] = [],
    debug: boolean = false
  ): Promise<ChatResponse> => {
    const res = await axios.post(`${API_BASE}/agents/${id}/chat`, { message, history, debug });
    return res.data;
  }
};
