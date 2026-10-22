import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function CreatorShell() {
  return (
    <main>
      <header><a className="wordmark" href="./" aria-label="PCAG Creator home">PCAG<span>Creator</span></a><span className="badge">Early development</span></header>
      <section aria-labelledby="welcome-title">
        <p className="eyebrow">Point-and-click adventure creator</p>
        <h1 id="welcome-title">Every adventure<br />starts somewhere.</h1>
        <p className="intro">A place to build rooms, tell stories, and bring your own adventure to life.</p>
        <div className="notice">
          <span className="marker" aria-hidden="true">01</span>
          <div><h2>The workspace is taking shape</h2><p>Room editing and playtesting are coming in the next stages. There is no project to edit yet.</p></div>
        </div>
      </section>
      <footer><span>PCAG / Creator</span><span>Your story begins here.</span></footer>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Creator root element is missing.');
createRoot(root).render(<StrictMode><CreatorShell /></StrictMode>);
