import os
import httpx
from typing import List
from app.services.llm.base import BaseLLMProvider, BaseEmbeddingProvider

class OpenAILLMProvider(BaseLLMProvider):
    def __init__(self, api_key: str = None):
        self.api_key = (api_key or os.getenv("OPENAI_API_KEY", "")).strip()
        if not self.api_key:
            raise ValueError("OpenAI API key is empty")
        self.api_url = "https://api.openai.com/v1/chat/completions"

    async def generate_response(self, prompt: str, system_instruction: str = "") -> str:
        if not self.api_key:
            raise ValueError("OpenAI API key missing")
        
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "gpt-4o-mini",
            "messages": messages,
            "temperature": 0.2
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.api_url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise ValueError(f"OpenAI API Error ({resp.status_code}): {resp.text}")
            data = resp.json()
            return data["choices"][0]["message"]["content"]


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(self, api_key: str = None):
        self.api_key = (api_key or os.getenv("OPENAI_API_KEY", "")).strip()
        if not self.api_key:
            raise ValueError("OpenAI API key is empty")
        self.api_url = "https://api.openai.com/v1/embeddings"

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not self.api_key:
            raise ValueError("OpenAI API key missing")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "text-embedding-3-small",
            "input": texts
        }

        with httpx.Client(timeout=30.0) as client:
            resp = client.post(self.api_url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise ValueError(f"OpenAI Embeddings Error ({resp.status_code}): {resp.text}")
            data = resp.json()
            return [item["embedding"] for item in data["data"]]

    def embed_query(self, query: str) -> List[float]:
        return self.embed_texts([query])[0]
