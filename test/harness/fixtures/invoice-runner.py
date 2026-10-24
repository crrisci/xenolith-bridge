"""Run unchanged invoice tests, retaining raw evidence and bounded model feedback."""
import hashlib
import json
import pathlib
import subprocess
import sys
import time

MARKER = "__FEEDBACK_MARKER__"
LINE_LIMIT = 512
FEEDBACK_LIMIT = 8192


def bound_feedback(text, marker):
    lines = []
    for line in text.splitlines(keepends=True):
        if len(line) > LINE_LIMIT:
            line = line[:LINE_LIMIT // 2] + " ... [line truncated] ... " + line[-LINE_LIMIT // 2:]
        lines.append(line)
    bounded = "".join(lines)
    # Keep the beginning and final unittest verdict, with space for a marker
    # copied only when it actually occurred in the original test output.
    limit = FEEDBACK_LIMIT - 256
    if len(bounded) > limit:
        bounded = bounded[:limit // 2] + "\n[output truncated]\n" + bounded[-limit // 2:]
    if marker in text and marker not in bounded:
        bounded += "\n[retained test failure marker: " + marker + "]\n"
    return bounded


def main():
    root = pathlib.Path(__file__).parent
    files = ["money.py", "invoice.py"]
    before = {name: pathlib.Path(name).read_text() for name in files}
    tests = root / "test_invoice.py"
    check = hashlib.sha256(tests.read_bytes()).hexdigest()
    result = subprocess.run(
        [sys.executable, "-m", "unittest", "discover", "-s", str(root), "-p", "test_invoice.py", "-v"],
        capture_output=True, text=True,
    )
    raw = result.stdout + result.stderr
    feedback = bound_feedback(raw, MARKER)
    record = {
        "at": time.time(), "code": result.returncode, "sources": before,
        "sources_after": {name: pathlib.Path(name).read_text() for name in files},
        "tests_sha256": check, "tests_sha256_after": hashlib.sha256(tests.read_bytes()).hexdigest(),
        "stdout": result.stdout, "stderr": result.stderr, "feedback": feedback,
        "feedback_truncated": feedback != raw, "feedback_chars": len(feedback), "raw_output_chars": len(raw),
    }
    with (root / "test-runs.jsonl").open("a") as log:
        log.write(json.dumps(record) + "\n")
    print(feedback, end="")
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
