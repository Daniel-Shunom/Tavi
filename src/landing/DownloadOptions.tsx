import { hostedPreview, studioEntryHref } from './links';
import { useEffect, useState, type Ref } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';

const RELEASES_API = 'https://api.github.com/repos/Daniel-Shunom/Tavi/releases/latest';
const RELEASES_PAGE = 'https://github.com/Daniel-Shunom/Tavi/releases';
type Platform = 'windows' | 'macos' | 'linux';
type ReleaseAsset = { name: string; browser_download_url: string };
type Release = { assets?: ReleaseAsset[] };
const platforms: { id: Platform; label: string; logo: string }[] = [
  { id: 'windows', label: 'Windows', logo: '/media/platforms/windows.svg' },
  { id: 'macos', label: 'macOS', logo: '/media/platforms/apple.svg' },
  { id: 'linux', label: 'Linux', logo: '/media/platforms/linux.svg' },
];

export function DownloadOptions({ buttonRef }: { buttonRef: Ref<HTMLAnchorElement> }) {
  const [platform, setPlatform] = useState<Platform>('windows');
  const [assets, setAssets] = useState<ReleaseAsset[]>([]);
  const [lookup, setLookup] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    const agent = navigator.userAgent;
    setPlatform(
      /windows/i.test(agent)
        ? 'windows'
        : /macintosh/i.test(agent)
          ? 'macos'
          : /linux/i.test(agent) && !/android/i.test(agent)
            ? 'linux'
            : 'windows',
    );
    const controller = new AbortController();
    void fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Release lookup failed');
        return response.json() as Promise<Release>;
      })
      .then((release) => {
        if (controller.signal.aborted) return;
        setAssets(release?.assets ?? []);
        setLookup('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setLookup('error');
      });
    return () => {
      controller.abort();
    };
  }, []);

  const windows = assets.find((entry) => /x64-setup\.exe$/i.test(entry.name));
  const apple = assets.find((entry) => /_(?:aarch64|arm64)\.dmg$/i.test(entry.name));
  const intel = assets.find((entry) => /_(?:x64|x86_64)\.dmg$/i.test(entry.name));
  const deb = assets.find((entry) => /_(?:amd64|x86_64|x64)\.deb$/i.test(entry.name));
  const image = assets.find((entry) => /_(?:amd64|x86_64|x64)\.AppImage$/i.test(entry.name));
  const choices =
    platform === 'windows'
      ? [{ asset: windows, label: 'Download for Windows' }]
      : platform === 'macos'
        ? [
            { asset: apple, label: 'Download for Apple Silicon' },
            { asset: intel, label: 'Download for Intel Mac' },
          ]
        : [
            { asset: deb, label: 'Download .deb' },
            { asset: image, label: 'Download AppImage' },
          ];
  const available = choices.filter((choice): choice is { asset: ReleaseAsset; label: string } =>
    Boolean(choice.asset),
  );
  const label = platforms.find((entry) => entry.id === platform)?.label ?? 'Windows';
  const previewLabel = hostedPreview ? 'Try the browser preview' : 'Open Studio in your browser';
  const status =
    lookup === 'loading'
      ? 'Checking for the latest installer…'
      : lookup === 'error'
        ? 'Could not check installers. View releases below.'
        : available.length
          ? platform === 'windows'
            ? 'Windows 10 or 11 · 64 bit'
            : platform === 'macos'
              ? 'macOS 13.5+ · Choose your chip'
              : 'Linux · 64 bit'
          : `${label} installers are coming soon.`;

  return (
    <>
      <div className="download-platforms" role="tablist" aria-label="Download platform">
        {platforms.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`download-tab-${entry.id}`}
            data-platform={entry.id}
            aria-controls="download-platform-panel"
            aria-selected={platform === entry.id}
            tabIndex={platform === entry.id ? 0 : -1}
            onClick={() => {
              setPlatform(entry.id);
            }}
            onKeyDown={(event) => {
              const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
              const nextIndex =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? platforms.length - 1
                    : step
                      ? (index + step + platforms.length) % platforms.length
                      : -1;
              const next = platforms[nextIndex];
              if (!next) return;
              event.preventDefault();
              setPlatform(next.id);
              event.currentTarget.parentElement
                ?.querySelector<HTMLButtonElement>(`[data-platform="${next.id}"]`)
                ?.focus();
            }}
          >
            <img src={entry.logo} alt="" width="18" height="18" />
            {entry.label}
          </button>
        ))}
      </div>
      <div
        id="download-platform-panel"
        role="tabpanel"
        aria-labelledby={`download-tab-${platform}`}
      >
        <p className="download-status" aria-live="polite">
          {status}
        </p>
        {available.length ? (
          <>
            {available.map((choice, index) => (
              <a
                key={choice.label}
                className={index === 0 ? 'button-primary closing-button' : 'download-native-link'}
                href={choice.asset.browser_download_url}
                ref={index === 0 ? buttonRef : undefined}
              >
                {choice.label} <ArrowDown size={index === 0 ? 16 : 14} />
              </a>
            ))}
            <a className="download-web-link" href={studioEntryHref}>
              {previewLabel} <ArrowUpRight size={14} />
            </a>
          </>
        ) : (
          <>
            <a
              className="button-primary closing-button"
              href={lookup === 'error' ? RELEASES_PAGE : studioEntryHref}
              ref={buttonRef}
            >
              {lookup === 'error' ? 'View releases' : previewLabel} <ArrowUpRight size={16} />
            </a>
            <a
              className="download-web-link"
              href={lookup === 'error' ? studioEntryHref : RELEASES_PAGE}
            >
              {lookup === 'error' ? previewLabel : 'All releases'} <ArrowUpRight size={14} />
            </a>
          </>
        )}
      </div>
    </>
  );
}
