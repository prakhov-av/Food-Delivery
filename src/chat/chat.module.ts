import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { VectorStorageModule } from '../vector-storage/vector-storage.module';
import { AiModule } from '../ai/ai.module';
import { LiveDataService } from './live-data.service';
import { OrdersModule } from '../orders/orders.module';
import { ContextService } from './context.service';
import { PromptsModule } from '../prompts/prompts.module';
import { ChatLog } from './chat-log.entity';
import { ChatLogService } from './chat-log.service';
import { ChatIdentityGuard } from './chat-identity.guard';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { GuestSessionsModule } from '../guest-sessions/guest-sessions.module';
import { LanguageService } from './language/language.service';
import { LeakGuardService } from './leak-guard.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, LiveDataService, ContextService, ChatLogService, ChatIdentityGuard, LanguageService, LeakGuardService],
  imports: [
    TypeOrmModule.forFeature([ChatLog]),
    EmbeddingsModule, VectorStorageModule, AiModule, OrdersModule, PromptsModule,
    AuthModule, UsersModule, GuestSessionsModule,
  ],
})
export class ChatModule {}
