import io
import csv
import uuid
import datetime
import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, asc

from app.core.database import get_db
from app.models.schemas import (
    ScrapeJobDB, ProductDB,
    CreateScrapeJobRequest, ScrapeJobResponse,
    ProductResponse, PaginatedProductsResponse
)
from app.services.product_scraper.engine import scraper_engine

router = APIRouter(prefix="/scraper", tags=["Product Scraper"])

@router.post("/jobs", response_model=ScrapeJobResponse)
async def create_scrape_job(
    request: CreateScrapeJobRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Product listing URL is required.")

    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"

    adapter = scraper_engine.get_adapter(url)
    job_id = str(uuid.uuid4())

    job = ScrapeJobDB(
        id=job_id,
        source_url=url,
        website=adapter.name,
        status="QUEUED",
        progress_message="Job queued. Initializing scraper...",
        total_found=0,
        total_saved=0,
        total_failed=0,
        duplicates_removed=0,
        started_at=datetime.datetime.utcnow()
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    max_products = request.max_products or 100
    # Launch in background
    background_tasks.add_task(scraper_engine.run_job, job_id, url, max_products)

    return job

@router.get("/jobs", response_model=list[ScrapeJobResponse])
def list_scrape_jobs(db: Session = Depends(get_db)):
    jobs = db.query(ScrapeJobDB).order_by(desc(ScrapeJobDB.started_at)).all()
    return jobs

@router.get("/jobs/{job_id}", response_model=ScrapeJobResponse)
def get_scrape_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(ScrapeJobDB).filter(ScrapeJobDB.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Scrape job not found.")
    return job

@router.delete("/jobs/{job_id}")
def delete_scrape_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(ScrapeJobDB).filter(ScrapeJobDB.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Scrape job not found.")
    db.delete(job)
    db.commit()
    return {"status": "deleted", "job_id": job_id}

@router.get("/jobs/{job_id}/products", response_model=PaginatedProductsResponse)
def get_job_products(
    job_id: str,
    search: Optional[str] = None,
    brand: Optional[str] = None,
    category: Optional[str] = None,
    availability: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: Optional[str] = "name_asc", # name_asc, name_desc, price_asc, price_desc, discount_desc, time_desc
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    job = db.query(ScrapeJobDB).filter(ScrapeJobDB.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Scrape job not found.")

    query = db.query(ProductDB).filter(ProductDB.scrape_job_id == job_id)

    # Collect unique brands & categories for filters
    all_prods = db.query(ProductDB.brand, ProductDB.category).filter(ProductDB.scrape_job_id == job_id).all()
    unique_brands = sorted(list(set(b[0] for b in all_prods if b[0])))
    unique_categories = sorted(list(set(c[1] for c in all_prods if c[1])))

    # Apply search
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                ProductDB.product_name.ilike(search_filter),
                ProductDB.brand.ilike(search_filter),
                ProductDB.category.ilike(search_filter),
                ProductDB.description.ilike(search_filter)
            )
        )

    # Apply filters
    if brand:
        query = query.filter(ProductDB.brand == brand)
    if category:
        query = query.filter(ProductDB.category == category)
    if availability:
        if availability.lower() in ["in stock", "available", "instock"]:
            query = query.filter(ProductDB.availability.ilike("%In Stock%"))
        elif availability.lower() in ["out of stock", "sold out", "unavailable"]:
            query = query.filter(ProductDB.availability.ilike("%Out of Stock%"))
    if min_price is not None:
        query = query.filter(ProductDB.selling_price >= min_price)
    if max_price is not None:
        query = query.filter(ProductDB.selling_price <= max_price)

    # Apply sorting
    if sort_by == "name_desc":
        query = query.order_by(desc(ProductDB.product_name))
    elif sort_by == "price_asc":
        query = query.order_by(asc(ProductDB.selling_price))
    elif sort_by == "price_desc":
        query = query.order_by(desc(ProductDB.selling_price))
    elif sort_by == "time_desc":
        query = query.order_by(desc(ProductDB.scraped_at))
    else: # name_asc
        query = query.order_by(asc(ProductDB.product_name))

    total = query.count()
    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()
    pages = (total + limit - 1) // limit if total > 0 else 1

    return PaginatedProductsResponse(
        items=items,
        total=total,
        page=page,
        pages=pages,
        brands=unique_brands,
        categories=unique_categories
    )

@router.get("/jobs/{job_id}/export/csv")
def export_products_csv(job_id: str, db: Session = Depends(get_db)):
    job = db.query(ScrapeJobDB).filter(ScrapeJobDB.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Scrape job not found.")

    products = db.query(ProductDB).filter(ProductDB.scrape_job_id == job_id).order_by(asc(ProductDB.product_name)).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header Row
    writer.writerow([
        "Product Name",
        "Brand",
        "Description",
        "Pack Size",
        "Selling Price (INR)",
        "MRP (INR)",
        "Discount",
        "Availability",
        "Product URL",
        "Image URL",
        "Category",
        "City",
        "Location Context",
        "Source URL",
        "Scraped At"
    ])

    for p in products:
        writer.writerow([
            p.product_name,
            p.brand or "",
            p.description or "",
            p.pack_size or "",
            p.selling_price if p.selling_price is not None else "",
            p.mrp if p.mrp is not None else "",
            p.discount or "",
            p.availability or "",
            p.product_url,
            p.image_url or "",
            p.category or "",
            p.city or "",
            p.location_context or "",
            p.source_url,
            p.scraped_at.strftime("%Y-%m-%d %H:%M:%S") if p.scraped_at else ""
        ])

    output.seek(0)
    filename = f"products_{job.website.lower()}_{job_id[:8]}.csv"

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@router.get("/jobs/{job_id}/export/excel")
def export_products_excel(job_id: str, db: Session = Depends(get_db)):
    job = db.query(ScrapeJobDB).filter(ScrapeJobDB.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Scrape job not found.")

    products = db.query(ProductDB).filter(ProductDB.scrape_job_id == job_id).order_by(asc(ProductDB.product_name)).all()

    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Scraped Products"

        # Styles
        header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid") # Dark Blue
        header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
        regular_font = Font(name="Arial", size=10)
        thin_border = Border(
            left=Side(style="thin", color="E2E8F0"),
            right=Side(style="thin", color="E2E8F0"),
            top=Side(style="thin", color="E2E8F0"),
            bottom=Side(style="thin", color="E2E8F0"),
        )

        headers = [
            "Product Name", "Brand", "Description", "Pack Size", "Selling Price (₹)",
            "MRP (₹)", "Discount", "Availability", "Category", "City",
            "Location Context", "Image URL", "Product URL", "Source URL", "Scraped At"
        ]

        ws.append(headers)
        for col_num, _ in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")

        ws.row_dimensions[1].height = 28

        for row_idx, p in enumerate(products, start=2):
            row_data = [
                p.product_name,
                p.brand or "",
                p.description or "",
                p.pack_size or "",
                p.selling_price if p.selling_price is not None else "",
                p.mrp if p.mrp is not None else "",
                p.discount or "",
                p.availability or "",
                p.category or "",
                p.city or "",
                p.location_context or "",
                p.image_url or "",
                p.product_url,
                p.source_url,
                p.scraped_at.strftime("%Y-%m-%d %H:%M:%S") if p.scraped_at else ""
            ]
            ws.append(row_data)

            # Apply cell styles
            for col_idx in range(1, len(headers) + 1):
                c = ws.cell(row=row_idx, column=col_idx)
                c.font = regular_font
                c.border = thin_border
                if col_idx in [5, 6]: # Price / MRP
                    c.alignment = Alignment(horizontal="right")
                elif col_idx in [7, 8]: # Discount / Availability
                    c.alignment = Alignment(horizontal="center")

        # Auto-adjust column widths
        for col in ws.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = col[0].column_letter
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 45)

        excel_stream = io.BytesIO()
        wb.save(excel_stream)
        excel_stream.seek(0)

        filename = f"products_{job.website.lower()}_{job_id[:8]}.xlsx"
        return StreamingResponse(
            excel_stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )

    except ImportError:
        # Fallback to CSV if openpyxl is not present
        return export_products_csv(job_id, db)
