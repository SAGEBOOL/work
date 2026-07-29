#!/usr/bin/env python3
# DSArt·WORK 一键启动器
# 自动安装 edge-tts，启动本地语音服务（同源托管站点，零配置），打开浏览器。
# 用法（在项目根目录执行）：
#   python run-workbench.py            # 本地站点 + 语音服务（同源，打开即用）
#   python run-workbench.py --online   # 仅语音服务，打开线上站点 https://sagebool.github.io/work/
import argparse
import os
import subprocess
import sys
import threading
import time
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
SERVER = os.path.join(ROOT, "public", "local-tts-server.py")
HOST = "127.0.0.1"
PORT = 8765


def ensure_edge_tts():
    try:
        import edge_tts  # noqa
        return
    except ImportError:
        pass
    print("[*] 未检测到 edge-tts，正在自动安装…")
    for cmd in [
        [sys.executable, "-m", "pip", "install", "edge-tts"],
        [sys.executable, "-m", "pip", "install", "-i", "https://pypi.tuna.tsinghua.edu.cn/simple", "edge-tts"],
    ]:
        try:
            subprocess.check_call(cmd)
            print("[*] edge-tts 安装完成")
            return
        except Exception:
            continue
    print("[错误] 自动安装 edge-tts 失败，请手动执行：pip install edge-tts")
    sys.exit(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--online", action="store_true", help="仅启动语音服务并打开线上站点")
    args = ap.parse_args()
    ensure_edge_tts()
    cmd = [sys.executable, SERVER]
    if args.online:
        cmd.append("--no-static")
    print("[*] 启动语音服务…")
    proc = subprocess.Popen(cmd)
    time.sleep(1.5)
    url = "https://sagebool.github.io/work/#/video-entertainment" if args.online else f"http://{HOST}:{PORT}/#/video-entertainment"
    try:
        webbrowser.open(url)
    except Exception:
        pass
    print(f"[*] 已打开：{url}")
    print("[*] 保持本窗口运行；用完按 Ctrl+C 退出")
    try:
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
        print("\n[*] 已退出")


if __name__ == "__main__":
    main()
