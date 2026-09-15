import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TagNameRequest {
  @ApiProperty({ example: 'remate' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class TagResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class TagListResponse {
  @ApiProperty({ type: [TagResponse] })
  items!: TagResponse[];
}
