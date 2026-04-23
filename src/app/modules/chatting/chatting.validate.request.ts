import { ZodError, ZodType } from 'zod';

export const chattingRequestValidation = async <T>(
  schema: ZodType<{ body: T }>,
  data: unknown,
  sendError: (ws: any, message: string) => void,
  ws: any,
): Promise<T | null> => {
  try {
    const eventParsed = await schema.parseAsync({
      body: data,
    });

    console.log({ eventParsed });

    return eventParsed.body;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      sendError(
        ws,
        (error.flatten() as any).fieldErrors.body?.join(', ') ||
          'Invalid event structure',
      );
    }
    return null;
  }
};
