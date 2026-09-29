import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { ApiResult } from '../common/dto/api-result';
import { CreateManufacturerDto } from './dto/create-manufacturer.dto';
import { QueryManufacturersDto } from './dto/query-manufacturers.dto';
import { UpdateManufacturerDto } from './dto/update-manufacturer.dto';
import { ManufacturersService } from './manufacturers.service';

@ApiTags('Manufacturers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('manufacturers')
export class ManufacturersController {
  constructor(private readonly service: ManufacturersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a manufacturer (optionally with its login user)' })
  @ApiResponse({ status: 201, description: 'Manufacturer created' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async create(@Body() dto: CreateManufacturerDto, @CurrentUser() user: AuthUser) {
    return new ApiResult(await this.service.create(dto, user), 'Manufacturer created successfully');
  }

  @Get()
  @ApiOperation({ summary: 'List manufacturers with search and pagination' })
  async list(@Query() query: QueryManufacturersDto) {
    const { items, meta } = await this.service.findAll(query);
    return new ApiResult(items, 'Manufacturers retrieved', meta);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one manufacturer' })
  @ApiResponse({ status: 404, description: 'Manufacturer not found' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return new ApiResult(await this.service.findOne(id), 'Manufacturer retrieved');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a manufacturer; isActive also toggles its login users' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateManufacturerDto, @CurrentUser() user: AuthUser) {
    return new ApiResult(await this.service.update(id, dto, user), 'Manufacturer updated successfully');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a manufacturer (soft delete)' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return new ApiResult(await this.service.deactivate(id, user), 'Manufacturer deactivated');
  }
}
