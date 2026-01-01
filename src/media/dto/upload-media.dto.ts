import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class UploadMediaDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'JPEG file to upload' })
  @IsNotEmpty()
  file: Express.Multer.File;
}
