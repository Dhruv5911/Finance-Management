"""
Splits the finance knowledge markdown document into retrievable chunks.
Each chunk corresponds to one '## Section' of the document, which keeps
retrieval results coherent and lets us show a clean "source" name to the user.
"""
import re
from typing import List, Dict


def load_and_chunk(file_path: str) -> List[Dict]:
    """
    Reads the markdown knowledge base and splits it into chunks by H2 headers (##).
    Returns a list of dicts: {"title": str, "text": str}
    """
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Split on H2 headers, keeping the header text
    pattern = re.compile(r"^##\s+(.+)$", re.MULTILINE)
    matches = list(pattern.finditer(content))

    chunks = []
    for i, match in enumerate(matches):
        title = match.group(1).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        body = content[start:end].strip()
        if body:
            chunks.append({"title": title, "text": body})

    return chunks
