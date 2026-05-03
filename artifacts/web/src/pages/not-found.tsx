import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/lib/seo";

export default function NotFound() {
  useSEO({
    title: "Page not found",
    description: "The page you're looking for doesn't exist.",
    path: "/404",
    noindex: true,
  });

  return (
    <Layout>
      <main className="max-w-xl mx-auto px-4 py-24 text-center">
        <p className="text-xs font-mono uppercase tracking-wider text-primary mb-3">
          404
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
          Page not found
        </h1>
        <p className="text-muted-foreground mb-8">
          The page you're looking for doesn't exist or has moved.
        </p>
        <Link href="/">
          <Button>Back to home</Button>
        </Link>
      </main>
    </Layout>
  );
}
