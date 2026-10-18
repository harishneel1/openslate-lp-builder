import './PageNotFound.css';

// A page address (localhost:5173/<handle>) that doesn't belong to anyone
export default function PageNotFound({ handle }) {
  return (
    <main className="pnf">
      <h1 className="pnf__title">This page doesn’t exist</h1>
      <p className="pnf__text">
        There’s no page at /{handle}. Check the link, or ask the person who shared it.
      </p>
    </main>
  );
}