import hashlib
from typing import List
from app.services.llm.base import BaseLLMProvider, BaseEmbeddingProvider

class MockLLMProvider(BaseLLMProvider):
    """
    Fallback LLM provider when no external API key is provided.
    Extracts answer directly from context passages.
    """
    async def generate_response(self, prompt: str, system_instruction: str = "") -> str:
        # Extract user query and context block from prompt
        context_str = ""
        user_query = ""
        
        if "CONTEXT:" in prompt and "USER QUERY:" in prompt:
            parts = prompt.split("USER QUERY:")
            context_str = parts[0].replace("CONTEXT:", "").strip()
            user_query = parts[1].strip()
        else:
            context_str = prompt
            user_query = prompt

        if not context_str or "No matching context found" in context_str:
            return "I couldn't find that specific information in the crawled website knowledge."

        # Simple heuristic: Return most relevant passage from context
        passages = [p.strip() for p in context_str.split("\n\n") if p.strip()]
        if passages:
            # Pick passage with highest keyword overlap
            query_words = set(user_query.lower().split())
            best_passage = max(passages, key=lambda p: len(set(p.lower().split()).intersection(query_words)))
            return f"Based on the website content: {best_passage}"
        
        return "I found relevant website context, but could not formulate a specific answer."


class LocalSentenceEmbeddingProvider(BaseEmbeddingProvider):
    """
    Local embedding provider using SentenceTransformers or deterministic feature hash vectors.
    """
    def __init__(self):
        self.model = None
        try:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception as e:
            print(f"[LocalSentenceEmbeddingProvider] SentenceTransformer fallback to feature hash: {e}")

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if self.model:
            embeddings = self.model.encode(texts, convert_to_numpy=True)
            return embeddings.tolist()
        
        # Fallback hash vector (64 dimensions)
        results = []
        for text in texts:
            vec = [0.0] * 64
            words = text.lower().split()
            for word in words:
                h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
                idx = h % 64
                vec[idx] += 1.0
            norm = sum(x*x for x in vec) ** 0.5 or 1.0
            results.append([x / norm for x in vec])
        return results

    def embed_query(self, query: str) -> List[float]:
        return self.embed_texts([query])[0]
