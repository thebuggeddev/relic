import { ExhibitClient } from "@/components/ExhibitClient";
import { SHOWCASE_ARTIFACTS } from "@/data/showcase-artifacts";

export default function HomePage() {
  return <ExhibitClient initialArtifacts={SHOWCASE_ARTIFACTS} />;
}
