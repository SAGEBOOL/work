#!/usr/bin/env python3
# DSArt·WORK 本地 Edge TTS 服务
# 作用：让浏览器端「文字转音频」功能能调用本机 edge-tts 生成真实 MP3
# 前置：pip install edge-tts
# 启动：python local-tts-server.py
# 然后在本工作台「文字转音频」页面点击「生成 MP3」或「试听」即可

import asyncio
import json
import os
import sys
import tempfile
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler

HOST = "127.0.0.1"
PORT = 8765


def check_edge_tts():
    try:
        import edge_tts
        return edge_tts
    except ImportError:
        print("[错误] 未安装 edge-tts。请先运行：pip install edge-tts")
        sys.exit(1)


edge_tts = check_edge_tts()


class TTSHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # 保持安静，只打印关键信息
        pass

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_cors_headers()
            body = b"Edge TTS local server is running"
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path != "/tts":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0:
                self.send_error(400, "empty body")
                return
            body = self.rfile.read(length).decode("utf-8")
            data = json.loads(body)
            text = data.get("text", "").strip()
            voice = data.get("voice", "zh-CN-YunxiNeural")
            rate = data.get("rate", "-10%")
            if not text:
                self.send_error(400, "empty text")
                return

            tmp = tempfile.mktemp(suffix=".mp3")

            async def gen():
                communicate = edge_tts.Communicate(text, voice, rate=rate)
                await communicate.save(tmp)

            asyncio.run(gen())

            with open(tmp, "rb") as f:
                mp3 = f.read()
            os.remove(tmp)

            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_cors_headers()
            self.send_header("Content-Length", str(len(mp3)))
            self.end_headers()
            self.wfile.write(mp3)
        except Exception as e:
            print("[服务端错误]", e)
            traceback.print_exc()
            self.send_error(500, str(e))


if __name__ == "__main__":
    print(f"[*] 启动本地 Edge TTS 服务：http://{HOST}:{PORT}")
    print(f"[*] 前置要求：已安装 edge-tts（pip install edge-tts）")
    print(f"[*] 保持本窗口运行，然后在浏览器工作台中点击「生成 MP3」")
    print(f"[*] 按 Ctrl+C 停止")
    try:
        HTTPServer((HOST, PORT), TTSHandler).serve_forever()
    except KeyboardInterrupt:
        print("\n[*] 已停止")
