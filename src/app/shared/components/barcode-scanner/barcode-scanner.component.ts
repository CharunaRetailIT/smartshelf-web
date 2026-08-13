import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

export interface BarcodeScannerData {
  /** Keep scanning and collect several MACs instead of closing on the first. */
  multiple?: boolean;
  /** MACs already entered, so re-scanning one is reported as a duplicate. */
  existing?: string[];
}

/**
 * Reads device MACs off Minew barcode stickers using the camera - the laptop
 * webcam, or the rear camera when the same page is opened on a phone.
 *
 * Always closes with an array of normalised MACs (12 lowercase hex chars, no
 * separators); empty when dismissed. In single mode it closes on the first hit.
 */
@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './barcode-scanner.component.html',
  styleUrls: ['./barcode-scanner.component.css']
})
export class BarcodeScannerComponent implements OnInit, OnDestroy {
  @ViewChild('preview', { static: true }) preview!: ElementRef<HTMLVideoElement>;

  private dialogRef = inject(MatDialogRef<BarcodeScannerComponent, string[]>);
  private data = inject<BarcodeScannerData | null>(MAT_DIALOG_DATA, { optional: true });

  private reader?: BrowserMultiFormatReader;
  private controls?: IScannerControls;

  /** Already-entered MACs, so a re-scan reads as duplicate rather than new. */
  private existing = new Set<string>();

  readonly multiple = !!this.data?.multiple;

  cameras = signal<MediaDeviceInfo[]>([]);
  selectedCameraId = signal<string | null>(null);
  starting = signal(true);
  error = signal<string | null>(null);
  lastRejected = signal<string | null>(null);
  collected = signal<string[]>([]);
  duplicate = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    for (const mac of this.data?.existing ?? []) {
      const normalised = BarcodeScannerComponent.normaliseMac(mac);
      if (normalised) this.existing.add(normalised);
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.fail('This browser cannot access a camera.');
      return;
    }

    // getUserMedia is only exposed in a secure context. Served over plain HTTP
    // on a LAN address - the usual way a phone reaches a dev box - it is simply
    // absent, so say why rather than showing a dead viewfinder.
    if (!window.isSecureContext) {
      this.fail(
        'The camera needs a secure connection. Open this page over HTTPS ' +
        '(or on localhost) and try again.');
      return;
    }

    const hints = new Map();
    // Minew stickers are 1D in practice, but QR and Data Matrix cost nothing to
    // accept and some label batches use them.
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    this.reader = new BrowserMultiFormatReader(hints);

    try {
      await this.loadCameras();
      await this.start();
    } catch (err: any) {
      this.fail(this.describeCameraError(err));
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private async loadCameras(): Promise<void> {
    // Labels stay blank until permission is granted, so ask first - otherwise
    // the picker reads "camera 1 / camera 2" with no way to tell them apart.
    const probe = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }
    });
    probe.getTracks().forEach(t => t.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter(d => d.kind === 'videoinput');
    this.cameras.set(cams);

    // Prefer a rear camera on a phone; a laptop only has the one.
    const rear = cams.find(c => /back|rear|environment/i.test(c.label));
    this.selectedCameraId.set((rear ?? cams[0])?.deviceId ?? null);
  }

  private async start(): Promise<void> {
    if (!this.reader) return;

    this.stop();
    this.starting.set(true);
    this.error.set(null);

    this.controls = await this.reader.decodeFromVideoDevice(
      this.selectedCameraId() ?? undefined,
      this.preview.nativeElement,
      (result, err) => {
        if (!result) return;   // no read yet on this frame; err is per-frame noise
        this.onDecoded(result.getText());
      }
    );

    this.starting.set(false);
  }

  private onDecoded(raw: string): void {
    const mac = BarcodeScannerComponent.normaliseMac(raw);

    if (!mac) {
      // Keep scanning - a sticker often carries several barcodes and the first
      // one in view may be a model or batch code rather than the MAC.
      this.lastRejected.set(raw.trim().slice(0, 40));
      return;
    }

    this.lastRejected.set(null);

    if (!this.multiple) {
      this.stop();
      this.dialogRef.close([mac]);
      return;
    }

    // Continuous mode: the same label sits in frame for many frames, so
    // silently ignore a MAC already held rather than counting it twice.
    if (this.existing.has(mac) || this.collected().includes(mac)) {
      this.duplicate.set(mac);
      return;
    }

    this.duplicate.set(null);
    this.collected.update(list => [...list, mac]);
    this.beep();
  }

  /** Short tick so the operator knows a label registered without looking up. */
  private beep(): void {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.05;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
      osc.onended = () => ctx.close();
    } catch {
      // Audio is a nicety; never let it break scanning.
    }
  }

  removeCollected(mac: string): void {
    this.collected.update(list => list.filter(m => m !== mac));
  }

  finish(): void {
    this.stop();
    this.dialogRef.close(this.collected());
  }

  /**
   * Accepts the shapes a Minew sticker uses and returns the 12 lowercase hex
   * digits the API expects, or null when the payload is not a MAC.
   *
   * Mirrors the server's own cleaning in BatchAddDevicesToMinew: strip
   * separators, lowercase, require exactly 12 hex characters.
   */
  static normaliseMac(raw: string): string | null {
    if (!raw) return null;

    let value = raw.trim();

    // Some stickers encode a URL or key=value payload; take the last chunk.
    const tail = value.split(/[/=?&:\s]+/).filter(Boolean).pop();
    const candidates = [value, tail ?? ''];

    for (const candidate of candidates) {
      const cleaned = candidate.replace(/[:\-.\s]/g, '').toLowerCase();
      if (/^[0-9a-f]{12}$/.test(cleaned)) return cleaned;
    }

    return null;
  }

  async onCameraChange(deviceId: string): Promise<void> {
    this.selectedCameraId.set(deviceId);
    try {
      await this.start();
    } catch (err: any) {
      this.fail(this.describeCameraError(err));
    }
  }

  private describeCameraError(err: any): string {
    switch (err?.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return 'Camera permission was denied. Allow camera access for this site and try again.';
      case 'NotFoundError':
      case 'OverconstrainedError':
        return 'No camera was found on this device.';
      case 'NotReadableError':
        return 'The camera is already in use by another application.';
      default:
        return err?.message || 'The camera could not be started.';
    }
  }

  private fail(message: string): void {
    this.error.set(message);
    this.starting.set(false);
  }

  private stop(): void {
    this.controls?.stop();
    this.controls = undefined;
  }

  cancel(): void {
    this.stop();
    this.dialogRef.close([]);
  }
}
