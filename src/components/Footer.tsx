const REPO_URL = 'https://github.com/saburto/hetdedutchapp';

/** Format an ISO build date ('2026-10-30') as Dutch '30-10-2026'. */
function formatBuildDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [year, month, day] = parts;
  return `${day}-${month}-${year}`;
}

function Footer() {
  const isRelease = __GIT_SHA__ !== 'dev';

  return (
    <footer className="app-footer">
      <div className="footer-row">
        <a href="https://saburto.com" target="_blank" rel="noopener noreferrer">
          saburto.com
        </a>
        <span className="footer-sep">·</span>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        <span className="footer-sep">·</span>
        {isRelease ? (
          <a
            className="footer-version"
            href={`${REPO_URL}/commit/${__GIT_SHA__}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`v${__APP_VERSION__} · Git-versie waaruit deze build is gemaakt`}
          >
            versie {__GIT_SHA__}
          </a>
        ) : (
          <span className="footer-version" title="Geen git-repository gevonden">
            versie dev
          </span>
        )}
        <span className="footer-sep">·</span>
        <span className="footer-build" title={`Build van ${__BUILD_DATE__}`}>
          {formatBuildDate(__BUILD_DATE__)}
        </span>
      </div>
      <p className="footer-ai">
        <span aria-hidden="true">✦</span> Deze app is met behulp van AI gemaakt
      </p>
    </footer>
  );
}

export default Footer;
