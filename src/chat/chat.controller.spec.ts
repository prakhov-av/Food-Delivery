import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { Role } from '../users/enums/role.enum';

describe('ChatController', () => {
  let controller: ChatController;
  const service = { generateResponseForIdentity: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ChatController(service as unknown as ChatService);
  });

  it('delegates a registered user identity to ChatService', async () => {
    service.generateResponseForIdentity.mockResolvedValue('answer');
    const request = {
      chatIdentity: { kind: 'user', userId: 42, role: Role.CUSTOMER },
    } as any;
    const dto = { message: 'What is my order status?' } as any;

    await expect(controller.askAi(dto, request)).resolves.toBe('answer');
    expect(service.generateResponseForIdentity).toHaveBeenCalledWith(
      'What is my order status?',
      request.chatIdentity,
    );
  });

  it('delegates a guest identity to ChatService', async () => {
    service.generateResponseForIdentity.mockResolvedValue('answer');
    const identity = { kind: 'guest', guestSessionId: 'guest-session-id', role: Role.CUSTOMER };
    const request = { chatIdentity: identity } as any;
    const dto = { message: 'Какие у меня заказы?' } as any;

    await expect(controller.askAi(dto, request)).resolves.toBe('answer');
    expect(service.generateResponseForIdentity).toHaveBeenCalledWith(
      dto.message,
      identity,
    );
  });
});
