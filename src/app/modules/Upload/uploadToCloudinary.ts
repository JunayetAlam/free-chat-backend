/* eslint-disable no-console */

import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import config from '../../../config';

cloudinary.config({
    cloud_name: config.cloudinary.cloud_name,
    api_key: config.cloudinary.api_key,
    api_secret: config.cloudinary.api_secret,
});

const PROJECT_NAME = config.cloudinary.project_name || 'my-project';

interface UploadResponse {
    Location: string;
    public_id: string;
}

/**
 * Decide folder & resource type based on mimetype
 */
const getCloudinaryConfig = (mimetype: string): { folder: string; resource_type: 'auto' | 'image' | 'video' | 'raw' } => {
    if (mimetype.startsWith('image/')) {
        return {
            folder: `${PROJECT_NAME}/uploads/images`,
            resource_type: 'image',
        };
    }

    if (mimetype.startsWith('video/')) {
        return {
            folder: `${PROJECT_NAME}/uploads/videos`,
            resource_type: 'video',
        };
    }

    if (mimetype === 'application/pdf') {
        return {
            folder: `${PROJECT_NAME}/uploads/pdf`,
            resource_type: 'raw',
        };
    }

    return {
        folder: `${PROJECT_NAME}/uploads/others`,
        resource_type: 'raw',
    };
};

export const uploadToCloudinary = async (
    file: Express.Multer.File,
): Promise<UploadResponse> => {
    try {
        if (!file || !file.originalname) {
            throw new Error('No file provided or missing originalname');
        }

        const filename =
            Date.now() + '-' + Math.round(Math.random() * 1e9);

        const { folder, resource_type } = getCloudinaryConfig(file.mimetype);

        return new Promise((resolve, reject) => {
            cloudinary.uploader
                .upload_stream(
                    {
                        folder,
                        public_id: filename,
                        resource_type,
                    },
                    (error, result) => {
                        if (error || !result) {
                            return reject(error);
                        }

                        resolve({
                            Location: result.secure_url,
                            public_id: result.public_id,
                        });
                    },
                )
                .end(file.buffer);
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        return {
            Location: '',
            public_id: '',
        };
    }
};

export const uploadMultipleToCloudinary = async (
    files: Express.Multer.File[]
): Promise<UploadResponse[]> => {
    const uploadPromises = files.map(file => uploadToCloudinary(file));

    try {
        const results = await Promise.all(uploadPromises);
        return results;
    } catch (error) {
        console.error("Bulk upload failed", error);
        throw error;
    }
};

export const deleteFromCloudinary = async (
    fileUrl: string,
): Promise<void> => {
    try {
        const resourceType = getResourceTypeFromUrl(fileUrl);
        const publicId = getPublicIdFromUrl(fileUrl);

        await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
        });

        console.log(`Deleted file: ${publicId}`);
    } catch (error: any) {
        console.error('Error deleting file:', error);
    }
};

export const deleteMultipleByUrl = async (urls: string[]) => {
    try {
        const publicIds = urls.map(url => getPublicIdFromUrl(url));
        const result = await cloudinary.api.delete_resources(publicIds);
        return result;
    } catch (error) {
        console.error("Bulk deletion by URL failed:", error);
        throw error;
    }
};

type CloudinaryResourceType = 'image' | 'video' | 'raw';
const getResourceTypeFromUrl = (url: string): CloudinaryResourceType => {
    if (url.includes('/image/upload/')) return 'image';
    if (url.includes('/video/upload/')) return 'video';
    return 'raw';
};

const getPublicIdFromUrl = (url: string): string => {
    const parts = url.split('/upload/')[1]; // after upload/
    return parts.replace(/^v\d+\//, '').replace(/\.[^/.]+$/, '');
};