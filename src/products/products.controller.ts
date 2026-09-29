import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { ApiResult } from '../common/dto/api-result';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANUFACTURER)
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Register a product' })
  @ApiResponse({ status: 201, description: 'Product created' })
  @ApiResponse({ status: 409, description: 'Duplicate product code' })
  async create(@Body() dto: CreateProductDto, @CurrentUser() user: AuthUser) {
    return new ApiResult(await this.service.create(dto, user), 'Product created successfully');
  }

  @Get()
  @ApiOperation({ summary: 'List products (manufacturers only see their own)' })
  async list(@Query() query: QueryProductsDto, @CurrentUser() user: AuthUser) {
    const { items, meta } = await this.service.findAll(query, user);
    return new ApiResult(items, 'Products retrieved', meta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one product' })
  @ApiResponse({ status: 404, description: 'Not found (also returned for other manufacturers\' products)' })
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return new ApiResult(await this.service.findOne(id, user), 'Product retrieved');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product (including status: ACTIVE / INACTIVE / RECALLED)' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: AuthUser) {
    return new ApiResult(await this.service.update(id, dto, user), 'Product updated successfully');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product that has no verification codes' })
  @ApiResponse({ status: 409, description: 'Product has verification codes' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return new ApiResult(await this.service.remove(id, user), 'Product deleted successfully');
  }
}
