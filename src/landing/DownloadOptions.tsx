import { hostedPreview, studioEntryHref } from './links';
import { useEffect, useState, type Ref } from 'react';
import { ArrowDown, ArrowUpRight } from 'lucide-react';

const RELEASES_API = 'https://api.github.com/repos/Daniel-Shunom/Tavi/releases/latest';
const RELEASES_PAGE = 'https://github.com/Daniel-Shunom/Tavi/releases';
const CHECKING_INSTALLERS = 'Checking for the latest installer…';
const LOOKUP_ERROR = 'Could not check installers. View releases below.';
type Platform = 'windows' | 'macos' | 'linux';
type ReleaseAsset = { name: string; browser_download_url: string };
type Release = { assets?: ReleaseAsset[] };
const platforms: { id: Platform; label: string; logo: string }[] = [
  { id: 'windows', label: 'Windows', logo: '/media/platforms/windows.svg' },
  { id: 'macos', label: 'macOS', logo: '/media/platforms/apple.svg' },
  { id: 'linux', label: 'Linux', logo: '/media/platforms/linux.svg' },
];

export function DownloadOptions({ buttonRef }: { buttonRef: Ref<HTMLAnchorElement> }) {
  const [platform, setPlatform] = useState<Platform>(() => {
    if (typeof navigator === 'undefined') return 'windows';
    const agent = navigator.userAgent;
    return /macintosh/i.test(agent)
      ? 'macos'
      : /linux/i.test(agent) && !/android/i.test(agent)
        ? 'linux'
        : 'windows';
  });
  const [keyboardSwitch, setKeyboardSwitch] = useState(false);
  const [assets, setAssets] = useState<ReleaseAsset[]>([]);
  const [lookup, setLookup] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
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
  const choices = {
    windows: [{ asset: windows, label: 'Download for Windows' }],
    macos: [
      { asset: apple, label: 'Download for Apple Silicon' },
      { asset: intel, label: 'Download for Intel Mac' },
    ],
    linux: [
      { asset: deb, label: 'Download .deb' },
      { asset: image, label: 'Download AppImage' },
    ],
  };
  const previewLabel = hostedPreview ? 'Try the browser preview' : 'Open Studio in your browser';
  const statusFor = (id: Platform, available: boolean, label: string) =>
    lookup === 'loading'
      ? CHECKING_INSTALLERS
      : lookup === 'error'
        ? LOOKUP_ERROR
        : available
          ? id === 'windows'
            ? 'Windows 10 or 11 · 64 bit'
            : id === 'macos'
              ? 'macOS 13.5+ · Choose your chip'
              : 'Linux · 64 bit'
          : `${label} installers are coming soon.`;

  return (
    <>
      <div
        className="download-platforms"
        role="tablist"
        aria-label="Download platform"
        data-keyboard-switch={keyboardSwitch}
      >
        {platforms.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`download-tab-${entry.id}`}
            data-platform={entry.id}
            aria-controls={`download-panel-${entry.id}`}
            aria-selected={platform === entry.id}
            tabIndex={platform === entry.id ? 0 : -1}
            onClick={() => {
              setKeyboardSwitch(false);
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
              setKeyboardSwitch(true);
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
      <div className="download-panels" data-ready={lookup !== 'loading'}>
        {platforms.map((entry) => {
          const selected = entry.id === platform;
          const available = choices[entry.id].filter(
            (choice): choice is { asset: ReleaseAsset; label: string } => Boolean(choice.asset),
          );
          const primary = available[0];
          const secondary = available[1];
          const loading = lookup === 'loading';
          return (
            <div
              key={entry.id}
              id={`download-panel-${entry.id}`}
              role="tabpanel"
              aria-labelledby={`download-tab-${entry.id}`}
              aria-hidden={!selected}
              inert={!selected}
            >
              <p className="download-status" aria-live={selected ? 'polite' : 'off'}>
                <span>{statusFor(entry.id, available.length > 0, entry.label)}</span>
                <span className="download-size" aria-hidden="true">
                  {LOOKUP_ERROR}
                </span>
                <span
                  className="download-size"
                  aria-hidden="true"
                >{`${entry.label} installers are coming soon.`}</span>
              </p>
              <a
                className="button-primary closing-button"
                href={loading ? undefined : (primary?.asset.browser_download_url ?? RELEASES_PAGE)}
                ref={selected ? buttonRef : undefined}
                aria-disabled={loading}
                inert={loading}
              >
                <span className="download-button-label">
                  <span>
                    {primary?.label ?? (loading ? 'Checking installers…' : 'View releases')}
                  </span>
                  {choices[entry.id].map((choice) => (
                    <span key={choice.label} className="download-size" aria-hidden="true">
                      {choice.label}
                    </span>
                  ))}
                  <span className="download-size" aria-hidden="true">
                    View releases
                  </span>
                  <span className="download-size" aria-hidden="true">
                    Checking installers…
                  </span>
                </span>
                {primary || loading ? <ArrowDown size={16} /> : <ArrowUpRight size={16} />}
              </a>
              <a
                className="download-native-link"
                href={secondary?.asset.browser_download_url}
                aria-hidden={!secondary}
                inert={!secondary}
                data-available={Boolean(secondary)}
              >
                {secondary?.label ?? choices[entry.id][1]?.label ?? 'Download for Intel Mac'}{' '}
                <ArrowDown size={14} />
              </a>
              <a
                className="download-web-link download-preview-link"
                href={studioEntryHref}
                aria-hidden={loading}
                inert={loading}
              >
                {previewLabel} <ArrowUpRight size={14} />
              </a>
            </div>
          );
        })}
      </div>
    </>
  );
}
