# Universal Website AI Agent Platform

A full-stack agentic platform that ingests public website URLs, crawls & extracts content (including modern React/Vite/Next.js Single Page Applications), automatically classifies industry sectors, extracts structured domain entities, and serves a grounded RAG chatbot with clickable source citations, change detection re-crawling, and embeddable widget capabilities.

## Architecture

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Lucide Icons, Framer Motion
- **Backend**: FastAPI (Python 3.11+), Async HTTP Crawler, BeautifulSoup, ChromaDB Vector Store, SQLAlchemy (SQLite)
- **LLM Engine**: Pluggable LLM provider (OpenAI GPT-4o-mini / Gemini / Mock fallback) with sector-aware prompt engineering and query analyzer / reranker.

## Quick Start

### 1. Prerequisites
- Python 3.11+
- Node.js 18+

### 2. Backend Setup
`ash
cd backend
pip install -r requirements.txt
cp .env.example .env # Add your OPENAI_API_KEY
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
`

### 3. Frontend Setup
`ash
cd frontend
npm install
npm run dev
`

### 4. One-Click Demo
On Windows, double-click start_demo.bat to launch both backend and frontend servers simultaneously.

## Features
- **Automatic Sector Detection**: Classifies websites into Healthcare/Hospital, Education/College, SaaS/Software, Manufacturing, or General Business.
- **SPA Deep Extraction**: Parses client-side JS bundles to extract hidden routes, service catalogs, contact details, and Schema.org metadata.
- **Domain Entity Extractor**: Extracts structured entities (courses, degrees, doctors, services, addresses, contacts) linked to source pages.
- **Grounded RAG & Citations**: Answers questions using hybrid retrieval and multi-factor reranking with clickable source URLs.
- **Diagnostic Debug Mode**: Real-time trace inspector for intents, entity filters, rerank scores, and candidate chunks.
- **Embeddable Widget**: Lightweight embed script for any external website.
