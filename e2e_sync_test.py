import subprocess
import time
import socket
import sys
import os
from playwright.sync_api import sync_playwright

def is_port_open(port):
    # Try IPv4 first
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            if s.connect_ex(('127.0.0.1', port)) == 0:
                return True
    except Exception:
        pass
    # Try IPv6
    try:
        with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            if s.connect_ex(('::1', port)) == 0:
                return True
    except Exception:
        pass
    return False

def wait_for_ports(ports, timeout=40):
    print(f"Waiting for ports {ports} to be open...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        all_open = True
        for port in ports:
            if not is_port_open(port):
                all_open = False
                break
        if all_open:
            print("All ports are ready!")
            return True
        time.sleep(1)
    return False
def kill_port_owners(ports):
    print(f"Ensuring ports {ports} are free...")
    for port in ports:
        try:
            output = subprocess.check_output(
                f'netstat -ano',
                shell=True,
                text=True
            )
            pids = set()
            for line in output.strip().split("\n"):
                if "LISTENING" in line:
                    parts = line.split()
                    if len(parts) >= 5:
                        local_address = parts[1]
                        if local_address.endswith(f":{port}"):
                            pids.add(parts[-1])
            for pid in pids:
                if pid != "0" and pid.isdigit():
                    print(f"Killing PID {pid} occupying port {port}...")
                    subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            print(f"Error checking/killing port {port}: {e}")

def clean_process(proc):
    if proc:
        print("Cleaning up server processes...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("Processes cleaned up.")
    kill_port_owners([5173, 5174, 8080, 3200])

def run_test():
    # 0. 清理现有占用端口的进程
    kill_port_owners([5173, 5174, 8080, 3200])

    server_proc = None
    stdout_file = None
    stderr_file = None
    try:
        # 1. 启动 pnpm dev (前端 + 后端)
        print("Starting dev servers with 'pnpm run dev'...")
        stdout_file = open("server_stdout.log", "w", encoding="utf-8")
        stderr_file = open("server_stderr.log", "w", encoding="utf-8")
        
        # Windows command line shell execution
        server_proc = subprocess.Popen(
            ["pnpm", "run", "dev"],
            shell=True,
            stdout=stdout_file,
            stderr=stderr_file,
            text=True
        )

        # 2. 等待服务启动 (前端 5173, 后端 8080)
        if not wait_for_ports([5173, 8080], timeout=60):
            print("Error: Ports 5173 or 8080 did not open in time.")
            stdout_file.close()
            stderr_file.close()
            
            # Print logs for diagnostics
            print("\n--- Server Stdout Log ---")
            if os.path.exists("server_stdout.log"):
                with open("server_stdout.log", "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    enc = sys.stdout.encoding or 'gbk'
                    print(content.encode(enc, errors='replace').decode(enc))
            print("\n--- Server Stderr Log ---")
            if os.path.exists("server_stderr.log"):
                with open("server_stderr.log", "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    enc = sys.stdout.encoding or 'gbk'
                    print(content.encode(enc, errors='replace').decode(enc))
            return False

        # 3. 运行 Playwright E2E 测试
        print("\n--- Starting Playwright E2E Testing ---")
        with sync_playwright() as p:
            print("Launching Chromium...")
            browser = p.chromium.launch(headless=True)

            # 创建两个完全独立的上下文，模拟两个不同的浏览器/用户
            print("Creating Context A (User A / Host)...")
            context_a = browser.new_context()
            page_a = context_a.new_page()

            print("Creating Context B (User B / Invited)...")
            context_b = browser.new_context()
            page_b = context_b.new_page()

            # A 与 B 分别进入页面
            print("Navigating User A to http://localhost:5173 ...")
            page_a.goto("http://localhost:5173")
            page_a.wait_for_load_state("networkidle")

            print("Navigating User B to http://localhost:5173 ...")
            page_b.goto("http://localhost:5173")
            page_b.wait_for_load_state("networkidle")

            # 记录初始状态截图
            page_a.screenshot(path="user_a_init.png")
            page_b.screenshot(path="user_b_init.png")
            print("Captured initial screenshots.")

            # 4. 用户 A 在搜索框中输入“晴天 周杰伦”并回车搜索（测试受限的华语版权歌曲）
            print("User A: Searching for '晴天 周杰伦' on NetEase...")
            search_input = page_a.get_by_placeholder("搜索网易云音乐...")
            search_input.fill("晴天 周杰伦")
            search_input.press("Enter")

            # 等待搜索结果面板和第一首歌曲列表渲染
            page_a.wait_for_selector(".search-scroll-container > div")
            page_a.screenshot(path="user_a_search_results.png")
            print("User A: Search results loaded.")

            # 5. 用户 A 点击第一首歌曲进行播放
            print("User A: Clicking first song to play...")
            first_song = page_a.locator(".search-scroll-container > div").first
            first_song.click()

            # 等待播放启动以及音频加载
            print("Waiting for audio to load & start playing...")
            page_a.wait_for_timeout(5000)
            page_a.screenshot(path="user_a_playing.png")

            # 验证用户 A 的音频代理和播放状态
            audio_a_src = page_a.eval_on_selector("audio", "el => el.src")
            audio_a_paused = page_a.eval_on_selector("audio", "el => el.paused")
            print(f"User A Audio Src: {audio_a_src}")
            print(f"User A Audio Paused: {audio_a_paused}")

            if not audio_a_src.startswith("http://localhost:8080/proxy/audio"):
                print("FAIL: User A audio is NOT proxied via server!")
                return False
            if audio_a_paused:
                print("FAIL: User A audio is paused but should be playing!")
                return False
            print("SUCCESS: User A audio proxy & play validation passed!")

            # 6. 验证用户 B 是否通过 WebSocket 同步播放了同一首歌曲
            print("\nUser B: Verifying sync status...")
            page_b.wait_for_timeout(3000)  # 给同步一点网络缓冲时间
            page_b.screenshot(path="user_b_synced.png")

            audio_b_src = page_b.eval_on_selector("audio", "el => el.src")
            audio_b_paused = page_b.eval_on_selector("audio", "el => el.paused")
            print(f"User B Audio Src: {audio_b_src}")
            print(f"User B Audio Paused: {audio_b_paused}")

            if audio_b_src != audio_a_src:
                print("FAIL: User B audio src is NOT synced with User A!")
                return False
            if audio_b_paused:
                print("FAIL: User B is paused but should be playing synchronously!")
                return False
            print("SUCCESS: User B automatic sync play validation passed!")

            # 7. 测试同步暂停：用户 A 暂停播放
            print("\nUser A: Clicking Pause button...")
            # 当播放时，暂停按钮的 label 为 '❚❚'
            pause_btn = page_a.locator("text=❚❚").first
            pause_btn.click()

            print("Waiting for pause to propagate...")
            page_a.wait_for_timeout(2000)
            page_a.screenshot(path="user_a_paused.png")
            page_b.screenshot(path="user_b_paused.png")

            audio_a_paused_now = page_a.eval_on_selector("audio", "el => el.paused")
            audio_b_paused_now = page_b.eval_on_selector("audio", "el => el.paused")
            print(f"User A Paused: {audio_a_paused_now}")
            print(f"User B Paused: {audio_b_paused_now}")

            if not audio_a_paused_now or not audio_b_paused_now:
                print("FAIL: Pause state was NOT synced correctly!")
                return False
            print("SUCCESS: Sync Pause validation passed!")

            # 8. 测试同步恢复：用户 A 重新播放
            print("\nUser A: Clicking Play button...")
            # 暂停时，播放按钮 label 为 '▶'
            play_btn = page_a.locator("text=▶").first
            play_btn.click()

            print("Waiting for play to propagate...")
            page_a.wait_for_timeout(3000)
            
            audio_a_playing_now = not page_a.eval_on_selector("audio", "el => el.paused")
            audio_b_playing_now = not page_b.eval_on_selector("audio", "el => el.paused")
            print(f"User A Playing: {audio_a_playing_now}")
            print(f"User B Playing: {audio_b_playing_now}")

            if not audio_a_playing_now or not audio_b_playing_now:
                print("FAIL: Play recovery state was NOT synced correctly!")
                return False
            print("SUCCESS: Sync Play Recovery validation passed!")

            # 9. 测试同步拉动进度条 (Seek)
            print("\nUser A: Seeking to 50% using slider...")
            # 找到 Slider 的容器并点击它的中点 (x=165, y=30)
            slider = page_a.locator('div[style*="width: 330px"]').first
            slider.click(position={"x": 165, "y": 30})

            print("Waiting for seek to propagate...")
            page_a.wait_for_timeout(3000)
            page_a.screenshot(path="user_a_seek.png")
            page_b.screenshot(path="user_b_seek.png")

            time_a = page_a.eval_on_selector("audio", "el => el.currentTime")
            time_b = page_b.eval_on_selector("audio", "el => el.currentTime")
            print(f"User A currentTime: {time_a:.2f}s")
            print(f"User B currentTime: {time_b:.2f}s")

            # 校验误差在 1 秒以内 (通常网络抖动与同步在数百毫秒内)
            if abs(time_a - time_b) > 1.0:
                print(f"FAIL: Seek synchronization difference too large: {abs(time_a - time_b):.2f}s")
                return False
            print("SUCCESS: Seek Synchronization validation passed!")

            browser.close()

        print("\n=== ALL E2E SYNC TESTS PASSED SUCCESSFULLY! ===")
        return True

    except Exception as e:
        print(f"An error occurred during test: {e}")
        return False
    finally:
        clean_process(server_proc)
        if stdout_file and not stdout_file.closed:
            stdout_file.close()
        if stderr_file and not stderr_file.closed:
            stderr_file.close()

if __name__ == "__main__":
    success = run_test()
    sys.exit(0 if success else 1)
