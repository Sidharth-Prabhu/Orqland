import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req || !req.method) {
      return next.handle();
    }

    const { method, url } = req;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const elapsed = Date.now() - now;
          this.logger.log(`${method} ${url} completed in ${elapsed}ms`);
        },
        error: (err) => {
          const elapsed = Date.now() - now;
          this.logger.warn(`${method} ${url} failed after ${elapsed}ms: ${err?.message || err}`);
        },
      })
    );
  }
}
