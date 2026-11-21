import { ConfigService } from '@nestjs/config';
import { LanguageService } from './language.service';
import { Lang } from '../locales/lang';

describe('LanguageService', (): void => {
  let service: LanguageService;

  beforeEach((): void => {
    const configService = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;

    service = new LanguageService(configService);
  });

  it('should prefer the language chosen in the interface', (): void => {
    const lang: Lang = service.resolve(Lang.DE, 'Hallo', 'user:1');

    expect(lang).toBe(Lang.DE);
  });

  it('should detect the language of a long message', (): void => {
    const lang: Lang = service.resolve(
      undefined,
      'Ich möchte gerne wissen, wo meine Bestellung gerade ist und wann sie geliefert wird',
      'user:1',
    );

    expect(lang).toBe(Lang.DE);
  });

  it('should keep the language of the session for a short message', (): void => {
    service.resolve(Lang.DE, 'Hallo', 'user:1');

    const lang: Lang = service.resolve(undefined, 'ok', 'user:1');

    expect(lang).toBe(Lang.DE);
  });

  it('should not mix the languages of different sessions', (): void => {
    service.resolve(Lang.DE, 'Hallo', 'user:1');

    const lang: Lang = service.resolve(undefined, 'ok', 'user:2');

    expect(lang).toBe(Lang.RU);
  });

  it('should fall back to the default language for a short first message', (): void => {
    const lang: Lang = service.resolve(undefined, 'ok', 'user:3');

    expect(lang).toBe(Lang.RU);
  });

  it('should forget the session language when the history is cleared', (): void => {
    service.resolve(Lang.DE, 'Hallo', 'user:1');

    service.clearSessionLang('user:1');

    expect(service.getSessionLang('user:1')).toBeUndefined();
    expect(service.resolve(undefined, 'ok', 'user:1')).toBe(Lang.RU);
  });
});
