from abc import ABC, abstractmethod
from typing import List

class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate_response(self, prompt: str, system_instruction: str = "") -> str:
        pass

class BaseEmbeddingProvider(ABC):
    @abstractmethod
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        pass
    
    @abstractmethod
    def embed_query(self, query: str) -> List[float]:
        pass
