import os
from typing import List
from app.services.llm.base import BaseLLMProvider, BaseEmbeddingProvider

class GeminiLLMProvider(BaseLLMProvider):
    def __init__(self, api_key: str = None):
        self.api_key = (api_key or os.getenv("GEMINI_API_KEY", "")).strip()
        if not self.api_key:
            raise ValueError("Gemini API key is empty")
        try:
            from google import genai
            self.client = genai.Client(api_key=self.api_key)
        except Exception as e:
            raise ValueError(f"Gemini client init failed: {e}")

    async def generate_response(self, prompt: str, system_instruction: str = "") -> str:
        if not self.client:
            raise ValueError("Gemini API key is missing or client failed to initialize.")
        
        contents = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt
        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents
        )
        return response.text if response and response.text else "No response generated."


class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(self, api_key: str = None):
        self.api_key = (api_key or os.getenv("GEMINI_API_KEY", "")).strip()
        if not self.api_key:
            raise ValueError("Gemini API key is empty")
        try:
            from google import genai
            self.client = genai.Client(api_key=self.api_key)
        except Exception as e:
            raise ValueError(f"Gemini embedding init failed: {e}")

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not self.client:
            raise ValueError("Gemini API key missing")
        embeddings = []
        for text in texts:
            res = self.client.models.embed_content(
                model="text-embedding-004",
                contents=text
            )
            embeddings.append(res.embedding.values)
        return embeddings

    def embed_query(self, query: str) -> List[float]:
        return self.embed_texts([query])[0]
