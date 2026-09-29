import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something went wrong. Please try again later.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as string | { message?: string | string[] };
      const raw = typeof body === 'string' ? body : body.message;
      message = Array.isArray(raw) ? raw.join('; ') : raw ?? exception.message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'A record with these unique values already exists.';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found.';
      } else {
        this.logger.error(exception.message);
      }
    } else {
      // Internal detail is logged, never sent to the client.
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    res.status(status).json({ success: false, message, data: null });
  }
}
