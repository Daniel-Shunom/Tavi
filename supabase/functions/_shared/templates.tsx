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

function Frame({
  preview,
  links,
  character,
  children,
}: {
  preview: string;
  links: EmailLinks;
  character: 'hmm' | 'smug' | 'hype';
  children: React.ReactNode;
}) {
  const assets = `${links.assetBaseUrl ?? links.siteUrl}/media/email`;
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: '#f3eff6',
          margin: 0,
          fontFamily: "'DM Sans', sans-serif",
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
            src={`${assets}/tavi-${character}.png`}
            alt={
              character === 'hmm'
                ? 'Tavi tilting her head with a curious shrug'
                : character === 'smug'
                  ? 'Tavi giving a cheeky, knowing smile'
                  : 'Tavi bouncing with both hands in the air'
            }
            width="240"
            height="240"
            style={{ display: 'block', maxWidth: '100%', height: 'auto', margin: '0 auto 24px' }}
          />
          {children}
          <Row style={{ marginTop: '24px' }}>
            <Column align="left" width="50%">
              <Img
                src={`${assets}/tavi-${character === 'hmm' ? 'ooh' : character === 'smug' ? 'lol' : 'cheer'}.png`}
                alt=""
                width="104"
                height="104"
                style={{ display: 'block' }}
              />
            </Column>
            <Column align="right" width="50%">
              <Img
                src={`${assets}/tavi-${character === 'hype' ? 'ooh' : 'wave'}.png`}
                alt=""
                width="104"
                height="104"
                style={{ display: 'block' }}
              />
            </Column>
          </Row>
          <Section
            style={{ borderTop: '1px solid #e8e0ee', marginTop: '40px', paddingTop: '24px' }}
          >
            <Text style={{ color: '#625670', fontSize: '12px', lineHeight: '20px' }}>
              A little life in the corner.
            </Text>
            <Text style={{ color: '#625670', fontSize: '12px', lineHeight: '20px' }}>
              You requested Tavi releases and updates.{' '}
              <Link href={links.unsubscribeUrl} style={{ color: '#625670' }}>
                Unsubscribe
              </Link>
            </Text>
            <Text style={{ color: '#625670', fontSize: '12px', lineHeight: '20px' }}>
              {links.postalAddress}
            </Text>
            <Text style={{ color: '#857a90', fontSize: '10px', lineHeight: '16px' }}>
              Character adapted from{' '}
              <Link
                href="https://rive.app/marketplace/27479-51911-mascot-avatar-customization/"
                style={{ color: '#857a90' }}
              >
                Mascot / Avatar Customization by alisketch
              </Link>
              ,{' '}
              <Link
                href="https://creativecommons.org/licenses/by/4.0/"
                style={{ color: '#857a90' }}
              >
                CC BY 4.0
              </Link>
              . Posed and recolored for Tavi.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const heading = {
  fontFamily: 'Georgia, serif',
  fontSize: '36px',
  lineHeight: '40px',
  fontWeight: 400,
  margin: '0 0 24px',
};
const paragraph = { fontSize: '16px', lineHeight: '26px', margin: '0 0 24px' };
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
    <Frame preview="One click to confirm your Tavi updates." links={links} character="hmm">
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
      character="smug"
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
    <Frame preview={release.title} links={links} character="hype">
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
