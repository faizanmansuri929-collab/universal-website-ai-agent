import abc
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Callable, Awaitable

@dataclass
class ScrapedProductItem:
    product_name: str
    product_url: str
    source_url: str
    selling_price: Optional[float] = None
    mrp: Optional[float] = None
    discount: Optional[str] = ""
    pack_size: Optional[str] = ""
    availability: str = "In Stock"
    image_url: Optional[str] = ""
    description: Optional[str] = ""
    brand: Optional[str] = ""
    category: Optional[str] = ""
    city: Optional[str] = ""
    location_context: Optional[str] = ""
    raw_data: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ScrapeResult:
    products: List[ScrapedProductItem]
    website: str
    total_found: int
    duplicates_removed: int
    city: Optional[str] = ""
    location_context: Optional[str] = ""
    error_message: Optional[str] = None

class BaseProductAdapter(abc.ABC):
    name: str = "BaseAdapter"

    @abc.abstractmethod
    def can_handle(self, url: str) -> bool:
        """Return True if this adapter is suitable for the given URL."""
        pass

    @abc.abstractmethod
    async def scrape(
        self,
        url: str,
        max_products: int = 100,
        progress_callback: Optional[Callable[[str, int, int], Awaitable[None]]] = None,
    ) -> ScrapeResult:
        """
        Scrapes product data from the URL.
        progress_callback: async func(message: str, found_count: int, extracted_count: int)
        """
        pass
