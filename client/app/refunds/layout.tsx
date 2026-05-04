import { Metadata } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "SOCIO does not handle any payments or financial transactions. Read our refund policy for Christ University's campus event management platform.",
  openGraph: {
    title: "Refund Policy | SOCIO",
    description: "SOCIO does not process payments or handle refunds.",
    url: `${SITE_URL}/refunds`,
  },
  alternates: {
    canonical: `${SITE_URL}/refunds`,
  },
};

export default function RefundsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
