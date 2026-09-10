import asyncio
import httpx

async def test_iteration2():
    print("==================================================================")
    print("     ITERATION 2: SECTOR RAG, ENTITIES & DEBUG TRACE AUDIT        ")
    print("==================================================================")
    
    async with httpx.AsyncClient(timeout=40.0) as client:
        # 1. Create Agent for Poornima Institute
        res = await client.post("http://localhost:8000/api/agents", json={
            "url": "https://poornimainstitute.edu.in",
            "scope": "entire_website"
        })
        agent = res.json()
        agent_id = agent["id"]
        print(f"[1] Created Agent ID: {agent_id}")

        # 2. Wait for crawl, sector classification & entity extraction
        for _ in range(12):
            ag = (await client.get(f"http://localhost:8000/api/agents/{agent_id}")).json()
            if ag["status"] in ("COMPLETED", "FAILED"):
                break
            await asyncio.sleep(1)

        print(f"[2] Crawl Completed: Status = {ag['status']}")
        print(f"    - Detected Sector: {ag['detected_sector']} ({round(ag['sector_confidence']*100)}% confidence)")
        print(f"    - Sector Reason: {ag['sector_reason']}")
        print(f"    - Indexed Pages: {ag['indexed_pages_count']}")
        print(f"    - Structured Entities: {ag['structured_entities_count']}")
        assert ag["detected_sector"] == "college"
        assert ag["sector_confidence"] >= 0.80

        # 3. Verify Structured Entities Endpoint
        res_ent = await client.get(f"http://localhost:8000/api/agents/{agent_id}/entities")
        entities = res_ent.json()
        print(f"\n[3] Structured Entities in DB ({len(entities)} records):")
        for e in entities[:6]:
            print(f"    • [{e['entity_type']}] {e['entity_name']} -> {e['attributes']}")
        assert len(entities) > 0

        # 4. Test Query Understanding & RAG Chat with Typo & Debug Mode
        # Query has typo: 'provide crouse and degree detail'
        query = "provide your crouse detail and degree branches"
        print(f"\n[4] Testing Chat Inquiry with Typo & Debug Trace:")
        print(f"    User Query: '{query}'")

        res_chat = await client.post(f"http://localhost:8000/api/agents/{agent_id}/chat", json={
            "message": query,
            "debug": True
        })
        chat_data = res_chat.json()
        print("\n=== AI Answer ===")
        print(chat_data["answer"])

        print("\n=== Live Debug Trace ===")
        trace = chat_data.get("debug_trace")
        if trace:
            print(f"    - Detected Intent: {trace['detected_intent']}")
            print(f"    - Detected Entity: {trace['detected_entity'] or trace['detected_entity_type']}")
            print(f"    - Matched Structured Entities: {trace['matched_structured_entities']}")
            print(f"    - Reranked Candidate Chunks ({len(trace['reranked_chunks'])}):")
            for c in trace['reranked_chunks'][:3]:
                print(f"       * [{round(c['score']*100, 1)}% Match] {c['title']} ({c['url']})")

        assert len(chat_data["citations"]) > 0
        assert trace is not None

    print("\n==================================================================")
    print("     ALL ITERATION 2 REQUIREMENTS VERIFIED & PASSING (100%)       ")
    print("==================================================================")

if __name__ == "__main__":
    asyncio.run(test_iteration2())
