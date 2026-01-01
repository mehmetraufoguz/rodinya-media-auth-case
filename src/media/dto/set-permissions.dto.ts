import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsMongoId } from 'class-validator';

export class SetPermissionsDto {
  @ApiProperty({ 
    description: 'Array of user IDs to grant access to this media',
    type: [String],
    example: ['507f1f77bcf86cd799439011', '507f191e810c19729de860ea']
  })
  @IsArray()
  @IsMongoId({ each: true })
  userIds: string[];
}
