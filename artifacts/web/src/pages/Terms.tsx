import { Layout } from "@/components/Layout";
import { ContentPage } from "@/components/ContentPage";
import { useSEO } from "@/lib/seo";

export default function Terms() {
  useSEO({
    title: "Terms of Service",
    description:
      "The terms that govern your use of Chat Extractor — a free, public-share-link extractor for AI conversations.",
    path: "/terms",
  });

  return (
    <Layout>
      <ContentPage
        eyebrow="Legal"
        title="Terms of Service"
        intro="Last updated: 2026. Use Chat Extractor responsibly and at your own risk."
      >
        <h2>Acceptance of terms</h2>
        <p>
          By using Chat Extractor (the "Service") you agree to these Terms. If
          you do not agree, please do not use the Service.
        </p>

        <h2>What the Service does</h2>
        <p>
          Chat Extractor accepts a public share link from a supported AI chat
          platform, fetches the publicly available content at that link, and
          returns a structured Markdown copy that you can read, copy, or
          download.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>
            Only submit URLs that the originating platform has chosen to expose
            publicly via its built-in share feature.
          </li>
          <li>
            Do not attempt to use the Service to access private, restricted, or
            unauthorized content.
          </li>
          <li>
            Do not abuse the Service with automated scraping at a volume that
            degrades availability for other users.
          </li>
          <li>
            Do not use the Service to harass, defame, or violate the rights of
            any person.
          </li>
        </ul>

        <h2>Content ownership</h2>
        <p>
          The conversations we extract are produced by the underlying AI
          platforms and the users who created them. We do not claim any
          ownership over that content. You are responsible for ensuring you
          have the right to extract, store, or redistribute any content you
          process through the Service.
        </p>

        <h2>No warranty</h2>
        <p>
          The Service is provided "as is" without warranty of any kind, express
          or implied, including merchantability, fitness for a particular
          purpose, and non-infringement. We do not guarantee that every share
          link will parse successfully or that extracted content will be
          complete or accurate.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Chat Extractor and its
          authors are not liable for any indirect, incidental, special,
          consequential, or punitive damages arising from or related to your
          use of the Service.
        </p>

        <h2>Trademarks</h2>
        <p>
          ChatGPT, Claude, Gemini, Grok, Perplexity, DeepSeek, and all related
          marks are the property of their respective owners. Chat Extractor is
          an independent project and is not affiliated with, endorsed by, or
          sponsored by any of these companies.
        </p>

        <h2>Changes</h2>
        <p>
          We may revise these Terms from time to time. Continued use of the
          Service after changes constitutes acceptance of the revised Terms.
        </p>
      </ContentPage>
    </Layout>
  );
}
