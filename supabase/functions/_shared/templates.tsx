import {
  Body,
  Button,
  Container,
  Column,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
  render,
  toPlainText,
} from 'react-email';
import * as React from 'react';

export interface EmailLinks {
  siteUrl: string;
  unsubscribeUrl: string;
  postalAddress: string;
  assetBaseUrl?: string;
}

type Pose = 'wave' | 'happy' | 'cheer' | 'hmm' | 'smug' | 'hype' | 'lol' | 'ooh';
/** The large picture, then the two small ones under the message. */
type Art = [Pose, Pose, Pose];

const poseAlt: Record<Pose, string> = {
  wave: 'Tavi waving hello',
  happy: 'Tavi smiling',
  cheer: 'Tavi cheering',
  hmm: 'Tavi tilting her head with a curious shrug',
  smug: 'Tavi giving a cheeky, knowing smile',
  hype: 'Tavi bouncing with both hands in the air',
  lol: 'Tavi laughing',
  ooh: 'Tavi looking delighted',
};

// The Studio's type: Fraunces for headings, DM Sans for text. Mail apps that ignore web fonts
// (Gmail among them) fall back to Georgia and the system sans-serif.
const displayFont = "'Fraunces', Georgia, 'Times New Roman', serif";
const textFont = "'DM Sans', system-ui, sans-serif";
const fontsUrl =
  'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600&family=Fraunces:opsz,wght@9..144,400&display=swap';
const small = { color: '#625670', fontSize: '12px', lineHeight: '16px' };

function ListFooter({ links }: { links: EmailLinks }) {
  return (
    <>
      <Text style={small}>A little life in the corner.</Text>
      <Text style={small}>
        You requested Tavi releases and updates.{' '}
        <Link href={links.unsubscribeUrl} style={{ color: '#625670' }}>
          Unsubscribe
        </Link>
      </Text>
      <Text style={small}>{links.postalAddress}</Text>
      <Text style={{ color: '#857a90', fontSize: '10px', lineHeight: '16px' }}>
        Character adapted from{' '}
        <Link
          href="https://rive.app/marketplace/27479-51911-mascot-avatar-customization/"
          style={{ color: '#857a90' }}
        >
          Mascot / Avatar Customization by alisketch
        </Link>
        ,{' '}
        <Link href="https://creativecommons.org/licenses/by/4.0/" style={{ color: '#857a90' }}>
          CC BY 4.0
        </Link>
        . Posed and recolored for Tavi.
      </Text>
    </>
  );
}

function Frame({
  preview,
  links,
  art,
  footer,
  children,
}: {
  preview: string;
  links: EmailLinks;
  /** Left out, the email is a plain letter with no pictures. */
  art?: Art | undefined;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const assets = `${links.assetBaseUrl ?? links.siteUrl}/media/email`;
  return (
    <Html lang="en">
      <Head>
        <link rel="stylesheet" href={fontsUrl} />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: '#f3eff6',
          margin: 0,
          fontFamily: textFont,
          color: '#30203c',
        }}
      >
        <Container
          style={{
            maxWidth: '560px',
            margin: '40px auto',
            backgroundColor: '#ffffff',
            padding: '40px 32px',
            borderRadius: '16px',
          }}
        >
          {art && (
            <>
              <Link href={links.siteUrl} aria-label="Tavi home">
                <Img
                  src={`${assets}/tavi-wordmark.png`}
                  alt="tavi"
                  width="160"
                  height="60"
                  style={{ display: 'block', margin: '0 0 8px' }}
                />
              </Link>
              <Img
                src={`${assets}/tavi-${art[0]}.png`}
                alt={poseAlt[art[0]]}
                width="240"
                height="240"
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  height: 'auto',
                  margin: '0 auto 24px',
                }}
              />
            </>
          )}
          {children}
          {art && (
            <Row style={{ marginTop: '24px' }}>
              <Column align="left" width="50%">
                <Img
                  src={`${assets}/tavi-${art[1]}.png`}
                  alt=""
                  width="104"
                  height="104"
                  style={{ display: 'block' }}
                />
              </Column>
              <Column align="right" width="50%">
                <Img
                  src={`${assets}/tavi-${art[2]}.png`}
                  alt=""
                  width="104"
                  height="104"
                  style={{ display: 'block' }}
                />
              </Column>
            </Row>
          )}
          <Section
            style={{ borderTop: '1px solid #e8e0ee', marginTop: '40px', paddingTop: '24px' }}
          >
            {footer ?? <ListFooter links={links} />}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const heading = {
  fontFamily: displayFont,
  fontSize: '34px',
  lineHeight: '40px',
  fontWeight: 400,
  letterSpacing: '-0.01em',
  margin: '0 0 24px',
};
const paragraph = { fontSize: '16px', lineHeight: '24px', margin: '0 0 24px' };
const button = {
  backgroundColor: '#30203c',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '12px 24px',
  fontSize: '16px',
  fontWeight: 600,
};

export function ConfirmationEmail({
  links,
  confirmationUrl,
}: {
  links: EmailLinks;
  confirmationUrl: string;
}) {
  return (
    <Frame
      preview="One click to confirm your Tavi updates."
      links={links}
      art={['hmm', 'ooh', 'wave']}
    >
      <Heading style={heading}>
        A little news.
        <br />
        Only if you want it.
      </Heading>
      <Text style={paragraph}>Confirm your email to hear about new Tavi releases and updates.</Text>
      <Button href={confirmationUrl} style={button}>
        Confirm my email
      </Button>
      <Text style={{ ...paragraph, fontSize: '14px', color: '#625670', marginTop: '24px' }}>
        This link works for 72 hours. If you didn’t sign up, you can ignore this email.
      </Text>
    </Frame>
  );
}

export function WelcomeEmail({ links }: { links: EmailLinks }) {
  return (
    <Frame
      preview="You’re on the list. A little company is on its way."
      links={links}
      art={['smug', 'lol', 'wave']}
    >
      <Heading style={heading}>
        There’s room
        <br />
        for one more.
      </Heading>
      <Text style={paragraph}>
        You’re on the list for Tavi releases and updates. We’ll write when there’s something new to
        share.
      </Text>
      <Text style={paragraph}>
        Until then, meet the little companion who’s making a home beside your stream.
      </Text>
      <Button href={links.siteUrl} style={button}>
        Meet Tavi
      </Button>
    </Frame>
  );
}

export interface ReleaseContent {
  id: string;
  title: string;
  body: string;
  url: string;
}

export function ReleaseEmail({ links, release }: { links: EmailLinks; release: ReleaseContent }) {
  return (
    <Frame preview={release.title} links={links} art={['hype', 'cheer', 'ooh']}>
      <Text style={{ color: '#795693', fontSize: '14px', margin: '0 0 16px' }}>
        A little news from Tavi
      </Text>
      <Heading style={heading}>{release.title}</Heading>
      {release.body.split(/\n\s*\n/).map((text, index) => (
        <Text key={index} style={paragraph}>
          {text}
        </Text>
      ))}
      <Button href={release.url} style={button}>
        See what’s new
      </Button>
    </Frame>
  );
}

// Invitations go to streamers who have not signed up for anything, one at a time. Subject lines
// state what she does within about five words; see docs/MAILING-LIST.md.
export const inviteVariants = [
  'says-it',
  'for-chat',
  'chat-talks',
  'from-the-maker',
  'plain-note',
] as const;
export type InviteVariant = (typeof inviteVariants)[number];

export interface InviteDetails {
  /** The streamer's channel name. Left out, the wording says "your stream". */
  channel?: string;
  /** Who signs the two personal variants. */
  from?: string;
}

interface InviteCopy {
  subject: string;
  preview: string;
  heading?: string;
  art?: Art;
  cta?: string;
  signed?: boolean;
  /** `site` is the linked website address. */
  body: (site: React.ReactNode) => React.ReactNode[];
}

function inviteCopy(variant: InviteVariant, channel?: string): InviteCopy {
  const chat = channel ? `${channel}’s chat` : 'your chat';
  const stream = channel ?? 'your stream';
  const hello =
    'Hi there! I understand you’re busy, so to respect your time, here’s a short message.';
  const what =
    'Tavi is a streaming companion who lives on your overlay and reacts to you and your viewers.';
  const thanks = 'Thank you for your time, and I hope you’re having a wonderful day.';
  switch (variant) {
    case 'says-it':
      return {
        subject: 'Tavi reacts to your chat',
        preview: 'She lives on your overlay and joins in with your viewers.',
        heading: 'Tavi reacts to your chat, live on your overlay.',
        art: ['wave', 'ooh', 'happy'],
        cta: 'Meet Tavi',
        body: (site) => [
          hello,
          what,
          <>If you’d be willing to give her a try, you can find her at {site}.</>,
          thanks,
        ],
      };
    case 'for-chat':
      return {
        subject: `More for ${chat} to do`,
        preview: 'Tavi reacts to you and your viewers on your overlay.',
        heading: `Give ${chat} one more way to take part.`,
        art: ['happy', 'cheer', 'wave'],
        cta: 'Meet Tavi',
        body: (site) => [
          'Hi there! I’ll keep this short.',
          'Tavi is a streaming companion who lives on your overlay. She reacts to you and your viewers, so the people watching have one more way to take part in your stream.',
          <>If that would be useful to you, you can try her at {site}.</>,
          'Thank you for your time.',
        ],
      };
    case 'chat-talks':
      return {
        subject: 'Chat talks. Tavi reacts.',
        preview: 'A streaming companion who adds to the stream you already run.',
        heading: 'When chat speaks up, Tavi reacts on screen.',
        art: ['hype', 'ooh', 'wave'],
        cta: 'See Tavi',
        body: (site) => [
          'Hi there! A short note, since you’re busy.',
          'Tavi is a streaming companion who lives on your overlay. She adds to the stream you already run by reacting to you and your viewers as things happen.',
          <>If you’d like to see how she fits with yours, she’s at {site}.</>,
          'Thank you for your time, and have a good day.',
        ],
      };
    case 'from-the-maker':
      return {
        subject: `Try Tavi on ${stream}?`,
        preview: 'A streaming companion who reacts to you and your chat.',
        heading: `Would you try Tavi on ${stream}?`,
        art: ['wave', 'happy', 'ooh'],
        cta: 'Try Tavi',
        signed: true,
        body: (site) => [
          'Hi there! I understand you’re busy, so this will be quick.',
          'I’m building Tavi, a streaming companion who lives on your overlay and interacts with you and your viewers. The goal is to help streamers with engagement, and I’d like to know whether she does that for you.',
          <>If you’d be willing to give her a try, she’s at {site}. Any feedback is welcome.</>,
          'Thank you for your time.',
        ],
      };
    case 'plain-note':
      return {
        subject: channel ? `Tavi for ${channel}’s stream` : 'Tavi for your stream',
        preview: 'A streaming companion who reacts to you and your viewers.',
        signed: true,
        body: (site) => [
          'Hi there!',
          'I understand you’re busy, so to respect your time, here’s a short message.',
          <>
            {what} If you’d be willing to give her a try, you can find her at {site}.
          </>,
          thanks,
        ],
      };
  }
}

export function InviteEmail({
  links,
  variant,
  details = {},
}: {
  links: EmailLinks;
  variant: InviteVariant;
  details?: InviteDetails;
}) {
  const copy = inviteCopy(variant, details.channel);
  const site = (
    <Link href={links.siteUrl} style={{ color: '#795693', textDecoration: 'underline' }}>
      {links.siteUrl.replace(/^https?:\/\//, '')}
    </Link>
  );
  return (
    <Frame
      preview={copy.preview}
      links={links}
      art={copy.art}
      footer={
        <>
          <Text style={small}>
            A one-time invitation.{' '}
            <Link href={links.unsubscribeUrl} style={{ color: '#625670' }}>
              Unsubscribe
            </Link>
            {copy.art && (
              <>
                {' · '}
                <Link href={`${links.siteUrl}/credits/rive-avatar.md`} style={{ color: '#625670' }}>
                  Credits
                </Link>
              </>
            )}
          </Text>
          <Text style={small}>{links.postalAddress}</Text>
        </>
      }
    >
      {copy.heading && <Heading style={heading}>{copy.heading}</Heading>}
      {copy.body(site).map((text, index) => (
        <Text key={index} style={paragraph}>
          {text}
        </Text>
      ))}
      {copy.signed && details.from && <Text style={paragraph}>{details.from}</Text>}
      {copy.cta && (
        <Button href={links.siteUrl} style={button}>
          {copy.cta}
        </Button>
      )}
    </Frame>
  );
}

export async function renderInvite(
  variant: InviteVariant,
  links: EmailLinks,
  details: InviteDetails = {},
) {
  const html = await render(<InviteEmail links={links} variant={variant} details={details} />);
  return { subject: inviteCopy(variant, details.channel).subject, html, text: toPlainText(html) };
}

export async function renderEmail(
  kind: string,
  links: EmailLinks,
  confirmationUrl: string,
  release?: ReleaseContent,
) {
  let template: React.ReactElement;
  let subject: string;
  if (kind === 'confirmation') {
    template = <ConfirmationEmail links={links} confirmationUrl={confirmationUrl} />;
    subject = 'Confirm your Tavi updates';
  } else if (kind === 'welcome') {
    template = <WelcomeEmail links={links} />;
    subject = 'Welcome to Tavi’s little corner';
  } else if (kind === 'release' && release) {
    template = <ReleaseEmail links={links} release={release} />;
    subject = release.title;
  } else {
    throw new Error('Unknown email template');
  }
  const html = await render(template);
  return { subject, html, text: toPlainText(html) };
}
