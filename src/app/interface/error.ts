export type TErrorDetails = {
  issues: {
    path: PropertyKey;
    message: string;
  }[];
};

export type TGenericErrorResponse = {
  statusCode: number;
  message: string;
  errorDetails: TErrorDetails;
};
