'use client';

import { useEffect, useRef, useState } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
  onResult: (text: string, format: string) => void;
  onClose?: () => void;
  /** Optional area to render the scanner in. Defaults to "udgok-scanner-region". */
  regionId?: string;
}

type Status = 'idle' | 'starting' | 'scanning' | 'error' | 'denied' | 'unavailable';

/**
 * Camera-based barcode/QR scanner. Wraps html5-qrcode which handles
 * all the camera permission + format detection. The component stops
 * the camera on unmount to release it.
 */
export function BarcodeScanner({ onResult, onClose, regionId = 'udgok-scanner-region' }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [lastResult, setLastResult] = useState<string | null>(null);

  useEffect(() => {
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
      setStatus('unavailable');
      setErrMsg('Your browser does not support camera access');
      return;
    }

    let cancelled = false;

    async function start() {
      setStatus('starting');
      // Dynamic import to avoid SSR issues
      const { Html5Qrcode } = await import('html5-qrcode');
      if (cancelled) return;
      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 200 } },
          (decodedText, decodedResult) => {
            if (cancelled) return;
            const format = decodedResult.result.format?.formatName ?? 'unknown';
            setLastResult(decodedText);
            onResult(decodedText, format);
          },
          () => {
            // per-frame failures are normal during scanning
          },
        );
        if (!cancelled) setStatus('scanning');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|denied|notallowed/i.test(msg)) {
          setStatus('denied');
          setErrMsg('Camera access denied. Please enable camera permissions in your browser settings.');
        } else {
          setStatus('error');
          setErrMsg(msg);
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        // html5-qrcode's stop() can throw synchronously OR
        // reject its returned promise if the scanner is
        // mid-startup, has already stopped, or was never
        // successfully started. The most common case is
        // "Cannot stop, scanner is not running or paused." —
        // happens when the parent re-renders (e.g. user types
        // in the manual code input below) and the effect's
        // cleanup runs while the scanner is still starting.
        //
        // Promise.resolve() only wraps a value; it does NOT
        // catch synchronous throws. So we wrap stop() in a
        // real try/catch and merge both error paths into a
        // single swallow.
        //
        // Stop is best-effort: if it failed, the next start()
        // will create a fresh instance and the old one will
        // be GC'd.
        const safeStop = (): Promise<void> => {
          try {
            const result = scanner.stop?.();
            if (result && typeof (result as Promise<unknown>).then === 'function') {
              return (result as Promise<void>).catch(() => {});
            }
            return Promise.resolve();
          } catch {
            return Promise.resolve();
          }
        };
        safeStop().then(() => {
          try {
            scanner.clear();
          } catch {
            // Same here — clear() can throw if stop didn't
            // actually start the camera. Swallow.
          }
        });
      }
    };
  }, [onResult, regionId]);

  return (
    <div className="bg-paper border-2 border-ink p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-orange-d">
            {'// Scan barcode or QR'}
          </div>
          <h2 className="font-extrabold text-lg mt-0.5">Point your camera</h2>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 -mr-1 flex items-center justify-center text-ink-50 hover:text-ink"
            aria-label="Close scanner"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : null}
      </div>

      {/* Scanner viewport */}
      <div
        id={regionId}
        className="w-full max-w-md mx-auto bg-ink aspect-square border-2 border-ink overflow-hidden"
        style={{ minHeight: 240 }}
      />

      {status === 'starting' ? (
        <p className="text-center text-[12px] text-ink-50 mt-3">Starting camera…</p>
      ) : null}

      {status === 'scanning' && lastResult ? (
        <div className="mt-4 p-3 bg-success/10 border border-success">
          <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-success font-extrabold mb-1">
            ✓ Scanned
          </div>
          <div className="text-[13px] font-mono break-all">{lastResult}</div>
        </div>
      ) : null}

      {status === 'denied' ? (
        <div className="mt-4 p-3 bg-error/10 border border-error">
          <div className="text-[11px] font-extrabold text-error mb-1">📷 Camera access denied</div>
          <p className="text-[11px] text-ink-70">{errMsg}</p>
        </div>
      ) : null}

      {status === 'unavailable' ? (
        <div className="mt-4 p-3 bg-warning/10 border border-warning">
          <p className="text-[11px]">{errMsg}</p>
        </div>
      ) : null}

      {status === 'error' && errMsg ? (
        <div className="mt-4 p-3 bg-error/10 border border-error">
          <p className="text-[11px] text-error font-mono">{errMsg}</p>
        </div>
      ) : null}
    </div>
  );
}
