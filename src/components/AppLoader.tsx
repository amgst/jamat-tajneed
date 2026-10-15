export default function AppLoader() {
  return <main className="tajneed-startup" role="status" aria-live="polite" aria-label="Loading Tajneed">
    <div className="tajneed-startup-mark" aria-hidden="true">T</div>
    <div className="tajneed-startup-wordmark" aria-hidden="true">Taj<span>need</span><i /></div>
    <div className="tajneed-startup-location">Muridke</div>
    <div className="tajneed-startup-track" aria-hidden="true" />
    <p className="tajneed-startup-message">Getting Tajneed ready…</p>
    <span className="tajneed-startup-note">Your community, connected.</span>
  </main>;
}
