import tempfile
import time
import threading
from pathlib import Path

import numpy as np
import sounddevice as sd
import soundfile as sf
from rich.console import Console
from rich.live import Live
from rich.text import Text

console = Console()

SAMPLE_RATE = 16000
CHANNELS = 1
MIN_DURATION_SECONDS = 2


class AudioCurtoError(Exception):
    pass


def gravar_audio() -> str:
    """Grava áudio do microfone até Ctrl+C. Retorna path do arquivo WAV."""
    frames = []
    stop_event = threading.Event()

    def callback(indata, frame_count, time_info, status):
        if not stop_event.is_set():
            frames.append(indata.copy())

    tmp_path = tempfile.mktemp(prefix="tdah-audio-", suffix=".wav")

    stream = sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype="float32",
        callback=callback,
    )

    inicio = time.time()

    try:
        with stream:
            with Live(console=console, refresh_per_second=4) as live:
                while True:
                    elapsed = time.time() - inicio
                    bar = _barra_tempo(elapsed)
                    live.update(
                        Text(f"🎤  Gravando... {bar}  {elapsed:.0f}s  (Ctrl+C pra parar)", style="yellow")
                    )
                    time.sleep(0.25)

    except KeyboardInterrupt:
        stop_event.set()

    duracao = time.time() - inicio

    if duracao < MIN_DURATION_SECONDS or not frames:
        raise AudioCurtoError(
            f"Áudio muito curto ({duracao:.1f}s). Grave pelo menos {MIN_DURATION_SECONDS}s."
        )

    audio = np.concatenate(frames, axis=0)
    sf.write(tmp_path, audio, SAMPLE_RATE)

    console.print(f"[green]✓ Áudio gravado[/green] ({duracao:.1f}s)")
    return tmp_path


def _barra_tempo(segundos: float) -> str:
    blocos = min(int(segundos / 2), 20)
    return "█" * blocos + "░" * (20 - blocos)
