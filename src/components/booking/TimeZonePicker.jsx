import { useMemo } from 'react';
import { Globe } from 'lucide-react';
import { zoneOptions } from '../../data/timeZones';
import './TimeZonePicker.css';

// Which clock the times are shown on: one compact line under the picker's
// title, so it's read before the times are. It's a native select, so on
// phones it opens the system's own list, easier to use than a custom one.
export default function TimeZonePicker({ zone, onChange }) {
  const options = useMemo(() => zoneOptions(zone), [zone]);

  return (
    <div className="tz">
      <Globe size={14} aria-hidden="true" />
      <label className="tz__label" htmlFor="tz-select">
        Times in
      </label>
      <select id="tz-select" className="tz__select" value={zone} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}