import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { ApiResult } from '../common/dto/api-result';
import { BulkGenerateDto } from './dto/bulk-generate.dto';
import { QueryCodesDto } from './dto/query-codes.dto';
import { UpdateCodeStatusDto } from './dto/update-code-status.dto';
import { ProductCodesService } from './product-codes.service';

@ApiTags('Verification Codes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANUFACTURER)
@Controller()
export class ProductCodesController {
  constructor(private readonly service: ProductCodesService) {}

  @Post('products/:productId/verification-code')
  @ApiOperation({ summary: 'Generate one secure verification code + QR target URL for a product' })
  async create(@Param('productId', ParseUUIDPipe) productId: string, @CurrentUser() user: AuthUser) {
    return new ApiResult(await this.service.create(productId, user), 'Verification code generated successfully');
  }

  @Post('products/:productId/verification-codes/bulk')
  @ApiOperation({ summary: 'Generate many verification codes at once (e.g. for a production batch)' })
  async bulkCreate(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: BulkGenerateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return new ApiResult(await this.service.bulkCreate(productId, dto.quantity, user), 'Verification codes generated successfully');
  }

  @Get('products/:productId/verification-codes')
  @ApiOperation({ summary: 'List verification codes for a product' })
  async listForProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: QueryCodesDto,
    @CurrentUser() user: AuthUser,
  ) {
    const { items, meta } = await this.service.findAllForProduct(productId, query, user);
    return new ApiResult(items, 'Verification codes retrieved', meta);
  }

  @Get('verification-codes/:id')
  @ApiOperation({ summary: 'Get one verification code' })
  async getOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return new ApiResult(await this.service.findOneScoped(id, user), 'Verification code retrieved');
  }

  @Patch('verification-codes/:id/status')
  @ApiOperation({ summary: 'Activate or deactivate a verification code' })
  async updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCodeStatusDto, @CurrentUser() user: AuthUser) {
    return new ApiResult(await this.service.updateStatus(id, dto.status, user), 'Verification code status updated');
  }

  @Get('verification-codes/:id/qrcode.png')
  @ApiOperation({ summary: 'Download the QR code as PNG' })
  @ApiProduces('image/png')
  @Header('Content-Type', 'image/png')
  async downloadPng(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    const buffer = await this.service.getQrPng(id, user);
    res.setHeader('Content-Disposition', `attachment; filename="${id}.png"`);
    res.send(buffer);
  }

  @Get('verification-codes/:id/qrcode.svg')
  @ApiOperation({ summary: 'Download the QR code as SVG' })
  @ApiProduces('image/svg+xml')
  @Header('Content-Type', 'image/svg+xml')
  async downloadSvg(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    const svg = await this.service.getQrSvg(id, user);
    res.setHeader('Content-Disposition', `attachment; filename="${id}.svg"`);
    res.send(svg);
  }
}
