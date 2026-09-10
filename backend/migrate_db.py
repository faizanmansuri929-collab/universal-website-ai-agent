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
    cursor.execute("ALTER TABLE agents ADD COLUMN sector_reason TEXT DEFAULT ''")
    print("Added sector_reason column")
except Exception as e:
    print("sector_reason:", e)

conn.commit()
conn.close()

Base.metadata.create_all(bind=engine)
print("Database schema successfully synchronized!")
