import { Injectable } from '@nestjs/common';
import { DocumentType } from '../ingestion/enums/document-type.enum';
import { LiveDataResource } from './enums/live-data-resource.enum';

@Injectable()
export class PromptService {
  createPromptForUserRequest(chunks: string[], request: string): string {
    return `Сгенерируй ответ, основываясь только на предоставленном контексте.
Дай только ответ, не упоминай в ответе контекст.

Контекст:

${chunks.join('\n\n')}

Конец контекста.

Вопрос:
${request}`;
  }

  createPromptForDocumentType(request: string): string {
    return `Определи тип запроса пользователя.

Верни только JSON-объект строго в формате:
{"documentType":"TYPE","liveDataRequired":false}

Если liveDataRequired=true, обязательно укажи resource и resourceId:
{"documentType":"TYPE","liveDataRequired":true,"resource":"RESOURCE","resourceId":123}

Допустимые значения documentType:
${Object.values(DocumentType).join(' | ')}

Поддерживаемые live-data resources:
${Object.values(LiveDataResource).join(' | ')}

Правила resource:
- ${LiveDataResource.ORDER} - конкретный заказ пользователя.
- resource можно указывать только при liveDataRequired=true.
- Если liveDataRequired=false, resource и resourceId не добавляй.

Правила resourceId:
- Указывай положительный числовой ID только если он явно указан в вопросе.
- resourceId можно указывать только вместе с resource.
- Не придумывай ID.

Правила documentType:
AUTH - регистрация, подтверждение аккаунта и авторизация
USER - профиль пользователя и возможности пользователя
RESTAURANT - рестораны и информация о ресторанах
MENU - меню, блюда и категории меню
DELIVERY - доставка и работа курьера
ORDER - оформление заказа, состав заказа и правила работы с заказами
SYSTEM - общие правила и возможности системы

Правила liveDataRequired:
false - если на вопрос можно ответить по статической информационной базе правил и инструкций системы.
true - если для корректного ответа нужны актуальные данные текущего состояния системы.

Для live-запроса о конкретном заказе используй resource="ORDER" и его явно указанный ID.

Примеры liveDataRequired=true:
- "Где сейчас мой заказ 123?"
- "Какой статус заказа 123?"
- "Какой курьер везёт заказ 123?"

Примеры liveDataRequired=false:
- "Как оформить заказ?"
- "Какие статусы бывают у заказа?"
- "Как работает доставка?"
- "Как зарегистрироваться?"

Не добавляй markdown, пояснения или дополнительные поля.
Верни только один JSON-объект.

Вопрос:
${request}`;
  }
}
