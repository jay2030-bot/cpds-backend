import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiResult } from '../dto/api-result';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result) => {
        if (result instanceof ApiResult) {
          return {
            success: true,
            message: result.message,
            data: result.data,
            ...(result.meta ? { meta: result.meta } : {}),
          };
        }
        return { success: true, message: 'Success', data: result ?? null };
      }),
    );
  }
}
