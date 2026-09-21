import sqlite3
from app.core.database import Base, engine

conn = sqlite3.connect('app.db')
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE agents ADD COLUMN detected_sector VARCHAR DEFAULT 'general'")
    print("Added detected_sector column")
except Exception as e:
    print("detected_sector:", e)

try:
    cursor.execute("ALTER TABLE agents ADD COLUMN sector_confidence FLOAT DEFAULT 0.75")
    print("Added sector_confidence column")
except Exception as e:
    print("sector_confidence:", e)

try:
    cursor.execute("ALTER TABLE pages ADD COLUMN source_type VARCHAR DEFAULT 'REAL_WEBSITE'")
    print("Added source_type column to pages")
except Exception as e:
    print("pages.source_type:", e)

try:
    cursor.execute("ALTER TABLE entities ADD COLUMN source_type VARCHAR DEFAULT 'REAL_WEBSITE'")
    print("Added source_type column to entities")
except Exception as e:
    print("entities.source_type:", e)

conn.commit()
conn.close()

Base.metadata.create_all(bind=engine)
print("Database schema successfully synchronized!")

