import os
import time
from datetime import datetime
from threading import Lock
from typing import Any, Dict, List, Optional

import pyautogui
from fastapi import FastAPI
from pydantic import BaseModel
from pynput import keyboard, mouse

pyautogui.FAILSAFE = False

app = FastAPI()

recording = False
recorded_events: List[Dict[str, Any]] = []
mouse_listener: Optional[mouse.Listener] = None
keyboard_listener: Optional[keyboard.Listener] = None
record_lock = Lock()

key_buffer: List[str] = []
last_key_ts: float = 0.0
current_session_dir: Optional[str] = None

RECORDINGS_DIR = "/app/recordings"
KEY_GROUP_TIMEOUT = 0.7


class RunPayload(BaseModel):
    type: str
    data: Dict[str, Any]


class RecordStartPayload(BaseModel):
    label: Optional[str] = None


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/preflight")
def preflight():
    try:
        size = pyautogui.size()
        return {
            "ok": True,
            "display": os.environ.get("DISPLAY", ""),
            "screen": {"width": size.width, "height": size.height}
        }
    except Exception as exc:
        return {
            "ok": False,
            "display": os.environ.get("DISPLAY", ""),
            "error": str(exc),
            "hint": "Run xhost +local: on host and ensure DISPLAY is forwarded to the container."
        }


@app.post("/record/start")
def record_start(payload: RecordStartPayload):
    global recording, recorded_events, mouse_listener, keyboard_listener, key_buffer, last_key_ts, current_session_dir
    recorded_events = []
    key_buffer = []
    last_key_ts = 0.0
    recording = True

    session_id = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    current_session_dir = os.path.join(RECORDINGS_DIR, session_id)
    os.makedirs(current_session_dir, exist_ok=True)

    def flush_keys():
        global key_buffer
        if not key_buffer:
            return
        text = "".join(key_buffer)
        recorded_events.append({
            "type": "desktop_type",
            "value": text
        })
        key_buffer = []

    def on_click(x, y, button, pressed):
        if not recording or not pressed:
            return
        with record_lock:
            flush_keys()
            image_path = None
            if current_session_dir:
                size = 120
                left = max(int(x - size / 2), 0)
                top = max(int(y - size / 2), 0)
                filename = f"click_{int(time.time() * 1000)}.png"
                image_path = os.path.join(current_session_dir, filename)
                shot = pyautogui.screenshot(region=(left, top, size, size))
                shot.save(image_path)
            recorded_events.append({
                "type": "desktop_click_image",
                "x": x,
                "y": y,
                "button": str(button),
                "imagePath": image_path,
                "confidence": 0.8
            })

    def key_to_char(key):
        if isinstance(key, keyboard.KeyCode) and key.char:
            return key.char
        if key == keyboard.Key.space:
            return " "
        if key == keyboard.Key.enter:
            return "\n"
        if key == keyboard.Key.tab:
            return "\t"
        if key == keyboard.Key.backspace:
            return "BACKSPACE"
        return None

    def on_press(key):
        global last_key_ts
        if not recording:
            return
        with record_lock:
            now = time.time()
            if last_key_ts and (now - last_key_ts) > KEY_GROUP_TIMEOUT:
                flush_keys()
            last_key_ts = now
            char = key_to_char(key)
            if char == "BACKSPACE":
                if key_buffer:
                    key_buffer.pop()
                return
            if char is None:
                return
            key_buffer.append(char)

    mouse_listener = mouse.Listener(on_click=on_click)
    keyboard_listener = keyboard.Listener(on_press=on_press)
    mouse_listener.start()
    keyboard_listener.start()

    return {"status": "recording", "label": payload.label}


@app.post("/record/stop")
def record_stop():
    global recording, mouse_listener, keyboard_listener, key_buffer
    recording = False
    if mouse_listener:
        mouse_listener.stop()
    if keyboard_listener:
        keyboard_listener.stop()
    with record_lock:
        if key_buffer:
            recorded_events.append({
                "type": "desktop_type",
                "value": "".join(key_buffer)
            })
            key_buffer = []
    return {"status": "stopped", "events": recorded_events}


@app.post("/run")
def run_action(payload: RunPayload):
    action_type = payload.type
    data = payload.data

    try:
        if action_type == "desktop_click":
            pyautogui.click(x=data.get("x"), y=data.get("y"), button=data.get("button", "left"))
            return {"ok": True}

        if action_type == "desktop_click_image":
            path = data.get("imagePath")
            confidence = data.get("confidence", 0.8)
            if path:
                location = pyautogui.locateOnScreen(path, confidence=confidence)
                if location:
                    pyautogui.click(x=location.left + location.width / 2, y=location.top + location.height / 2)
                    return {"ok": True, "matched": True}
            if data.get("x") is not None and data.get("y") is not None:
                pyautogui.click(x=data.get("x"), y=data.get("y"), button=data.get("button", "left"))
                return {"ok": True, "matched": False}
            return {"ok": False, "error": "image_not_found"}

        if action_type == "desktop_type":
            value = data.get("value", "")
            pyautogui.typewrite(value, interval=0.01)
            return {"ok": True}

        if action_type == "desktop_wait_for_image":
            path = data.get("imagePath")
            timeout = data.get("timeoutMs", 10000) / 1000
            start = time.time()
            while time.time() - start < timeout:
                location = pyautogui.locateOnScreen(path, confidence=0.8)
                if location:
                    return {"ok": True, "location": {
                        "left": location.left,
                        "top": location.top,
                        "width": location.width,
                        "height": location.height
                    }}
                time.sleep(0.25)
            return {"ok": False, "error": "timeout"}

        return {"ok": False, "error": "unknown_action"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
