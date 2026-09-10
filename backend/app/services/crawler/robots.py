import httpx
from urllib.parse import urlparse, urljoin
from urllib.robotparser import RobotFileParser
from typing import List, Set, Optional, Tuple

class RobotsManager:
    def __init__(self, user_agent: str = "UniversalAIAgentBot/1.0"):
        self.user_agent = user_agent
        self.parsers = {}

    async def get_parser(self, url: str) -> Tuple[RobotFileParser, List[str]]:
        parsed = urlparse(url)
        domain = f"{parsed.scheme}://{parsed.netloc}"
        
        if domain in self.parsers:
            return self.parsers[domain]

        robots_url = urljoin(domain, "/robots.txt")
        rp = RobotFileParser()
        sitemaps = []
        
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(robots_url)
                if resp.status_code == 200:
                    content = resp.text
                    rp.parse(content.splitlines())
                    
                    # Extract sitemaps
                    for line in content.splitlines():
                        if line.lower().startswith("sitemap:"):
                            parts = line.split(":", 1)
                            if len(parts) > 1:
                                sitemaps.append(parts[1].strip())
                else:
                    rp.allow_all = True
        except Exception:
            rp.allow_all = True
            
        self.parsers[domain] = (rp, sitemaps)
        return rp, sitemaps

    async def is_allowed(self, url: str) -> bool:
        try:
            rp, _ = await self.get_parser(url)
            return rp.can_fetch(self.user_agent, url)
        except Exception:
            return True
