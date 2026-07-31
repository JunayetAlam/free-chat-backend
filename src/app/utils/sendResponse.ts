import { Response } from 'express';

type TMeta = {
  limit: number;
  page: number;
  total: number;
  totalPage: number;
};

type TResponse<T> = {
  statusCode: number;
  success?: boolean;
  message?: string;
  meta?: TMeta;
  quota?: Record<string, unknown>;
  data: T | any;
};

const sendResponse = <T>(res: Response, data: TResponse<T>) => {
  res.status(data?.statusCode).json({
    success: data?.success || data?.statusCode < 400 ? true : false,
    statusCode: data?.statusCode,
    message: data.data?.message || data.message,
    meta: data.meta,
    quota: data.quota,
    data: data.data,
  });
};

export default sendResponse;
