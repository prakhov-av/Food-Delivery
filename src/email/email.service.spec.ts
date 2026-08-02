import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

import { EmailService } from './email.service';
import { ConfirmationCodesService } from '../confirmation-codes/confirmation-codes.service';
import { User } from '../users/user.entity';

describe('EmailService', () => {
  let service: EmailService;

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  const mockConfirmationCodesService = {
    generateConfirmationCode: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: MailerService,
          useValue: mockMailerService,
        },
        {
          provide: ConfirmationCodesService,
          useValue: mockConfirmationCodesService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);

    mockConfirmationCodesService.generateConfirmationCode.mockResolvedValue(
      'test-code',
    );

    mockConfigService.getOrThrow.mockImplementation((key: string) => {
      switch (key) {
        case 'SERVER_HOST':
          return 'localhost';
        case 'SERVER_PORT':
          return '3000';
      }
    });

    mockMailerService.sendMail.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate confirmation code', async () => {
    const user = {
      email: 'test@test.com',
    } as User;

    await service.sendConfirmationEmail(user);

    expect(
      mockConfirmationCodesService.generateConfirmationCode,
    ).toHaveBeenCalledTimes(1);

    expect(
      mockConfirmationCodesService.generateConfirmationCode,
    ).toHaveBeenCalledWith(user);
  });

  it('should send email to correct recipient', async () => {
    const user = {
      email: 'test@test.com',
    } as User;

    await service.sendConfirmationEmail(user);

    expect(mockMailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@test.com',
        subject: 'Confirm your registration',
      }),
    );
  });

  it('should send confirmation link containing generated code', async () => {
    const user = {
      email: 'test@test.com',
    } as User;

    await service.sendConfirmationEmail(user);

    expect(mockMailerService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          'http://localhost:3000/users/confirm/test-code',
        ),
      }),
    );
  });
});
