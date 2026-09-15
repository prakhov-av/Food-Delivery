import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { MenuItemsModule } from './menu-items/menu-items.module';
import { OrdersModule } from './orders/orders.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenusModule } from './menus/menus.module';
import { OrderItemsModule } from './order-items/order-items.module';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth/guards/auth.guard';
import { AuthModule } from './auth/auth.module';
import { RolesGuard } from './auth/guards/roles.guard';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from './email/email.module';
import { ConfirmationCodesModule } from './confirmation-codes/confirmation-codes.module';
// import { typeOrmConfig } from './database/typeorm.config';
import { AiModule } from './ai/ai.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { VectorStorageModule } from './vector-storage/vector-storage.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { ChatModule } from './chat/chat.module';
import { PromptsModule } from './prompts/prompts.module';

@Module({
  imports: [
    UsersModule,
    RestaurantsModule,
    MenuItemsModule,
    OrdersModule,
    OrderItemsModule,
    MenusModule,
    AuthModule,
    ConfirmationCodesModule,
    EmailModule,
    AiModule,
    EmbeddingsModule,
    VectorStorageModule,
    IngestionModule,
    ChatModule,
    PromptsModule,
    // TypeOrmModule.forRoot(typeOrmConfig),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'qwerty123',
      database: 'food_delivery',
      autoLoadEntities: true,
      synchronize: true,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
