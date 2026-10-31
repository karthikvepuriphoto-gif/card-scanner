import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { InstallTip } from './ui';

interface ScanScreenProps {
  count: number;
  busy: boolean;
  status: string;
  error: string;
  onOpenList: () => void;
  onCapture: (blob: Blob) => void;
  onSample: () => void;
}

export function ScanScreen({ count, busy, status, error, onOpenList, onCapture, onSample }: ScanScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancel = false;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancel) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setLive(true);
      } catch {
        setLive(false);
      }
    };
    void start();
    return () => {
      cancel = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function shutter() {
    const video = videoRef.current;
    if (live && video && video.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.92));
      if (blob) onCapture(blob);
      return;
    }
    cameraInput.current?.click();
  }

  function takeFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onCapture(file);
  }

  return (
    <section className="screen scan-screen">
      <header className="topbar">
        <h1>Card Scanner</h1>
        <button type="button" className="ghost" onClick={onOpenList} aria-label={`Saved cards, ${count}`}>
          Saved
          <span className="count">{count}</span>
        </button>
      </header>
      <InstallTip />
      <div className="stage">
        <div className="finder" aria-busy={busy}>
          <video ref={videoRef} playsInline muted autoPlay className={live ? 'live' : 'hidden'} />
          {!live && !busy && (
            <p className="finder-copy">
              Fill the frame with the card. The shutter opens your camera if a live preview is not available.
            </p>
          )}
          {busy && (
            <p className="finder-copy" role="status">
              {status || 'Reading the card…'}
            </p>
          )}
          <span className="corner tl" />
          <span className="corner tr" />
          <span className="corner bl" />
          <span className="corner br" />
        </div>
        {error && (
          <p className="banner" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="dock">
        <button type="button" className="text-btn" onClick={() => libraryInput.current?.click()} disabled={busy}>
          Choose photo
        </button>
        <button type="button" className="shutter" onClick={() => void shutter()} disabled={busy} aria-label="Scan card">
          <span />
        </button>
        <button type="button" className="text-btn" onClick={onSample} disabled={busy}>
          Try sample
        </button>
      </footer>
      <input ref={cameraInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={takeFile} />
      <input ref={libraryInput} className="sr-only" type="file" accept="image/*" onChange={takeFile} />
    </section>
  );
}
