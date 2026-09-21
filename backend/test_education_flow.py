import requests
import json
import time

url = "http://127.0.0.1:8000"
target_site = "https://www.poornimainstitute.edu.in/"

print("=== 1. CREATING AGENT & CRAWLING WEBSITE ===")
create_res = requests.post(f"{url}/api/agents", json={"url": target_site, "max_pages": 15})
agent_data = create_res.json()
agent_id = agent_data["id"]
print(f"Agent created: {agent_id}, status: {agent_data.get('status')}")

# Poll until READY
for i in range(40):
    status_res = requests.get(f"{url}/api/agents/{agent_id}").json()
    status = status_res.get("status")
    print(f"[{i+1}] Status: {status}, pages: {len(status_res.get('pages', []))}, sector: {status_res.get('detected_sector')}")
    if status == "ready" or status == "READY":
        break
    time.sleep(3)

print("\n=== 2. VERIFYING SECTOR & KNOWLEDGE BASE ===")
status_res = requests.get(f"{url}/api/agents/{agent_id}").json()
print("Detected Sector:", status_res.get("detected_sector"))
print("Sector Confidence:", status_res.get("sector_confidence"))
pages = status_res.get("pages", [])
real_pages = [p for p in pages if p.get("source_type") == "REAL_WEBSITE"]
demo_pages = [p for p in pages if p.get("source_type") in ["DEMO_DATA", "DEMO_DOCUMENT"]]
print(f"Total Sources: {len(pages)} (Real Web: {len(real_pages)}, Demo Docs: {len(demo_pages)})")

print("\n=== 3. TESTING ADMISSION / COURSE QUERY (REAL WEBPAGE SOURCES) ===")
chat_res = requests.post(f"{url}/api/chat", json={
    "agent_id": agent_id,
    "message": "What B.Tech engineering courses and specializations are offered? I scored 85% in PCM and want to apply for 2026 intake."
}).json()

print("Response:\n", chat_res.get("response"))
print("Lead Score:", json.dumps(chat_res.get("lead_score"), indent=2))
print("Enrollment Prediction:", json.dumps(chat_res.get("enrollment_prediction"), indent=2))
print("Citations:", [(c["title"], c["source_type"]) for c in chat_res.get("citations", [])])
print("Booking Slots count:", len(chat_res.get("booking_slots", [])))

print("\n=== 4. TESTING STUDENT POLICY (DEMO DATA) ===")
student_chat = requests.post(f"{url}/api/chat", json={
    "agent_id": agent_id,
    "message": "What is the minimum attendance required to appear in semester exams and what are hostel curfew rules?"
}).json()
print("Response:\n", student_chat.get("response"))
print("Citations:", [(c["title"], c["source_type"]) for c in student_chat.get("citations", [])])

print("\n=== 5. TESTING FACULTY POLICY (DEMO DOCUMENT) ===")
faculty_chat = requests.post(f"{url}/api/chat", json={
    "agent_id": agent_id,
    "message": "What is the faculty medical leave policy and research reimbursement cap?"
}).json()
print("Response:\n", faculty_chat.get("response"))
print("Citations:", [(c["title"], c["source_type"]) for c in faculty_chat.get("citations", [])])

print("\n=== 6. TESTING COUNSELOR BOOKING API ===")
booking_res = requests.post(f"{url}/api/booking", json={
    "agent_id": agent_id,
    "slot_id": "slot-counselor-10am",
    "name": "Faizan Mansuri",
    "email": "faizan@example.com",
    "phone": "+91 9876543210",
    "course_interest": "B.Tech Computer Science"
}).json()
print("Booking Result:", json.dumps(booking_res, indent=2))
