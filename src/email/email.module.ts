import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConfirmationCodesModule } from '../confirmation-codes/confirmation-codes.module';

@Module({
  providers: [EmailService],
  imports: [
    ConfigModule,
    ConfirmationCodesModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.getOrThrow('SMTP_HOST'),
          port: configService.getOrThrow('SMTP_PORT'),
          secure: false,
          auth: {
            user: configService.getOrThrow('SMTP_USER'),
            pass: configService.getOrThrow('SMTP_PASS'),
          },
          tls: {
            rejectUnauthorized: false,
          },
        },
        defaults: {
          from: '"Food Delivery Service" <prakhov.test@gmail.com>',
        },
      }),
    }),
  ],
  exports: [EmailService],
})
export class EmailModule {}
