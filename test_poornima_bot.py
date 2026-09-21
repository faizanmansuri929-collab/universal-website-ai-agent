"""
Interactive Terminal Client for Poornima College Website Chatbot (SUPERBOT)
URL: https://www.poornima.org/
"""

import sys
import time
import json
import requests
import socketio

# Ensure utf-8 encoding in terminal
sys.stdout.reconfigure(encoding='utf-8')

API_KEY = "vb_live_67473d45df61867ce0d242cb89748fb7f9920df3f6b08886"
WELCOME_URL = "https://api.superbot.one/tel/widget/v1/welcome"
CONTACT_URL = "https://api.superbot.one/tel/widget/v1/contact/store"
SOCKET_URL = "https://bytelink.superbot.one"

HEADERS = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
    "X-Fingerprint": f"fp_cli_client_{int(time.time())}",
    "X-Parent-Origin": "https://www.poornima.org",
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Origin": "https://www.poornima.org",
    "Referer": "https://www.poornima.org/"
}

class PoornimaBotClient:
    def __init__(self, student_name="Faizan", city="Jaipur", state="Rajasthan"):
        self.student_name = student_name
        self.city = city
        self.state = state
        self.token = None
        self.user_id = None
        self.account_id = 1511
        self.campaign_id = "25325"
        self.sio = socketio.Client(logger=False, engineio_logger=False)
        self.connected = False
        self._setup_handlers()

    def _setup_handlers(self):
        @self.sio.on("connect", namespace="/widget")
        def on_connect():
            self.connected = True
            print("\n[+] Successfully connected to Poornima Assistant (SUPERBOT)!")
            print("-" * 65)

        @self.sio.on("message:receive", namespace="/widget")
        def on_message(data):
            content = data.get("content") or data.get("message")
            print(f"\n🤖 Poornima Assistant:\n{content}")
            
            if data.get("rich_media"):
                for media in data["rich_media"]:
                    if media.get("type") == "quick_reply" and media.get("value"):
                        options_str = " | ".join(media["value"])
                        print(f"\n💡 Suggestions: [ {options_str} ]")
            print("-" * 65)

        @self.sio.on("typing", namespace="/widget")
        def on_typing(data):
            if data.get("isTyping"):
                print("... (Bot is typing) ...", end="\r", flush=True)

        @self.sio.on("disconnect", namespace="/widget")
        def on_disconnect():
            self.connected = False
            print("\n[-] Disconnected from server.")

    def initialize(self):
        print("\n[1/3] Connecting to Poornima.org backend...")
        res = requests.post(WELCOME_URL, json={}, headers=HEADERS, timeout=10)
        if not res.ok:
            raise Exception(f"Welcome API failed: {res.status_code} {res.text}")
        
        data = res.json().get("data", {})
        self.token = data.get("token")
        self.user_id = data.get("user_id")
        self.account_id = data.get("account_id", 1511)
        
        bot_config = data.get("bot_config", [])
        text_bot = next((b for b in bot_config if b.get("slug") == "text_assistant"), {})
        self.campaign_id = text_bot.get("campaign_id", "25325")

        # Unlock contact form
        print(f"[2/3] Registering session (User ID: {self.user_id})...")
        c_headers = HEADERS.copy()
        c_headers["Authorization"] = f"Bearer {self.token}"
        c_headers["X-User-Id"] = str(self.user_id)
        
        c_payload = {
            "name": self.student_name,
            "email": f"{self.student_name.lower().replace(' ', '')}{int(time.time())%1000}@gmail.com",
            "phone": "9829012345",
            "country_code": "+91",
            "channel": "website_chat",
            "mode": "chatbot",
            "field_value": {
                "system_state": self.state,
                "system_city": self.city
            }
        }
        requests.post(CONTACT_URL, json=c_payload, headers=c_headers, timeout=10)

        # Connect WebSocket
        print("[3/3] Establishing real-time chat channel...")
        self.sio.connect(
            SOCKET_URL,
            namespaces=["/widget"],
            socketio_path="/chat/socket.io",
            transports=["websocket"],
            auth={"token": self.token},
            headers={"Origin": "https://www.poornima.org"}
        )
        time.sleep(1.5)

    def send_message(self, message_text):
        if not self.connected:
            print("❌ Socket not connected.")
            return
        
        payload = {
            "medium": "website",
            "account_id": self.account_id,
            "campaign_id": self.campaign_id,
            "content": message_text,
            "timestamp": int(time.time() * 1000)
        }
        self.sio.emit("message:send", payload, namespace="/widget")

    def run_interactive(self):
        self.initialize()
        
        # Initial greeting
        self.send_message("hello")
        time.sleep(2)
        
        print("\nType your question below (or type 'exit' to quit):")
        while True:
            try:
                msg = input("\nYou: ").strip()
                if not msg:
                    continue
                if msg.lower() in ["exit", "quit", "q"]:
                    print("Exiting chat...")
                    break
                self.send_message(msg)
                time.sleep(3.5)
            except (KeyboardInterrupt, EOFError):
                break
        
        self.sio.disconnect()


if __name__ == "__main__":
    bot = PoornimaBotClient(student_name="Faizan", city="Jaipur", state="Rajasthan")
    bot.run_interactive()
