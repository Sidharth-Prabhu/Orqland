import { Module, Global } from '@nestjs/common';
import { FirebaseAdminService } from './firebase-admin.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { WsAuthGuard } from '../../common/guards/ws-auth.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [FirebaseAdminService, AuthService, FirebaseAuthGuard, WsAuthGuard],
  exports: [FirebaseAdminService, AuthService, FirebaseAuthGuard, WsAuthGuard],
})
export class AuthModule {}
