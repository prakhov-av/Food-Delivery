import { CleanService } from './clean.service';

describe('CleanService', (): void => {
  let service: CleanService;

  beforeEach((): void => {
    service = new CleanService();
  });

  it('should normalize line endings, collapse spaces and remove document markers', (): void => {
    const input: string =
      'First  line\r\n' +
      'europrotect insurance\n' +
      '© europrotect insurance\n' +
      '-- 1 of 10 --\n' +
      'страница 2\n' +
      '— page 3 —\n' +
      '──────\n' +
      'Second   line';

    expect(service.cleanTexts([input])).toEqual([
      'First line\n\nSecond line',
    ]);
  });

  it('should preserve meaningful text while collapsing excessive empty lines', (): void => {
    const input: string = 'First\n\n\n\nSecond\n\n\nThird';

    expect(service.cleanTexts([input])).toEqual(['First\n\nSecond\n\nThird']);
  });

  it('should clean every text independently', (): void => {
    const input: string[] = [
      'Page  one',
      'europrotect insurance\r\nContent',
      'Content\n\n\nMore',
    ];

    expect(service.cleanTexts(input)).toEqual([
      'Page one',
      '\nContent',
      'Content\n\nMore',
    ]);
  });

  it('should return an empty array for empty input', (): void => {
    expect(service.cleanTexts([])).toEqual([]);
  });
});
