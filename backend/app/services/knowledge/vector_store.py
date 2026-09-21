import os
import re
import math
from typing import List, Dict, Any, Optional
from app.core.config import settings

class VectorStore:
    """
    Tenant-isolated hybrid search (Vector + BM25 Keyword) vector store manager for AI agent knowledge base.
    Uses ChromaDB with safe count capping and keyword search fallback/hybrid merging.
    """
    def __init__(self, persist_dir: str = None):
        self.persist_dir = persist_dir or settings.CHROMA_PERSIST_DIR
        self.chroma_client = None
        self.doc_registry = {} # collection_name -> list of {id, text, metadata, vector}
        self._init_chroma()

    def _init_chroma(self):
        try:
            import chromadb
            os.makedirs(self.persist_dir, exist_ok=True)
            self.chroma_client = chromadb.PersistentClient(path=self.persist_dir)
        except Exception as e:
            print(f"[VectorStore] Fallback to local memory store: {e}")

    def _get_collection_name(self, agent_id: str) -> str:
        return f"agent_{agent_id.replace('-', '_')}"

    def get_or_create_collection(self, agent_id: str):
        collection_name = self._get_collection_name(agent_id)
        if collection_name not in self.doc_registry:
            self.doc_registry[collection_name] = []

        if self.chroma_client:
            try:
                return self.chroma_client.get_or_create_collection(name=collection_name)
            except Exception as e:
                print(f"[VectorStore] get_or_create_collection error: {e}")
        return collection_name

    def delete_agent_collection(self, agent_id: str):
        col_name = self._get_collection_name(agent_id)
        self.doc_registry.pop(col_name, None)
        if self.chroma_client:
            try:
                self.chroma_client.delete_collection(name=col_name)
            except Exception:
                pass

    def delete_page_chunks(self, agent_id: str, page_id: str):
        col_name = self._get_collection_name(agent_id)
        if col_name in self.doc_registry:
            self.doc_registry[col_name] = [
                item for item in self.doc_registry[col_name]
                if item.get("metadata", {}).get("page_id") != page_id
            ]

        if self.chroma_client:
            try:
                collection = self.get_or_create_collection(agent_id)
                collection.delete(where={"page_id": page_id})
            except Exception:
                pass

    def add_chunks(self, agent_id: str, chunks: List[Dict[str, Any]], embeddings: List[List[float]]):
        if not chunks:
            return

        col_name = self._get_collection_name(agent_id)
        if col_name not in self.doc_registry:
            self.doc_registry[col_name] = []

        ids = [chunk["id"] for chunk in chunks]
        texts = [chunk["text"] for chunk in chunks]
        metadatas = [chunk["metadata"] for chunk in chunks]

        for i, chunk_id in enumerate(ids):
            # Check if chunk already in registry
            self.doc_registry[col_name] = [item for item in self.doc_registry[col_name] if item["id"] != chunk_id]
            self.doc_registry[col_name].append({
                "id": chunk_id,
                "text": texts[i],
                "metadata": metadatas[i],
                "vector": embeddings[i] if embeddings and i < len(embeddings) else []
            })

        if self.chroma_client and embeddings:
            try:
                collection = self.get_or_create_collection(agent_id)
                collection.add(
                    ids=ids,
                    documents=texts,
                    embeddings=embeddings,
                    metadatas=metadatas
                )
            except Exception as e:
                print(f"[VectorStore] Chroma add_chunks error: {e}")

    def search_similarity(
        self,
        agent_id: str,
        query_embedding: List[float],
        top_k: int = 5,
        query_text: str = ""
    ) -> List[Dict[str, Any]]:
        col_name = self._get_collection_name(agent_id)
        registered_docs = self.doc_registry.get(col_name, [])
        results_map = {} # id -> {text, metadata, score}

        # 1. Chroma vector search (with safe count capping!)
        if self.chroma_client and query_embedding:
            try:
                collection = self.get_or_create_collection(agent_id)
                total_count = collection.count()
                if total_count > 0:
                    actual_k = min(top_k, total_count)
                    chroma_res = collection.query(
                        query_embeddings=[query_embedding],
                        n_results=actual_k,
                        include=["documents", "metadatas", "distances"]
                    )
                    
                    if chroma_res and chroma_res.get("documents") and len(chroma_res["documents"]) > 0:
                        docs = chroma_res["documents"][0]
                        metas = chroma_res["metadatas"][0] if chroma_res.get("metadatas") else [{}] * len(docs)
                        dists = chroma_res["distances"][0] if chroma_res.get("distances") else [0.0] * len(docs)
                        ids = chroma_res["ids"][0] if chroma_res.get("ids") else [str(i) for i in range(len(docs))]
                        
                        for doc_id, doc, meta, dist in zip(ids, docs, metas, dists):
                            score = max(0.0, 1.0 - (dist if dist is not None else 0.5))
                            results_map[doc_id] = {
                                "id": doc_id,
                                "text": doc,
                                "metadata": meta,
                                "score": score
                            }
            except Exception as e:
                print(f"[VectorStore] Chroma query error: {e}")

        # 2. Local Registry Search (Cosine + BM25/Keyword Matching)
        query_terms = set(re.findall(r"\w+", (query_text or "").lower()))
        
        for item in registered_docs:
            doc_id = item["id"]
            doc_text = item["text"]
            meta = item["metadata"]
            doc_vec = item.get("vector", [])

            # Keyword overlap score
            doc_words = set(re.findall(r"\w+", doc_text.lower()))
            overlap = len(query_terms.intersection(doc_words))
            kw_score = overlap / (len(query_terms) or 1.0)

            # Cosine similarity score
            cos_score = 0.0
            if query_embedding and doc_vec and len(query_embedding) == len(doc_vec):
                dot = sum(a * b for a, b in zip(query_embedding, doc_vec))
                m1 = math.sqrt(sum(a * a for a in query_embedding))
                m2 = math.sqrt(sum(b * b for b in doc_vec))
                if m1 > 0 and m2 > 0:
                    cos_score = dot / (m1 * m2)

            combined_score = (cos_score * 0.5) + (kw_score * 0.5)

            if doc_id in results_map:
                results_map[doc_id]["score"] = max(results_map[doc_id]["score"], combined_score)
            else:
                results_map[doc_id] = {
                    "id": doc_id,
                    "text": doc_text,
                    "metadata": meta,
                    "score": combined_score
                }

        # 3. If still empty, return all available registered chunks if small
        if not results_map and registered_docs:
            for item in registered_docs[:top_k]:
                results_map[item["id"]] = {
                    "id": item["id"],
                    "text": item["text"],
                    "metadata": item["metadata"],
                    "score": 0.5
                }

        sorted_results = sorted(results_map.values(), key=lambda x: x["score"], reverse=True)
        return sorted_results[:top_k]

    def search(
        self,
        agent_id: str,
        query_embedding: List[float],
        top_k: int = 5,
        query_text: str = ""
    ) -> List[Dict[str, Any]]:
        return self.search_similarity(agent_id, query_embedding, top_k, query_text)

vector_store = VectorStore()
