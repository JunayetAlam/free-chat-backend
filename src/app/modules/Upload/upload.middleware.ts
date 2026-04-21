import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { FileTypePattern } from "./upload.interface";


const storage = multer.memoryStorage();

const baseMulter = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB global hard cap
});


const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};


export interface BaseUploadOptions {
    isRequired?: boolean;
    allowedFileTypes?: FileTypePattern[];
    maxFileSize?: number;
    minFileSize?: number;
}

export interface SingleUploadOptions extends BaseUploadOptions { }

export interface ArrayUploadOptions extends BaseUploadOptions {
    minFiles?: number;
    maxFiles?: number;
}

export interface FieldsUploadOptions {
    [fieldName: string]: BaseUploadOptions & {
        minFiles?: number;
        maxFiles?: number;
    };
}


const validateFile = (
    file: Express.Multer.File,
    fieldName: string,
    options?: BaseUploadOptions
) => {
    if (!file) return;

    const allowedTypes = options?.allowedFileTypes;
    const minSizeBytes = options?.minFileSize
        ? options.minFileSize * 1024 * 1024
        : null;
    const maxSizeBytes = options?.maxFileSize
        ? options.maxFileSize * 1024 * 1024
        : null;

    // MIME validation with wildcard
    if (allowedTypes) {
        const isAllowed = allowedTypes.some((type) => {
            if (type.endsWith("/*")) {
                const base = type.split("/")[0];
                return file.mimetype.startsWith(base + "/");
            }
            return file.mimetype === type;
        });

        if (!isAllowed) {
            throw new Error(
                `Invalid file type for '${fieldName}'. Got '${file.mimetype}'. Allowed: ${allowedTypes.join(
                    ", "
                )}`
            );
        }
    }

    // min size
    if (minSizeBytes && file.size < minSizeBytes) {
        throw new Error(
            `File for '${fieldName}' is too small. Minimum: ${formatBytes(
                minSizeBytes
            )}. Received: ${formatBytes(file.size)}`
        );
    }

    // max size
    if (maxSizeBytes && file.size > maxSizeBytes) {
        throw new Error(
            `File for '${fieldName}' is too large. Maximum: ${formatBytes(
                maxSizeBytes
            )}. Received: ${formatBytes(file.size)}`
        );
    }
};


const validateFileCount = (
    fieldName: string,
    files: Express.Multer.File[],
    options?: { minFiles?: number; maxFiles?: number }
) => {
    if (!files) return;
    const count = files.length;

    if (options?.minFiles && count < options.minFiles) {
        throw new Error(
            `File'${fieldName}' requires at least ${options.minFiles} files. Received: ${count}`
        );
    }

    if (options?.maxFiles && count > options.maxFiles) {
        throw new Error(
            `File'${fieldName}' accepts at most ${options.maxFiles} files. Received: ${count}`
        );
    }
};


const multerDataParser = (
    multerMethod: any,
    options?: SingleUploadOptions | ArrayUploadOptions | FieldsUploadOptions,
    fieldType: "single" | "array" | "fields" | "any" = "single",
    fieldName?: string
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        multerMethod(req, res, (err: any) => {
            if (err) return next(err);

            try {
                // SINGLE FILE
                if (fieldType === "single") {
                    const opt = options as SingleUploadOptions;
                    if (opt?.isRequired && !req.file) {
                        throw new Error(`File '${fieldName}' is required.`);
                    }
                    if (req.file) validateFile(req.file, fieldName as string, opt);
                }

                // ARRAY FILES
                if (fieldType === "array" && Array.isArray(req.files)) {
                    const opt = options as ArrayUploadOptions;
                    if (opt?.isRequired && req.files.length === 0) {
                        throw new Error(`File'${fieldName}' is required.`);
                    }
                    validateFileCount(fieldName as string, req.files, opt);
                    req.files.forEach((file) =>
                        validateFile(file, fieldName as string, opt)
                    );
                }

                // FIELDS
                if (fieldType === "fields" && typeof req.files === "object") {
                    const opt = options as FieldsUploadOptions;
                    Object.entries(req.files).forEach(([fName, files]: any) => {
                        const fieldOpt = opt?.[fName] || {};
                        if (fieldOpt.isRequired && files.length === 0) {
                            throw new Error(`File'${fName}' is required.`);
                        }
                        validateFileCount(fName, files, fieldOpt);
                        files.forEach((file: any) => validateFile(file, fName, fieldOpt));
                    });
                }

                // ANY
                if (fieldType === "any" && Array.isArray(req.files)) {
                    const opt = options as ArrayUploadOptions;
                    req.files.forEach((file) => validateFile(file, file.fieldname, opt));
                    if (opt) validateFileCount("any", req.files, opt);
                }
            } catch (validationError) {
                return next(validationError);
            }

            // PARSE JSON
            if (req.body?.data) {
                try {
                    const parsed = JSON.parse(req.body.data);
                    req.body = { ...parsed, ...req.body };
                    delete req.body.data;
                } catch (err) {
                    return next(new Error("Invalid JSON format in body.data"));
                }
            }

            next();
        });
    };
};

// ------------------------------
// EXPORT MIDDLEWARE
// ------------------------------
export const uploadMiddleware = {
    single: (
        fieldName: string,
        options?: Omit<SingleUploadOptions, "maxFiles" | "minFiles">
    ) =>
        multerDataParser(
            baseMulter.single(fieldName),
            options,
            "single",
            fieldName
        ),

    array: (fieldName: string, options?: ArrayUploadOptions) =>
        multerDataParser(
            baseMulter.array(fieldName, options?.maxFiles),
            options,
            "array",
            fieldName
        ),

    fields: (
        fields: { name: string; maxCount?: number }[],
        options?: FieldsUploadOptions
    ) => multerDataParser(baseMulter.fields(fields), options, "fields"),

    any: (options?: ArrayUploadOptions) =>
        multerDataParser(baseMulter.any(), options, "any"),
};
