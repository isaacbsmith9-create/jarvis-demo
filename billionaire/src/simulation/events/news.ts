import type { GameState, NewsCategory, NewsItem } from '../../types/core';

export const NEWS_LIMIT = 400;

export function addNews(
  state: GameState,
  category: NewsCategory,
  tone: NewsItem['tone'],
  headline: string,
  body: string,
  refs?: NewsItem['refs'],
): NewsItem {
  const item: NewsItem = { id: state.nextNewsId++, day: state.day, category, tone, headline, body, refs };
  state.news.unshift(item);
  if (state.news.length > NEWS_LIMIT) state.news.length = NEWS_LIMIT;
  return item;
}
