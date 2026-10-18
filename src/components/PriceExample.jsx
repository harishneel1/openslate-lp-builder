// ------------------------------------------------------------
// The "On your page" price line: the regular price crossed out, the
// discounted price, and the % off. Shared by the webinar price screen
// and the 1:1 call details, so both show prices the same way.
// Styles: QuestionInput.css (.qinput__price-example).
// ------------------------------------------------------------

// How their price will look on the page, using their own numbers.
// The regular price only shows crossed out when it's higher.
export default function PriceExample({ price, oldPrice }) {
  const p = Number(price) || 0;
  const o = Number(oldPrice) || 0;
  if (p <= 0) return null;

  const money = (n) => `₹${n.toLocaleString('en-IN')}`;
  const showOld = o > p;
  const percentOff = showOld ? Math.round((1 - p / o) * 100) : 0;

  return (
    <div className="qinput__price-example">
      <span className="qinput__price-example-label">On your page</span>
      <p className="qinput__price-example-line">
        {showOld && <s className="qinput__price-example-old">{money(o)}</s>}
        <strong className="qinput__price-example-new">{money(p)}</strong>
        {showOld && <span className="qinput__price-example-off">{percentOff}% off</span>}
      </p>
    </div>
  );
}