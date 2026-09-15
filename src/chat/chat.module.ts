import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { VectorStorageModule } from '../vector-storage/vector-storage.module';
import { AiModule } from '../ai/ai.module';
import { PromptService } from '../prompts/prompt.service';
import { LiveDataService } from './live-data.service';
import { OrdersModule } from '../orders/orders.module';
import { ContextService } from './context.service';
import { PromptsModule } from '../prompts/prompts.module';

@Module({
  controllers: [ChatController],
  providers: [ChatService, PromptService, LiveDataService, ContextService],
  imports: [
    EmbeddingsModule,
    VectorStorageModule,
    AiModule,
    OrdersModule,
    PromptsModule,
  ],
})
export class ChatModule {}
