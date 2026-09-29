import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';

@Injectable()
export class QrCodeService {
  constructor(private readonly config: ConfigService) {}

  /** The URL encoded inside the QR image and stored as qrCodeUrl. Never hard-coded. */
  buildVerificationUrl(token: string): string {
    const base = this.config.getOrThrow<string>('FRONTEND_URL').replace(/\/+$/, '');
    return `${base}/verify/${token}`;
  }

  toPngBuffer(url: string): Promise<Buffer> {
    return QRCode.toBuffer(url, { type: 'png', errorCorrectionLevel: 'M', margin: 2, width: 400 });
  }

  toSvgString(url: string): Promise<string> {
    return QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 });
  }
}
