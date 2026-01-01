
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createReadStream, ReadStream } from 'fs';
import { Media, MediaDocument } from './schemas/media.schema';

interface UserPayload {
  _id?: string;
  id?: string;
  sub?: string;
}


@Injectable()
export class MediaService {
	constructor(
		@InjectModel(Media.name) private readonly mediaModel: Model<MediaDocument>,
	) {}

	async saveMedia(file: Express.Multer.File, user: UserPayload): Promise<MediaDocument> {
		const userId = user._id || user.id || user.sub;
		if (!userId) {
			throw new ForbiddenException('User ID not found');
		}
		const created = await this.mediaModel.create({
			fileName: file.filename,
			filePath: file.path,
			mimeType: file.mimetype,
			size: file.size,
			ownerId: userId,
		});
		return created;
	}
	async findByUser(userId: string): Promise<MediaDocument[]> {
		return this.mediaModel.find({ ownerId: userId }).exec();
	}

	async findById(mediaId: string, userId: string): Promise<MediaDocument> {
		const media = await this.mediaModel.findById(mediaId).exec();
		if (!media) {
			throw new NotFoundException('Media not found');
		}
		
		// Check if user is owner or in allowedUserIds
		const isOwner = media.ownerId.toString() === userId;
		const hasPermission = media.allowedUserIds.some(id => id.toString() === userId);
		
		if (!isOwner && !hasPermission) {
			throw new NotFoundException('Media not found or no permission');
		}
		
		return media;
	}

	async downloadMedia(mediaId: string, userId: string): Promise<{ stream: ReadStream; media: MediaDocument }> {
		const media = await this.findById(mediaId, userId);
		const stream = createReadStream(media.filePath);
		return { stream, media };
	}

	async deleteMedia(mediaId: string, userId: string): Promise<void> {
		const media = await this.mediaModel.findById(mediaId).exec();
		if (!media) {
			throw new NotFoundException('Media not found');
		}
		
		// Only owner can delete
		const isOwner = media.ownerId.toString() === userId;
		if (!isOwner) {
			throw new ForbiddenException('Only the owner can delete this media');
		}
		
		await this.mediaModel.findByIdAndDelete(mediaId).exec();
	}

	async getPermissions(mediaId: string, userId: string): Promise<{ mediaId: string; allowedUserIds: Types.ObjectId[] }> {
		const media = await this.mediaModel.findById(mediaId).exec();
		if (!media) {
			throw new NotFoundException('Media not found');
		}
		
		// Only owner can view permissions
		const isOwner = media.ownerId.toString() === userId;
		if (!isOwner) {
			throw new ForbiddenException('Only the owner can view permissions');
		}
		
		return { mediaId, allowedUserIds: media.allowedUserIds };
	}

	async setPermissions(mediaId: string, userId: string, userIds: string[]): Promise<{ mediaId: string; allowedUserIds: Types.ObjectId[] }> {
		const media = await this.mediaModel.findById(mediaId).exec();
		if (!media) {
			throw new NotFoundException('Media not found');
		}
		
		// Only owner can set permissions
		const isOwner = media.ownerId.toString() === userId;
		if (!isOwner) {
			throw new ForbiddenException('Only the owner can set permissions');
		}
		
		// Update allowedUserIds array
		const allowedUserIds = userIds.map(uid => new Types.ObjectId(uid));
		media.allowedUserIds = allowedUserIds;
		await media.save();
		
		return { mediaId, allowedUserIds: media.allowedUserIds };
	}
}
