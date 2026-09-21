import asyncio
import httpx
import sys

# Set stdout to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

async def check_rag():
    print("======================================================")
    print("          COMPREHENSIVE RAG PIPELINE DIAGNOSTIC        ")
    print("======================================================")
    
    agent_id = "441d220c-2b75-4509-b096-13133d12b9b7"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Test In-Domain Knowledge Retrieval Question 1 (Fees & REAP codes)
        q1 = "What is the fee structure for B.Tech CSE and Core branches, and what are the REAP codes?"
        print(f"\n[TEST 1] In-Domain Query: '{q1}'", flush=True)
        r1 = await client.post(f"http://127.0.0.1:8000/api/agents/{agent_id}/chat", json={"message": q1, "mode": "student"})
        print("HTTP Status:", r1.status_code, flush=True)
        print("HTTP Text:", r1.text, flush=True)
        d1 = r1.json()
        print("Answer:\n", d1.get("answer"), flush=True)
        print("Citations:", [(c["title"], c["url"]) for c in d1.get("citations", [])], flush=True)
        print("Apply URL:", d1.get("apply_url"), flush=True)

        # 2. Test Placement query
        q2 = "What is the placement record and top recruiters?"
        print(f"\n[TEST 2] In-Domain Query: '{q2}'", flush=True)
        r2 = await client.post(f"http://127.0.0.1:8000/api/agents/{agent_id}/chat", json={"message": q2, "mode": "student"})
        d2 = r2.json()
        print("HTTP Status:", r2.status_code, flush=True)
        print("Answer:\n", d2.get("answer"), flush=True)

    print("\n======================================================")
    print("          RAG PIPELINE TEST SUMMARY: COMPLETE         ")
    print("======================================================")

if __name__ == "__main__":
    asyncio.run(check_rag())
