"""
RAG (Retrieval-Augmented Generation) engine for FinAI.

Two retrieval backends, chosen automatically:
  - "embedding" : Gemini text-embedding model (semantic search). Used whenever
                   a Gemini client is available — understands meaning, not just
                   shared words (e.g. "grow my money safely" -> SIP chunk).
  - "tfidf"      : scikit-learn TF-IDF + cosine similarity (local, free, no key
                   needed). Automatic fallback if no Gemini client is passed in,
                   or if an embedding call ever fails.

The public interface (retrieve_context, rebuild_index, chunks) is unchanged,
so nothing else in the app needs to know which backend is active.
"""
import re
import numpy as np
from typing import List, Dict, Optional

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from rag.document_processor import load_and_chunk


STOP_WORDS_QUERY = {
    "what", "is", "the", "a", "an", "how", "do", "i", "can", "in", "and",
    "or", "to", "my", "of", "about", "tell", "me", "give", "show", "please",
    "explain", "define", "meaning", "details"
}

EMBEDDING_BATCH_SIZE = 20  # Gemini embed_content accepts a batch of contents


class RAGEngine:
    def __init__(self, knowledge_base_path: str, gemini_client=None,
                 embedding_model: str = "gemini-embedding-001"):
        self.knowledge_base_path = knowledge_base_path
        self.gemini_client = gemini_client
        self.embedding_model = embedding_model

        self.chunks: List[Dict] = []
        self.backend: str = "tfidf"  # set for real in _build_index()

        # tfidf backend state
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.chunk_vectors = None

        # embedding backend state
        self.chunk_embeddings: Optional[np.ndarray] = None

        self._build_index()

    # ------------------------------------------------------------------
    # Index building
    # ------------------------------------------------------------------

    def _build_index(self):
        self.chunks = load_and_chunk(self.knowledge_base_path)

        if self.gemini_client is not None:
            try:
                self._build_embedding_index()
                self.backend = "embedding"
                return
            except Exception as e:
                print(f"[RAG] Embedding index failed, falling back to TF-IDF: {e}")

        self._build_tfidf_index()
        self.backend = "tfidf"

    def _corpus_texts(self) -> List[str]:
        # Title repeated for extra weight, same trick used by both backends.
        return [f"{c['title']} {c['title']} {c['title']}. {c['text']}" for c in self.chunks]

    def _build_tfidf_index(self):
        corpus = self._corpus_texts()
        self.vectorizer = TfidfVectorizer(
            stop_words="english",
            ngram_range=(1, 2),
            max_features=10000,
            sublinear_tf=True,
        )
        self.chunk_vectors = self.vectorizer.fit_transform(corpus)

    def _build_embedding_index(self):
        from google.genai import types
        corpus = self._corpus_texts()
        vectors: List[List[float]] = []
        for i in range(0, len(corpus), EMBEDDING_BATCH_SIZE):
            batch = corpus[i:i + EMBEDDING_BATCH_SIZE]
            result = self.gemini_client.models.embed_content(
                model=self.embedding_model,
                contents=batch,
                config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
            )
            vectors.extend(e.values for e in result.embeddings)
        self.chunk_embeddings = np.array(vectors, dtype=np.float32)

    def rebuild_index(self):
        """Hot-reload the knowledge base without restarting the server."""
        self._build_index()

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    def retrieve_context(self, query: str, top_k: int = 4, min_score: float = 0.15) -> List[Dict]:
        if not query or not query.strip() or not self.chunks:
            return []

        if self.backend == "embedding":
            try:
                return self._retrieve_embedding(query, top_k, min_score)
            except Exception as e:
                print(f"[RAG] Embedding query failed, falling back to TF-IDF for this request: {e}")
                if self.vectorizer is None:
                    self._build_tfidf_index()
                return self._retrieve_tfidf(query, top_k, min_score)

        return self._retrieve_tfidf(query, top_k, min_score)

    def _title_boost(self, query: str, scores: np.ndarray) -> np.ndarray:
        query_words = set(re.findall(r"\w+", query.lower())) - STOP_WORDS_QUERY
        boosted = scores.copy()
        for idx, chunk in enumerate(self.chunks):
            title_words = set(re.findall(r"\w+", chunk["title"].lower()))
            overlap = query_words.intersection(title_words)
            if overlap:
                boosted[idx] += 0.30 * len(overlap)
        return boosted

    def _retrieve_tfidf(self, query: str, top_k: int, min_score: float) -> List[Dict]:
        query_vec = self.vectorizer.transform([query])
        scores = cosine_similarity(query_vec, self.chunk_vectors).flatten()
        final_scores = self._title_boost(query, scores)
        return self._top_results(final_scores, top_k, min_score)

    def _retrieve_embedding(self, query: str, top_k: int, min_score: float) -> List[Dict]:
        from google.genai import types
        result = self.gemini_client.models.embed_content(
            model=self.embedding_model,
            contents=[query],
            config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
        )
        query_vec = np.array(result.embeddings[0].values, dtype=np.float32).reshape(1, -1)
        scores = cosine_similarity(query_vec, self.chunk_embeddings).flatten()
        # Embedding cosine scores sit in a different range than TF-IDF's, and
        # title-word overlap is still a useful signal on top of semantics —
        # keep the boost, just smaller since embedding scores run higher.
        final_scores = self._title_boost(query, scores * 0.5)
        return self._top_results(final_scores, top_k, min_score * 0.5)

    def _top_results(self, final_scores: np.ndarray, top_k: int, min_score: float) -> List[Dict]:
        ranked_indices = final_scores.argsort()[::-1][:top_k]
        results = []
        for idx in ranked_indices:
            score = float(final_scores[idx])
            if score >= min_score:
                results.append({
                    "title": self.chunks[idx]["title"],
                    "text": self.chunks[idx]["text"],
                    "score": round(score, 4),
                })
        return results

    def get_all_section_titles(self) -> List[str]:
        return [c["title"] for c in self.chunks]
