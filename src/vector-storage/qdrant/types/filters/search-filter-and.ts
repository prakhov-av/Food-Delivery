import { SearchFilterParameter } from './search-filter-parameter';

/**
   * Определяет типизированную структуру «SearchFilterAnd», используемую при обмене данными между компонентами.
   */
export class SearchFilterAnd {
  must: SearchFilterParameter[] = [];
}
