import httpx
import re

url = "https://poornimainstitute.edu.in/assets/index-CBqCxG5T.js"
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
resp = httpx.get(url, headers=headers, follow_redirects=True, verify=False)
text = resp.text

# Extract string literals containing readable sentences and paragraphs
raw_strings = re.findall(r'"([^"\\]{20,400})"', text)
passages = []
for s in raw_strings:
    s = s.strip()
    if re.search(r'[a-zA-Z]{3,}\s+[a-zA-Z]{3,}', s):
        if not any(x in s for x in ['webpack', 'node_modules', 'css-', 'px', 'calc(', 'transform', 'display:']):
            passages.append(s)

print(f"Extracted {len(passages)} rich text blocks from SPA bundle!")
print("\nSample Extracted Knowledge:")
for p in passages[:12]:
    print(" •", p)
