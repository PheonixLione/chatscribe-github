import { Layout } from "@/components/Layout";
import { ContentPage } from "@/components/ContentPage";
import { useSEO } from "@/lib/seo";

export default function Privacy() {
  useSEO({
    title: "Privacy Policy",
    description:
      "Chat Extractor does not store the URLs you submit or the conversations we extract. Read the full privacy policy.",
    path: "/privacy",
  });

  return (
    <Layout>
      <ContentPage
        eyebrow="Legal"
        title="Privacy Policy"
        intro="Last updated: 2026. The short version: we don't store your data."
      >
        <h2>What we collect</h2>
        <p>
          When you submit a share link, our server makes an outbound request to
          the AI platform that hosts that link, parses the public response, and
          returns the structured conversation to your browser. The submitted
          URL is held in memory only for the duration of that request. We do
          not write the URL or the parsed conversation to a database, log file,
          or analytics pipeline.
        </p>
        <p>
          Standard infrastructure-level information (IP address, user agent,
          timestamp) may appear in short-lived server logs used for abuse
          prevention and operational debugging. These logs are rotated and not
          used to build user profiles.
        </p>

        <h2>What we don't do</h2>
        <ul>
          <li>We don't require an account or any personal information.</li>
          <li>We don't store the share URLs you submit.</li>
          <li>We don't store the conversations we extract.</li>
          <li>We don't sell or share data with third parties.</li>
          <li>We don't run third-party advertising trackers.</li>
        </ul>

        <h2>Cookies</h2>
        <p>
          The web app does not set tracking cookies. Any cookies present are
          functional only (e.g. preserving UI preferences) and never used for
          cross-site tracking.
        </p>

        <h2>Third-party content</h2>
        <p>
          The conversation content we return is fetched from the AI platform's
          public share page. We do not control that content and are not
          responsible for it. You should review each platform's own terms
          before redistributing extracted content.
        </p>

        <h2>Children</h2>
        <p>
          Chat Extractor is not directed at children under 13 and does not
          knowingly collect any information from them.
        </p>

        <h2>Changes</h2>
        <p>
          We may update this policy from time to time. The "last updated" date
          at the top of the page reflects the most recent revision.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy? Reach out via the contact information on
          the About page.
        </p>
      </ContentPage>
    </Layout>
  );
}
