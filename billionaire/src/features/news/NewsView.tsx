import { useState } from 'react';
import { store, useGame } from '../../app/store';
import { Panel } from '../../components/ui';
import type { NewsCategory, NewsItem } from '../../types/core';
import { formatShortDate } from '../../utils/date';

const CAT: Record<NewsCategory, string> = {
  business: 'Business',
  finance: 'Finance',
  property: 'Property',
  company: 'Your companies',
  competitor: 'Competitors',
  economy: 'Economy',
  staff: 'Staff',
  underworld: 'Underworld',
  objective: 'Objective',
};

export function NewsList({ items }: { items: NewsItem[] }) {
  if (!items.length) return <div className="empty small">No news yet.</div>;
  const open = (n: NewsItem) => {
    if (n.refs?.companyId && store.state?.companies[n.refs.companyId]?.status !== 'closed') store.openCompany(n.refs.companyId);
    else if (n.refs?.propertyId) store.openProperty(n.refs.propertyId, true);
    else if (n.refs?.rivalId) {
      store.select({ rivalId: n.refs.rivalId });
      store.setView('market');
    }
  };
  return (
    <div data-testid="news-list">
      {items.map((n) => {
        const linked = !!(n.refs?.companyId || n.refs?.propertyId || n.refs?.rivalId);
        return (
          <div key={n.id} className={`news-item ${linked ? 'click' : ''}`} onClick={linked ? () => open(n) : undefined}>
            <div className="when">
              <div>{formatShortDate(n.day)}</div>
              <div className={`tiny ${n.tone === 'positive' ? 'pos' : n.tone === 'negative' ? 'neg' : 'dim'}`} style={{ marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {CAT[n.category]}
              </div>
            </div>
            <div>
              <h4>{n.headline}</h4>
              <p>{n.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function NewsView() {
  const st = useGame();
  const [cat, setCat] = useState<NewsCategory | 'all'>('all');
  const items = st.news.filter((n) => cat === 'all' || n.category === cat);
  const present = [...new Set(st.news.map((n) => n.category))];
  return (
    <div className="page" data-testid="news-view">
      <div className="page-h">
        <div>
          <div className="eyebrow">The Miami Ledger</div>
          <h1>News</h1>
        </div>
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        <button className={`btn sm ${cat === 'all' ? 'outline' : 'ghost'}`} onClick={() => setCat('all')}>
          All
        </button>
        {(Object.keys(CAT) as NewsCategory[])
          .filter((c) => present.includes(c))
          .map((c) => (
            <button key={c} className={`btn sm ${cat === c ? 'outline' : 'ghost'}`} onClick={() => setCat(c)}>
              {CAT[c]}
            </button>
          ))}
      </div>
      <Panel tight>
        <NewsList items={items.slice(0, 150)} />
      </Panel>
    </div>
  );
}
