import { SearchFilterMatcher } from './search-filter-matcher';

/**
   * Определяет типизированную структуру «SearchFilterParameter», используемую при обмене данными между компонентами.
   */
export class SearchFilterParameter {
  key: string;
  match: SearchFilterMatcher;
}
