import { OrderDto } from '../dto/order.dto';

export class OrderItemLine {
  name: string;
  quantity: number;
}

export class OrderWithItems {
  order: OrderDto;
  items: OrderItemLine[];
}
