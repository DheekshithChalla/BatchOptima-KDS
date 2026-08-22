#!/usr/bin/env python3
"""
Simple HTTP server to run the Kitchen Batching Dashboard locally or in Codespaces.
Usage: python3 server.py
"""
import http.server
import socketserver
import os

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def run():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print("=" * 60)
        print("🚀 BATCHOPTIMA KDS - SPEEDCODE 2026 (NMIT BENGALURU)")
        print(f"📡 Serving dashboard on port: {PORT}")
        print("⚡ Open this port in your Codespace / browser")
        print("=" * 60)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server gracefully...")

if __name__ == "__main__":
    run()