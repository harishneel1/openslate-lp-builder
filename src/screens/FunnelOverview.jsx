import { Fragment } from 'react';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import './FunnelOverview.css';

function PageSketch({ type }) {
  return (
    <div className="sketch">
      {type === 'landing' && (
        <>
          <div className="sketch__hero" />
          <div className="sketch__line" />
          <div className="sketch__line sketch__line--short" />
          <div className="sketch__button" />
        </>
      )}
      {type === 'registration' && (
        <>
          <div className="sketch__line sketch__line--short" />
          <div className="sketch__field" />
          <div className="sketch__field" />
          <div className="sketch__button" />
        </>
      )}
      {type === 'thank-you' && (
        <>
          <div className="sketch__check" />
          <div className="sketch__line" />
          <div className="sketch__line sketch__line--short" />
        </>
      )}
    </div>
  );
}

export default function FunnelOverview({ funnel, onBack, onStart }) {
  const { pages } = funnel;

  return (
    <div className="overview">
      <button type="button" className="overview__back" onClick={onBack}>
        <ArrowLeft size={16} /> All funnels
      </button>

      <h1 className="overview__title">Your funnel has {pages.length} pages</h1>
      <p className="overview__subtitle">
        Your customers go through them in this order. We'll fill them in together, one page at a time.
      </p>
      <p className="overview__meta">
        <Clock size={16} /> About 10 minutes. You can change anything later.
      </p>

      <div className="overview__flow">
        {pages.map((page, i) => (
          <Fragment key={page.id}>
            {i > 0 && <ArrowRight size={20} className="overview__arrow" />}
            <div className="overview__page">
              <PageSketch type={page.id} />
              <div className="overview__page-body">
                <span className="overview__step">Page {i + 1}</span>
                <h3 className="overview__page-name">{page.name}</h3>
                <p className="overview__page-job">{page.job}</p>
              </div>
            </div>
          </Fragment>
        ))}
      </div>

      <button type="button" className="overview__start" onClick={onStart}>
        Start with your {pages[0].name.toLowerCase()} <ArrowRight size={18} />
      </button>
    </div>
  );
}