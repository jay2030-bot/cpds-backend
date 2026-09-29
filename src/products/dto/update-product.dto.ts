import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

// manufacturerId is deliberately not updatable: a product never moves between manufacturers.
export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['manufacturerId'] as const)) {}
