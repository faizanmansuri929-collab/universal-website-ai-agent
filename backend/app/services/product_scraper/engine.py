import datetime
import uuid
import traceback
from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.schemas import ScrapeJobDB, ProductDB
from app.services.product_scraper.base import BaseProductAdapter, ScrapeResult
from app.services.product_scraper.instamart import InstamartAdapter
from app.services.product_scraper.generic import GenericWebsiteAdapter

class ScraperEngine:
    def __init__(self):
        self.adapters: List[BaseProductAdapter] = [
            InstamartAdapter(),
            GenericWebsiteAdapter(),
        ]

    def get_adapter(self, url: str) -> BaseProductAdapter:
        for adapter in self.adapters:
            if adapter.can_handle(url):
                return adapter
        return self.adapters[-1] # fallback to generic

    async def run_job(self, job_id: str, url: str, max_products: int = 100):
        """
        Background worker that executes the scraping job,
        streams progress updates to DB, and persists all extracted products.
        """
        db: Session = SessionLocal()
        try:
            job = db.query(ScrapeJobDB).filter(ScrapeJobDB.id == job_id).first()
            if not job:
                return

            adapter = self.get_adapter(url)
            job.website = adapter.name
            job.status = "SCRAPING"
            job.progress_message = f"Starting {adapter.name} scraper..."
            db.commit()

            async def progress_callback(msg: str, found: int, extracted: int):
                # Update progress in DB for polling clients
                try:
                    inner_db: Session = SessionLocal()
                    j = inner_db.query(ScrapeJobDB).filter(ScrapeJobDB.id == job_id).first()
                    if j:
                        j.progress_message = msg
                        j.total_found = found
                        j.total_saved = extracted
                        inner_db.commit()
                    inner_db.close()
                except Exception:
                    pass

            result: ScrapeResult = await adapter.scrape(
                url=url,
                max_products=max_products,
                progress_callback=progress_callback
            )

            # Re-query job in fresh session
            job = db.query(ScrapeJobDB).filter(ScrapeJobDB.id == job_id).first()
            if not job:
                return

            if result.error_message and not result.products:
                job.status = "FAILED"
                job.error_message = result.error_message
                job.progress_message = result.error_message
                job.completed_at = datetime.datetime.utcnow()
                db.commit()
                return

            # Save extracted products to database
            job.progress_message = f"Saving {len(result.products)} products to database..."
            db.commit()

            saved_count = 0
            for item in result.products:
                product_db = ProductDB(
                    id=str(uuid.uuid4()),
                    scrape_job_id=job.id,
                    source_url=item.source_url,
                    product_url=item.product_url,
                    product_name=item.product_name,
                    brand=item.brand or "",
                    selling_price=item.selling_price,
                    mrp=item.mrp,
                    discount=item.discount or "",
                    pack_size=item.pack_size or "",
                    availability=item.availability or "In Stock",
                    image_url=item.image_url or "",
                    description=item.description or "",
                    category=item.category or "",
                    city=item.city or result.city or "",
                    location_context=item.location_context or result.location_context or "",
                    raw_data=item.raw_data or {},
                    scraped_at=datetime.datetime.utcnow()
                )
                db.add(product_db)
                saved_count += 1

            job.status = "COMPLETED"
            job.total_found = result.total_found
            job.total_saved = saved_count
            job.duplicates_removed = result.duplicates_removed
            job.city = result.city
            job.location_context = result.location_context
            job.completed_at = datetime.datetime.utcnow()
            job.progress_message = f"Completed successfully. {saved_count} products saved."
            db.commit()

        except Exception as e:
            traceback.print_exc()
            job = db.query(ScrapeJobDB).filter(ScrapeJobDB.id == job_id).first()
            if job:
                job.status = "FAILED"
                job.error_message = f"Scraping error: {str(e)}"
                job.progress_message = "Scraping failed."
                job.completed_at = datetime.datetime.utcnow()
                db.commit()
        finally:
            db.close()

scraper_engine = ScraperEngine()
