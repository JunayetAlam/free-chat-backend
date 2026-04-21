import httpStatus from 'http-status';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import fs from "fs";
import { Readable } from "stream";
import { nanoid } from 'nanoid';
import config from '../../../config';
import AppError from '../../errors/AppError';


const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: config.do_space.endpoints as string,
  credentials: {
    accessKeyId: config.do_space.access_key as string,
    secretAccessKey: config.do_space.secret_key as string,
  }
});

// --------------------- Types ---------------------
export type MulterFile = Express.Multer.File;
export type MulterFileInput<T extends MulterFile | MulterFile[]> =
  T extends MulterFile[] ? MulterFile[] : MulterFile;

export const uploadToCloudStorage = async <T extends MulterFile | MulterFile[]>(
  files: T,
  folder = "uploads"
): Promise<T extends MulterFile[] ? string[] : string> => {
  const filesArray = Array.isArray(files) ? files : [files];

  const uploadedUrls: string[] = [];

  for (const file of filesArray) {
    try {
      const fileStream: Readable = file.buffer
        ? Readable.from(file.buffer)
        : fs.createReadStream(file.path);

      const subFolder = file.mimetype.split("/")[0];
      const key = `${file.originalname.split(/\.(?=[^\.]+$)/)[0]}_${nanoid(6)}}`;

      const command = new PutObjectCommand({
        Bucket: process.env.DO_SPACE_BUCKET!,
        Key: key,
        Body: fileStream,
        ACL: "public-read",
        ContentType: file.mimetype,
        ContentLength: file.size,
      });

      await s3Client.send(command);

      uploadedUrls.push(
        `${process.env.DO_SPACE_ENDPOINT}/${process.env.DO_SPACE_BUCKET}/${key}`
      );
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
export const deleteFromCloudStorage = async (
  fileInput: string | string[]
): Promise<void> => {
  const files = Array.isArray(fileInput) ? fileInput : [fileInput];

  for (const fileUrl of files) {
    try {
      const key = fileUrl.replace(
        `${process.env.DO_SPACE_ENDPOINT}/${process.env.DO_SPACE_BUCKET}/`,
        ""
      );

      const command = new DeleteObjectCommand({
        Bucket: process.env.DO_SPACE_BUCKET!,
        Key: key,
      });

      await s3Client.send(command);
    } catch (error: any) {
      console.error(`Error deleting file: ${fileUrl}`, error);
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Failed to delete file: ${error?.message}`
      );
    }
  }
};