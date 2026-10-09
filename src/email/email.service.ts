import { Injectable } from '@nestjs/common';
import { User } from '../users/user.entity';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfirmationCodesService } from '../confirmation-codes/confirmation-codes.service';
import { ConfigService } from '@nestjs/config';

/**
   * Отправляет электронные письма, используемые прикладными сценариями, в частности для подтверждения регистрации.
   */
@Injectable()
export class EmailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly confirmationCodesService: ConfirmationCodesService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Выполняет соответствующую операцию прикладного сценария с использованием зависимостей компонента.
   */
  async sendConfirmationEmail(user: User): Promise<void> {
    const codeValue: string =
      await this.confirmationCodesService.generateConfirmationCode(user);

    const link: string = this.buildConfirmationLink(codeValue);

    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Confirm your registration',
      text: `To confirm your registration click the link - ${link}`,
    });
  }

  private buildConfirmationLink(codeValue: string): string {
    const host: string = this.configService.getOrThrow('SERVER_HOST');
    const port: string = this.configService.getOrThrow('SERVER_PORT');
    const nodeEnv: string = this.configService.get('NODE_ENV') ?? 'development';

    if (nodeEnv === 'production') {
      return `https://${host}/users/confirm/${codeValue}`;
    }

    return `http://${host}:${port}/users/confirm/${codeValue}`;
  }
}
