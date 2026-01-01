import {
	Controller,
	Post,
	UploadedFile,
	UseGuards,
	UseInterceptors,
	Req,
	BadRequestException,
	Get,
	Param,
	Delete,
	Body,
	Res,
	StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { UploadMediaDto } from './dto/upload-media.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';
import { MediaService } from './media.service';
import { RequestWithUser } from '../interfaces/request-with-user.interface';

@ApiTags('media')
@ApiBearerAuth('access-token')
@Controller('media')
export class MediaController {
	constructor(
		private readonly mediaService: MediaService,
	) {}

	@UseGuards(AuthGuard)
	@Post('upload')
	@ApiOperation({ summary: 'Upload JPEG media file' })
	@ApiConsumes('multipart/form-data')
	@ApiBody({ type: UploadMediaDto })
	@ApiResponse({ status: 201, description: 'File uploaded successfully' })
	@ApiResponse({ status: 400, description: 'Invalid file or file too large' })
	@ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
	@UseInterceptors(
		FileInterceptor('file', {
			storage: diskStorage({
				destination: (req, file, cb) => {
					const uploadDir = process.env.UPLOAD_DIR || 'uploads';
					cb(null, uploadDir);
				},
				filename: (req, file, cb) => {
					const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
					cb(null, uniqueSuffix + extname(file.originalname));
				},
			}),
			fileFilter: (req, file, cb) => {
				if (file.mimetype !== 'image/jpeg') {
					return cb(new BadRequestException('Only JPEG files are allowed'), false);
				}
				cb(null, true);
			},
			limits: {
				fileSize: (process.env.MAX_FILE_SIZE ? parseInt(process.env.MAX_FILE_SIZE) : 5 * 1024 * 1024),
			},
		})
	)
	async uploadMedia(
		@UploadedFile() file: Express.Multer.File,
		@Req() req: RequestWithUser,
	) {
		if (!file) {
			throw new BadRequestException('No file uploaded');
		}
		// Save file metadata in DB
		const media = await this.mediaService.saveMedia(file, req.user);
		return { message: 'File uploaded successfully', media };
	}

	@UseGuards(AuthGuard)
	@ApiOperation({ summary: 'List my uploaded media files' })
	@ApiResponse({ status: 200, description: 'List of user media files' })
	@ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
	@Get('my')
	async getMyMedia(@Req() req: RequestWithUser) {
		const userId = req.user?.sub || req.user?._id || req.user?.id;
		return this.mediaService.findByUser(userId);
	}

	@UseGuards(AuthGuard)
	@ApiOperation({ summary: 'Get media by ID' })
	@ApiResponse({ status: 200, description: 'Media metadata' })
	@ApiResponse({ status: 404, description: 'Media not found or no permission' })
	@ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
	@Get(':id')
	async getMediaById(@Req() req: RequestWithUser, @Param('id') id: string) {
		const userId = req.user?.sub || req.user?._id || req.user?.id;
		return this.mediaService.findById(id, userId);
	}

	@UseGuards(AuthGuard)
	@ApiOperation({ summary: 'Download media file by ID' })
	@ApiResponse({ status: 200, description: 'Media file download' })
	@ApiResponse({ status: 404, description: 'Media not found or no permission' })
	@ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
	@Get(':id/download')
	async downloadMedia(
		@Req() req: RequestWithUser,
		@Param('id') id: string,
		@Res({ passthrough: true }) res: Response,
	) {
		const userId = req.user?.sub || req.user?._id || req.user?.id;
		const { stream, media } = await this.mediaService.downloadMedia(id, userId);
		res.set({
			'Content-Type': media.mimeType,
			'Content-Disposition': `attachment; filename="${media.fileName}"`,
		});
		return new StreamableFile(stream);
	}

	@UseGuards(AuthGuard)
	@ApiOperation({ summary: 'Delete media by ID' })
	@ApiResponse({ status: 200, description: 'Media deleted' })
	@ApiResponse({ status: 404, description: 'Media not found or no permission' })
	@ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
	@ApiForbiddenResponse({ description: 'Only the owner can delete this media' })
	@Delete(':id')
	async deleteMedia(@Req() req: RequestWithUser, @Param('id') id: string) {
		const userId = req.user?.sub || req.user?._id || req.user?.id;
		await this.mediaService.deleteMedia(id, userId);
		return { message: 'Media deleted successfully' };
	}

	@UseGuards(AuthGuard)
	@ApiOperation({ summary: 'Get media permissions by ID' })
	@ApiResponse({ status: 200, description: 'Media permissions' })
	@ApiResponse({ status: 404, description: 'Media not found or no permission' })
	@ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
	@ApiForbiddenResponse({ description: 'Only the owner can view permissions' })
	@Get(':id/permissions')
	async getMediaPermissions(@Req() req: RequestWithUser, @Param('id') id: string) {
		const userId = req.user?.sub || req.user?._id || req.user?.id;
		return this.mediaService.getPermissions(id, userId);
	}

	@UseGuards(AuthGuard)
	@ApiOperation({ summary: 'Set media permissions by ID' })
	@ApiBody({ type: SetPermissionsDto })
	@ApiResponse({ status: 200, description: 'Permissions updated' })
	@ApiResponse({ status: 404, description: 'Media not found or no permission' })
	@ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
	@ApiForbiddenResponse({ description: 'Only the owner can set permissions' })
	@Post(':id/permissions')
	async setMediaPermissions(
		@Req() req: RequestWithUser,
		@Param('id') id: string,
		@Body() dto: SetPermissionsDto,
	) {
		const userId = req.user?.sub || req.user?._id || req.user?.id;
		const permissions = await this.mediaService.setPermissions(id, userId, dto.userIds);
		return { message: 'Permissions updated successfully', permissions };
	}
}
