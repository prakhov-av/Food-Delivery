import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;
  const service = { generateResponse: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ChatController(service as unknown as ChatService);
  });

  it('should delegate the message, user id and role to ChatService', async () => {
    service.generateResponse.mockResolvedValue('answer');
    const request = { user: { id: 42, role: 'CUSTOMER' } } as any;
    const dto = { message: 'What is my order status?' } as any;

    await expect(controller.askAi(dto, request)).resolves.toBe('answer');
    expect(service.generateResponse).toHaveBeenCalledWith(
      'What is my order status?',
      42,
      'CUSTOMER',
    );
  });
});
