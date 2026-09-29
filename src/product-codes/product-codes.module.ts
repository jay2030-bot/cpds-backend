import { Module } from '@nestjs/common';
import { ProductCodesController } from './product-codes.controller';
import { ProductCodesService } from './product-codes.service';
import { QrCodeService } from './qrcode.service';

@Module({
  controllers: [ProductCodesController],
  providers: [ProductCodesService, QrCodeService],
  exports: [ProductCodesService, QrCodeService],
})
export class ProductCodesModule {}
