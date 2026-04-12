import { MarketplaceView } from "@/components/marketplace/marketplace-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Talent Directory — AgentOS",
};

export default function MarketplacePage() {
  return <MarketplaceView />;
}
