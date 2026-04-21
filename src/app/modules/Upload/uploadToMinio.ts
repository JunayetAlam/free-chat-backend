import * as Minio from 'minio';
import { nanoid } from 'nanoid';
import httpStatus from 'http-status';
import config from '../../../config';
import AppError from '../../errors/AppError';

export const minioClient = new Minio.Client({
    endPoint: config.mi_space.endpoints as string,
    port: 9000,
    useSSL: false,
    accessKey: config.mi_space.access_key,
    secretKey: config.mi_space.secret_key,
});

// --------------------- Types ---------------------
export type MulterFile = Express.Multer.File;
export type MulterFileInput<T extends MulterFile | MulterFile[]> =
    T extends MulterFile[] ? MulterFile[] : MulterFile;

// --------------------- Upload ---------------------
export const uploadToMinIO = async <T extends MulterFile | MulterFile[]>(
    files: T,
    folder: string = 'minemio',
    teamName: string = 'binary',
): Promise<T extends MulterFile[] ? string[] : string> => {
    const filesArray = Array.isArray(files) ? files : [files];
    const bucketName = config.mi_space.bucket as string;

    // Check if bucket exists
    const bucketExists = await minioClient.bucketExists(bucketName);
    if (!bucketExists) {
        await minioClient.makeBucket(bucketName, 'us-east-1');
    }

    const uploadedUrls: string[] = [];

    for (const file of filesArray) {
        try {
            const fileName = `${teamName}/${folder}/${file.originalname.split(/\.(?=[^\.]+$)/)[0]}-${nanoid(6)}.${file.originalname.split('.').pop()}`;

            const metaData = {
                'Content-Type': file.mimetype,
                'Content-Disposition': 'inline',
                'Cache-Control': 'public, max-age=31536000',
            };

            await minioClient.putObject(
                bucketName,
                fileName,
                file.buffer,
                file.size,
                metaData
            );

            const endpoint = config.mi_space.endpoints;
            const port = config.mi_space.ssl === "true" ? `:${config.mi_space.port}` : "";
            const protocol = config.mi_space.ssl === 'true' ? 'https' : 'http';

            uploadedUrls.push(`${protocol}://${endpoint}${port}/${bucketName}/${fileName}`);
        } catch (error) {
            console.log({ error });
            console.error(`Error uploading file: ${file?.originalname}`, error);
            throw new Error(`Failed to upload file: ${file?.originalname}`);
        }
    }

    // Return type based on input
    return (Array.isArray(files) ? uploadedUrls : uploadedUrls[0]) as any;
};

// --------------------- Delete ---------------------
export const deleteFromMinIO = async (
    fileInput: string | string[]
): Promise<void> => {
    const files = Array.isArray(fileInput) ? fileInput : [fileInput];
    const bucketName = config.mi_space.bucket as string;

    for (const fileUrl of files) {
        try {
            const fileName = fileUrl.split(`${bucketName}/`)[1] || fileUrl;

            await minioClient.removeObject(bucketName, fileName);
            console.log(`File deleted successfully: ${fileName}`);
        } catch (error: any) {
            console.error(`Error deleting file: ${fileUrl}`, error);
            throw new AppError(
                httpStatus.BAD_REQUEST,
                `Failed to delete file: ${error?.message}`
            );
        }
    }
};