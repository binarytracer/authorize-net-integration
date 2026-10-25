import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmptyObject, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';

// One-time token produced on the device by Accept.js / the Accept mobile SDK.
export class OpaqueDataDto {
  @ApiProperty({ example: 'COMMON.ACCEPT.INAPP.PAYMENT' })
  @IsString()
  @IsNotEmpty()
  dataDescriptor!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dataValue!: string;
}

export class CreatePaymentDto {
  @ApiProperty({ example: '10.00', description: 'Decimal string with exactly two decimals' })
  @Matches(/^\d+\.\d{2}$/, { message: 'amount must look like 10.00' })
  amount!: string;

  @ApiProperty({ type: OpaqueDataDto })
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => OpaqueDataDto)
  opaqueData!: OpaqueDataDto;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  invoiceNumber?: string;
}
