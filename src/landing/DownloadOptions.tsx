import { useEffect, useState, type Ref } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';

const RELEASES_API = 'https://api.github.com/repos/Daniel-Shunom/Tavi/releases/latest';
const RELEASES_PAGE = 'https://github.com/Daniel-Shunom/Tavi/releases';

type ReleaseAsset = { name: string; browser_download_url: string };
type Release = { assets?: ReleaseAsset[] };

export function DownloadOptions({ buttonRef }: { buttonRef: Ref<HTMLAnchorElement> }) {
  const [windows, setWindows] = useState<boolean | null>(null);
  const [installer, setInstaller] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setWindows(/windows/i.test(navigator.userAgent));
    const controller = new AbortController();
    void fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
      .then(async (response) => (response.ok ? (response.json() as Promise<Release>) : null))
      .then((release) => {
        const asset = release?.assets?.find((entry) => /x64-setup\.exe$/i.test(entry.name));
        if (asset) setInstaller(asset.browser_download_url);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setChecked(true);
      });
    return () => controller.abort();
  }, []);

  if (windows) {
    return installer ? (
      <>
        <p className="download-status">Windows 10 or 11 · 64 bit</p>
        <a className="button-primary closing-button" href={installer} ref={buttonRef}>
          Download for Windows <ArrowDown size={16} />
        </a>
        <a className="download-web-link" href="/studio">
          Or open Studio in your browser <ArrowUpRight size={14} />
        </a>
      </>
    ) : (
      <>
        <p className="download-status">
          {checked ? 'The Windows installer is coming soon.' : 'Checking for the latest installer…'}
        </p>
        <a className="button-primary closing-button" href="/studio" ref={buttonRef}>
          Use Tavi in your browser <ArrowUpRight size={16} />
        </a>
        <a className="download-web-link" href={RELEASES_PAGE}>
          Check Windows releases <ArrowUpRight size={14} />
        </a>
      </>
    );
  }

  return (
    <>
      <p className="download-status">
        {windows === null
          ? 'Windows and browser options.'
          : 'The macOS app is coming soon. Tavi works in your browser today.'}
      </p>
      <a className="button-primary closing-button" href="/studio" ref={buttonRef}>
        Open Studio in your browser <ArrowUpRight size={16} />
      </a>
      <a className="download-web-link" href={RELEASES_PAGE}>
        All releases <ArrowUpRight size={14} />
      </a>
    </>
  );
}
