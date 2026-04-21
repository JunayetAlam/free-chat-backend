import {
  Prisma
} from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import AppError from '../errors/AppError';
import handleZodError from '../errors/handleZodError';

const handlePrismaValidationError = (err: Prisma.PrismaClientValidationError) => {
  const rawMessage = err.message || 'Prisma validation error occurred.';
  let cleanMessage = 'Validation error in Prisma operation';
  let suggestion = '';

  const missingFieldMatch = rawMessage.match(/Argument `(\w+)` is missing/);
  if (missingFieldMatch) {
    const field = missingFieldMatch[1];
    cleanMessage = `Prisma error: The "${field}" field is required in the create/update query.`;
    suggestion = `Example: prisma.alert.create({ data: { ${field}: "Your value", ...otherFields } })`;
  } else if (rawMessage.includes('Argument `data` is missing')) {
    cleanMessage = 'Prisma error: The "data" property is required in create/update queries.';
    suggestion = 'Example: prisma.alert.create({ data: { title: "Your title", ... } })';
  } else if (rawMessage.includes('Unknown arg')) {
    cleanMessage = 'Prisma error: You passed an invalid field to the query.';
    suggestion = 'Check your field names in the `data` object.';
  }

  return {
    statusCode: 400,
    message: cleanMessage,
    errorDetails: { fullError: rawMessage, suggestion },
  };
};

const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.log(err);
  let statusCode = 500;
  let message = 'Something went wrong!';
  let errorDetails: Record<string, any> = {};

  if (err instanceof ZodError) {
    const simplifiedError = handleZodError(err);
    statusCode = simplifiedError?.statusCode || 400;
    message = simplifiedError?.message || 'Validation error';
    errorDetails = simplifiedError?.errorDetails || {};
  } else if (err?.code === 'P2002') {
    statusCode = 409;
    message = `Duplicate entity on the fields: ${err.meta?.target?.join(', ')}`;
    errorDetails = { code: err.code, target: err.meta?.target };
  } else if (err?.code === 'P2003') {
    statusCode = 400;
    message = `Foreign key constraint failed on the field: ${err.meta?.field_name}`;
    errorDetails = { code: err.code, field: err.meta?.field_name, model: err.meta?.modelName };
  } else if (err?.code === 'P2011') {
    statusCode = 400;
    message = `Null constraint violation on the field: ${err.meta?.field_name}`;
    errorDetails = { code: err.code, field: err.meta?.field_name };
  } else if (err?.code === 'P2025') {
    console.log(err)
    statusCode = 404;
    message = `${err?.meta?.modelName} Not Found!!`;
    errorDetails = { code: err.code, cause: err.meta?.cause };
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    const formatted = handlePrismaValidationError(err);
    statusCode = formatted.statusCode;
    message = formatted.message;
    errorDetails = formatted.errorDetails;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = 400;
    message = err.message;
    errorDetails = { code: err.code, meta: err.meta };
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = 500;
    message = err.message;
    errorDetails = err;
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorDetails = { stack: err.stack };
  } else if (err instanceof Error) {
    if (err.name === 'TokenExpiredError') {
      statusCode = 401;
      message = 'Expired token';
      errorDetails = { stack: err.stack };
    } else {
      message = err.message;
      errorDetails = { err, stack: err.stack };
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorDetails,
    statusCode: statusCode
  });
};

export default globalErrorHandler;
