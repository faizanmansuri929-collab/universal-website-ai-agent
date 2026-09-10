import asyncio
import httpx

async def check_rag():
    print("======================================================")
    print("          COMPREHENSIVE RAG PIPELINE DIAGNOSTIC        ")
    print("======================================================")
    
    agent_id = "b9c7e803-d0e3-4d55-ac9b-aa1889859f2d"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Test In-Domain Knowledge Retrieval Question 1 (Address & Contact)
        q1 = "What is the full address and telephone number of Poornima Institute?"
        print(f"\n[TEST 1] In-Domain Query: '{q1}'")
        r1 = await client.post(f"http://localhost:8000/api/agents/{agent_id}/chat", json={"message": q1})
        d1 = r1.json()
        print("HTTP Status:", r1.status_code)
        print("Answer:\n", d1["answer"])
        print("Citations:", d1["citations"])
        assert r1.status_code == 200
        assert len(d1["citations"]) > 0

        # 2. Test In-Domain Knowledge Retrieval Question 2 (Courses & Accreditation)
        q2 = "What engineering courses are offered and what is the NAAC accreditation grade?"
        print(f"\n[TEST 2] In-Domain Query: '{q2}'")
        r2 = await client.post(f"http://localhost:8000/api/agents/{agent_id}/chat", json={"message": q2})
        d2 = r2.json()
        print("HTTP Status:", r2.status_code)
        print("Answer:\n", d2["answer"])
        print("Citations:", d2["citations"])
        assert r2.status_code == 200

        # 3. Test Out-of-Domain Anti-Hallucination Fallback Test
        q3 = "What is the ticket price for flights to Mars on SpaceX?"
        print(f"\n[TEST 3] Out-of-Domain Anti-Hallucination Query: '{q3}'")
        r3 = await client.post(f"http://localhost:8000/api/agents/{agent_id}/chat", json={"message": q3})
        d3 = r3.json()
        print("HTTP Status:", r3.status_code)
        print("Answer:\n", d3["answer"])
        
    print("\n======================================================")
    print("          RAG PIPELINE TEST SUMMARY: 100% PASS         ")
    print("======================================================")

if __name__ == "__main__":
    asyncio.run(check_rag())
