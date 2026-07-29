#!/usr/bin/env python3
# DSArt·WORK 一键启动器
# 作用：自动准备 edge-tts，本机启动「工作台静态站点 + 文字转音频服务」，并打开浏览器。
# 用法（在项目根目录执行）：
#   python run-workbench.py            # 启动本地站点(同源TTS)，自动打开页面
#   python run-workbench.py --online   # 仅启动TTS服务，并打开线上站点 https://sagebool.github.io/work/
# 依赖：pip install edge-tts
import os
import sys
import webbrowser
import subprocess
import threading

HOST = "127.0.0.1"
PORT = 8765
ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "dist")


def ensure_edge_tts():
    try:
        import edge_tts  # noqa
        return edge_tts
    except ImportError:
        print("[*] 未检测到 edge-tts，正在自动安装（如需手动：pip install edge-tts）…")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "edge-tts"])
            import edge_tts  # noqa
            return edge_tts
        except Exception as e:
            print("[错误] 自动安装 edge-tts 失败：", e)
            print("        请手动执行：pip install edge-tts 后重试")
            sys.exit(1)


def ensure_dist():
    if not os.path.isdir(DIST):
        print("[错误] 未找到构建产物 dist/。请先执行：npm run build")
        sys.exit(1)


CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mp3": "audio/mpeg",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".py": "text/plain; charset=utf-8",
}


def main():
    online = "--online" in sys.argv
    edge_tts = ensure_edge_tts()
    if not online:
        ensure_dist()

    from http.server import HTTPServer, BaseHTTPRequestHandler

    class Handler(BaseHTTPRequestHandler):
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
            if self.path == "/" or self.path.startswith("/#"):
                self._serve_file("/index.html")
                return
            if self.path == "/tts-status":
                self._text("ok")
                return
            # 静态文件（仅本地模式）
            if not online:
                rel = self.path.split("?")[0].lstrip("/")
                fpath = os.path.normpath(os.path.join(DIST, rel))
                if os.path.isdir(fpath):
                    fpath = os.path.join(fpath, "index.html")
                if os.path.isfile(fpath):
                    self._serve_file(os.path.relpath(fpath, DIST), abs_path=fpath)
                    return
            self.send_error(404)

        def _serve_file(self, rel, abs_path=None):
            if abs_path is None:
                abs_path = os.path.join(DIST, rel.lstrip("/"))
            if not os.path.isfile(abs_path):
                self.send_error(404)
                return
            ext = os.path.splitext(abs_path)[1].lower()
            ct = CONTENT_TYPES.get(ext, "application/octet-stream")
            with open(abs_path, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ct)
            self.send_header("Content-Length", str(len(data)))
            self._cors()
            self.end_headers()
            self.wfile.write(data)

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
                body = self.rfile.read(length).decode("utf-8")
                import json
                data = json.loads(body)
                text = data.get("text", "").strip()
                voice = data.get("voice", "zh-CN-YunxiNeural")
                rate = data.get("rate", "-10%")
                if not text:
                    self.send_error(400, "empty text")
                    return
                import asyncio, tempfile, traceback
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
                self.send_header("Content-Length", str(len(mp3)))
                self._cors()
                self.end_headers()
                self.wfile.write(mp3)
            except Exception as e:
                print("[服务端错误]", e)
                traceback.print_exc()
                self.send_error(500, str(e))

    url = "https://sagebool.github.io/work/#/video-entertainment" if online else f"http://{HOST}:{PORT}/#/video-entertainment"
    print(f"[*] DSArt·WORK 启动中…")
    print(f"[*] 文字转音频(edge-tts)服务：http://{HOST}:{PORT}/tts")
    if online:
        print(f"[*] 打开线上站点：{url}")
    else:
        print(f"[*] 工作台本地站点：http://{HOST}:{PORT}/")
    print(f"[*] 按 Ctrl+C 停止")

    def open_browser():
        # 稍等服务器起来再开浏览器
        import time
        time.sleep(1.2)
        webbrowser.open(url)

    threading.Thread(target=open_browser, daemon=True).start()
    try:
        HTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\n[*] 已停止")


if __name__ == "__main__":
    main()
