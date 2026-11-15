import { AlignLeft, Cloud, FileText, Link2, MonitorPlay, PlayCircle } from 'lucide-react';

// ------------------------------------------------------------
// What a lesson can have (data/courses.js, a lesson's content), and how
// each looks: its name, its icon (before the lesson's name in the list),
// and its tile's colour (CoursesPage.css, .cct__tile--<kind>), the same
// colours as Cloud Storage's: video orange, documents blue.
// ------------------------------------------------------------

export const KIND = {
  video: { label: 'Video', icon: PlayCircle },
  pdf: { label: 'PDF', icon: FileText },
  embed: { label: 'Embedded video', icon: MonitorPlay },
  text: { label: 'Text', icon: AlignLeft },
  link: { label: 'Link', icon: Link2 },
  cloud: { label: 'Cloud Storage', icon: Cloud }, // only a tile, never a lesson's kind
};

// A kind's tile, in its colour: big in the picker, small in lists
export function KindTile({ kind, size = 'big' }) {
  const Icon = KIND[kind]?.icon ?? FileText;
  return (
    <span className={`cct__tile cct__tile--${kind} cct__tile--${size}`} aria-hidden="true">
      <Icon size={size === 'big' ? 26 : 16} />
    </span>
  );
}