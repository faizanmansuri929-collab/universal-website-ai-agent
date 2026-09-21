import sys
import asyncio
import io
import csv
import openpyxl
from fastapi.testclient import TestClient

# Set utf-8 output encoding
sys.stdout.reconfigure(encoding='utf-8')

from app.main import app
from app.core.database import SessionLocal
from app.models.schemas import ScrapeJobDB, ProductDB

client = TestClient(app)

async def test_end_to_end():
    print("==================================================")
    print("RUNNING PRODUCT SCRAPER END-TO-END VERIFICATION")
    print("==================================================")

    # 1. Start Scrape Job for Instamart
    test_url = "https://instamart.in/c/instant-and-frozen-food"
    print(f"\n[1] Submitting Scrape Job for: {test_url}")
    res = client.post("/api/scraper/jobs", json={"url": test_url, "max_products": 50})
    assert res.status_code == 200, f"Failed to create job: {res.text}"
    job_data = res.json()
    job_id = job_data["id"]
    print(f"    Job Created: ID={job_id}, Website={job_data['website']}, Status={job_data['status']}")

    # 2. Wait for background scraping to complete (poll every 1.5s, up to 30s)
    print(f"\n[2] Polling Job Status...")
    max_retries = 25
    job = None
    for attempt in range(max_retries):
        await asyncio.sleep(1.5)
        res = client.get(f"/api/scraper/jobs/{job_id}")
        assert res.status_code == 200
        job = res.json()
        print(f"    Attempt {attempt+1}: Status={job['status']}, Found={job['total_found']}, Saved={job['total_saved']}, Msg='{job['progress_message']}'")
        if job["status"] in ["COMPLETED", "FAILED"]:
            break

    assert job["status"] == "COMPLETED", f"Job did not complete successfully: {job}"
    print(f"    Job Completed! Saved: {job['total_saved']} products, Duplicates Cleaned: {job['duplicates_removed']}, City: {job['city']}")

    # 3. Verify Products Query & Pagination
    print(f"\n[3] Fetching Scraped Products from DB via API...")
    res = client.get(f"/api/scraper/jobs/{job_id}/products?limit=10")
    assert res.status_code == 200
    prods_data = res.json()
    total_products = prods_data["total"]
    print(f"    Total Products in DB: {total_products}")
    print(f"    Unique Brands ({len(prods_data['brands'])}): {prods_data['brands'][:5]}")
    print(f"    Unique Categories ({len(prods_data['categories'])}): {prods_data['categories'][:5]}")
    assert total_products > 0, "No products were saved in the database!"

    # Print sample extracted products
    print(f"\n    Sample Extracted Products:")
    for p in prods_data["items"][:5]:
        print(f"     - Name: {p['product_name']}")
        print(f"       Brand: {p['brand']} | Pack Size: {p['pack_size']}")
        print(f"       Selling Price: ₹{p['selling_price']} | MRP: ₹{p['mrp']} | Discount: {p['discount']}")
        print(f"       Availability: {p['availability']} | URL: {p['product_url'][:60]}...")
        assert p["product_name"], "Product Name is required"
        assert p["selling_price"] is not None or p["mrp"] is not None, "Product must have price data"

    # 4. Test Search by Name
    print(f"\n[4] Testing Search Functionality...")
    sample_query = "Noodles"
    res = client.get(f"/api/scraper/jobs/{job_id}/products?search={sample_query}")
    assert res.status_code == 200
    search_data = res.json()
    print(f"    Search for '{sample_query}': Found {search_data['total']} products")
    if search_data["items"]:
        print(f"    Top Match: {search_data['items'][0]['product_name']}")

    # 5. Test Sorting (Price Low to High)
    print(f"\n[5] Testing Sort by Price (Low to High)...")
    res = client.get(f"/api/scraper/jobs/{job_id}/products?sort_by=price_asc&limit=5")
    assert res.status_code == 200
    sort_data = res.json()
    prices = [p["selling_price"] for p in sort_data["items"] if p["selling_price"] is not None]
    print(f"    Lowest 5 Prices: {prices}")
    assert prices == sorted(prices), "Prices are not sorted in ascending order!"

    # 6. Test CSV Export
    print(f"\n[6] Testing CSV Export...")
    res = client.get(f"/api/scraper/jobs/{job_id}/export/csv")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    csv_content = res.content.decode("utf-8-sig")
    csv_reader = list(csv.reader(io.StringIO(csv_content)))
    headers = csv_reader[0]
    print(f"    CSV Headers: {headers}")
    print(f"    Total CSV Rows (including header): {len(csv_reader)}")
    assert "Product Name" in headers
    assert "Selling Price (INR)" in headers
    assert len(csv_reader) > 1, "CSV should contain exported rows"

    # 7. Test Excel Export
    print(f"\n[7] Testing Excel (.xlsx) Export...")
    res = client.get(f"/api/scraper/jobs/{job_id}/export/excel")
    assert res.status_code == 200
    assert "spreadsheetml" in res.headers["content-type"]
    wb = openpyxl.load_workbook(io.BytesIO(res.content))
    ws = wb.active
    excel_headers = [cell.value for cell in ws[1]]
    print(f"    Excel Sheet Title: {ws.title}")
    print(f"    Excel Headers: {excel_headers}")
    print(f"    Total Excel Rows: {ws.max_row}")
    assert ws.max_row > 1, "Excel file should have data rows"

    # 8. Test Scrape History Listing
    print(f"\n[8] Testing Scrape History Listing...")
    res = client.get("/api/scraper/jobs")
    assert res.status_code == 200
    history = res.json()
    print(f"    Total Jobs in History: {len(history)}")
    assert any(j["id"] == job_id for j in history), "Created job should appear in history list"

    print("\n==================================================")
    print("ALL PRODUCT SCRAPER VERIFICATION CHECKS PASSED! ✓")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(test_end_to_end())
