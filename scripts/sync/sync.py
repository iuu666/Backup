import os
import requests
import hashlib
import json
import time
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, "sources")

TIMEOUT = 20
RETRY = 3

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/136.0 Safari/537.36"
    )
}


def md5(content: bytes) -> str:
    return hashlib.md5(content).hexdigest()


def fetch(url: str) -> bytes:
    for i in range(RETRY):
        try:
            r = requests.get(
                url,
                timeout=TIMEOUT,
                headers=HEADERS
            )
            r.raise_for_status()
            return r.content

        except Exception as e:
            print(f"[WARN] Retry {i + 1}/{RETRY}: {e}")
            time.sleep(2)

    raise Exception("Fetch failed")


def ensure_dir(path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)


def load_all_sources():
    all_sources = []

    for file in os.listdir(CONFIG_DIR):
        if file.endswith(".json"):
            path = os.path.join(CONFIG_DIR, file)

            print(f"\n📦 Loading {file}")

            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                all_sources.extend(data)

    return all_sources


def process(src, root_dir):
    name = src["name"]
    url = src["url"]
    output = src["output"]

    print(f"🔍 Checking: {name}")

    new = fetch(url)

    output_path = os.path.join(root_dir, output)

    if os.path.exists(output_path):
        with open(output_path, "rb") as f:
            old = f.read()

        if md5(old) == md5(new):
            print("✔ No change")
            return False

    ensure_dir(output_path)

    with open(output_path, "wb") as f:
        f.write(new)

    print("✅ Updated")
    return True


def main():
    root_dir = os.path.abspath(
        os.path.join(BASE_DIR, "../../")
    )

    sources = load_all_sources()

    changed = False
    failed = 0

    for s in sources:
        try:
            if process(s, root_dir):
                changed = True

        except Exception as e:
            failed += 1

            print(
                f"❌ Failed: "
                f"{s.get('name', 'Unknown')} - {e}"
            )

    print("\n=== RESULT ===")

    if changed:
        print("🚀 Changes detected")
    else:
        print("😴 No changes")

    if failed:
        print(f"⚠ Failed sources: {failed}")

    with open(
        os.path.join(root_dir, ".changed"),
        "w",
        encoding="utf-8"
    ) as f:
        f.write("1" if changed else "0")

    sys.exit(0)


if __name__ == "__main__":
    main()
