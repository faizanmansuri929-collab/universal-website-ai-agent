from typing import List, Dict, Any

def chunk_text(
    text: str,
    url: str,
    title: str,
    page_id: str,
    chunk_size: int = 800,
    chunk_overlap: int = 150
) -> List[Dict[str, Any]]:
    """
    Splits page text into overlapping chunks with metadata for vector embedding.
    """
    if not text or not text.strip():
        return []

    chunks = []
    start = 0
    text_len = len(text)
    chunk_index = 0

    while start < text_len:
        end = start + chunk_size

        # Adjust end to avoid cutting sentences/paragraphs abruptly
        if end < text_len:
            next_break = text.rfind("\n\n", start, end)
            if next_break == -1 or next_break <= start:
                next_break = text.rfind(". ", start, end)
            if next_break != -1 and next_break > start + 200:
                end = next_break + 1

        chunk_str = text[start:end].strip()
        if chunk_str:
            chunks.append({
                "id": f"{page_id}_{chunk_index}",
                "text": chunk_str,
                "metadata": {
                    "page_id": page_id,
                    "url": url,
                    "title": title,
                    "chunk_index": chunk_index
                }
            })
            chunk_index += 1

        # Move start forward with overlap
        start += chunk_size - chunk_overlap
        if start >= text_len:
            break

    return chunks
