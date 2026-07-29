#!/usr/bin/env python3
# DSArt·WORK 本地 Edge TTS 服务（md-to-mp3 技能同一后端）
# 作用：让浏览器端「文字转音频」调用本机 edge-tts 真实合成微软语音 MP3
# 用法：
#   python local-tts-server.py            # 同时托管 dist 静态站点（同源，前端零配置）
#   python local-tts-server.py --no-static # 仅提供 /tts（用于线上站点 --online 模式）
# 前端在同源时直接 http://127.0.0.1:8765 访问；跨域时由前端指向该地址。
import argparse
import asyncio
import json
import os
import re
import sys
import tempfile
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler

HOST = "127.0.0.1"
PORT = 8765
MAX_CHUNK = 5000

def find_edge_tts():
    try:
        import edge_tts
        return edge_tts
    except ImportError:
        print("[错误] 未安装 edge-tts。请先运行：pip install edge-tts")
        sys.exit(1)

edge_tts = find_edge_tts()

# 按句分割（与 md-to-mp3 技能一致：以 。！？!? 换行 为界）
SENT_RE = re.compile(r"(?<=[\u3002\uff01\uff1f!?\n])")

def chunk_text(text, max_len=MAX_CHUNK):
    chunks = []
    cur = ""
    for s in SENT_RE.split(text):
        if not s.strip():
            continue
        if len(cur) + len(s) <= max_len:
            cur += s
        else:
            if cur:
                chunks.append(cur.strip())
            if len(s) > max_len:
                for i in range(0, len(s), max_len):
                    chunks.append(s[i:i + max_len].strip())
                cur = ""
            else:
                cur = s
    if cur:
        chunks.append(cur.strip())
    return [c for c in chunks if c.strip()]

async def synth_chunk(text, voice, rate):
    # 自动重试（transient 错误，最多 3 次，指数退避）—— 对齐 md-to-mp3 技能
    for attempt in range(3):
        try:
            tmp = tempfile.mktemp(suffix=".mp3")
            communicate = edge_tts.Communicate(text, voice, rate=rate)
            await communicate.save(tmp)
            with open(tmp, "rb") as f:
                data = f.read()
            os.remove(tmp)
            if len(data) < 100:
                raise RuntimeError("No audio returned (too small)")
            return data
        except Exception as e:
            if attempt >= 2:
                raise
            await asyncio.sleep(0.5 * (2 ** attempt))

def tts_bytes(text, voice, rate):
    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("empty text")
    if len(chunks) == 1:
        return asyncio.run(synth_chunk(chunks[0], voice, rate))
    # 多块：逐块合成后二进制拼接合并（与 md-to-mp3 技能一致）
    parts = []
    for c in chunks:
        parts.append(asyncio.run(synth_chunk(c, voice, rate)))
    return b"".join(parts)

class Handler(BaseHTTPRequestHandler):
    static_dir = None

    def log_message(self, *a):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/":
            if self.static_dir:
                self._serve(os.path.join(self.static_dir, "index.html"))
            else:
                self._text("Edge TTS server running (no static hosting)")
        elif self.static_dir and self.path.startswith("/assets/"):
            self._serve(os.path.join(self.static_dir, self.path.lstrip("/")))
        else:
            self.send_error(404)

    def _serve(self, path):
        if os.path.isfile(path):
            with open(path, "rb") as f:
                data = f.read()
            ext = os.path.splitext(path)[1].lower()
            ct = {
                ".html": "text/html; charset=utf-8",
                ".js": "application/javascript; charset=utf-8",
                ".css": "text/css; charset=utf-8",
                ".json": "application/json; charset=utf-8",
                ".svg": "image/svg+xml",
                ".mp3": "audio/mpeg",
                ".ico": "image/x-icon",
            }.get(ext, "application/octet-stream")
            self.send_response(200)
            self.send_header("Content-Type", ct)
            self.send_header("Content-Length", str(len(data)))
            self._cors()
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_error(404)

    def _text(self, text):
        b = text.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self._cors()
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        if self.path != "/tts":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0:
                self.send_error(400, "empty body")
                return
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            text = (data.get("text") or "").strip()
            voice = data.get("voice", "zh-CN-YunxiNeural")
            rate = data.get("rate", "-10%")
            if not text:
                self.send_error(400, "empty text")
                return
            mp3 = tts_bytes(text, voice, rate)
            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Content-Length", str(len(mp3)))
            self._cors()
            self.end_headers()
            self.wfile.write(mp3)
        except Exception as e:
            print("[服务端错误]", e)
            traceback.print_exc()
            self.send_error(500, str(e))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-static", action="store_true", help="不托管静态站点（仅 /tts），用于线上站点模式")
    args = ap.parse_args()
    if not args.no_static:
        for d in ["./dist", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dist")]:
            if os.path.isdir(d):
                Handler.static_dir = os.path.abspath(d)
                break
    print(f"[*] 本地 Edge TTS 服务：http://{HOST}:{PORT}/tts")
    print(f"[*] 静态托管：{Handler.static_dir or '无（仅 /tts）'}")
    print(f"[*] 保持运行，浏览器工作台即可用微软 Edge 语音（与 md-to-mp3 技能一致）")
    print(f"[*] 按 Ctrl+C 停止")
    try:
        HTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\n[*] 已停止")

if __name__ == "__main__":
    main()
