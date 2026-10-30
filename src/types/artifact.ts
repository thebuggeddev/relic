export type DiagramType =
  | "amphora"
  | "sculpture"
  | "egyptian"
  | "capital"
  | "mask";

export type AiProvider = "openai" | "gemini";

export interface HistoricalSource {
  label: string;
  institution: string;
  url: string;
  license?: string;
}

export interface ComparableParallel {
  name: string;
  museum: string;
  date: string;
  accessionNumber?: string;
  url?: string;
  relevance: string;
}

export interface ReconstructionHypothesis {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  methodologyNote: string;
  observedFeaturesPreserved: string[];
  hypothesizedAdditions: string[];
  restoredModelUrl?: string;
  initialRotationY?: number;
  defaultScale?: number;
  isSpeculative?: boolean;
}

export interface RelicThemePalette {
  /** Dominant pigment swatch for UI indicator */
  swatch: string;
  /** Deepest outer background shade */
  bgDeep: string;
  /** Mid-canvas dark shade */
  bgMid: string;
  /** Center atmospheric radial spotlight (dark shade of relic's major color) */
  bgGlow: string;
  /** Translucent card surface */
  surfaceCard: string;
  /** Elevated modal/drawer background */
  surfaceSolid: string;
  /** Subtle tint multiplier for stone pedestal */
  pedestalTint: string;
  /** Subtle 3D rim/fill light color */
  rimLightColor: string;
}

export interface ShowcaseArtifact {
  id: string;
  catalogNumber: string; // e.g. "EXHIBIT I"
  shortTitle: string; // e.g. "Greek Amphora"
  authenticName: string;
  accessionNumber: string;
  dateRange: string; // e.g. "c. 530–480 BCE"
  historicalPeriod: string;
  civilization: string;
  origin: string;
  material: string;
  dimensions?: string;
  museum: string;
  museumUrl: string;
  license: string;
  editorialSummary: string;
  purpose: string;
  presentCondition: string;
  observedElements: string[];
  reconstructedAdditions: string[];
  reconstructionEvidence: string;
  comparableParallels: ComparableParallel[];
  originalImageUrl: string;
  originalCutoutUrl?: string;
  sketchImageUrl?: string;
  fragmentedVisualUrl: string;
  fragmentedModelUrl?: string;
  fragmentedIsAiEstimated: boolean;
  restoredModelUrl: string;
  hypotheses: ReconstructionHypothesis[];
  diagramType: DiagramType;
  themePalette?: RelicThemePalette;
  sources: HistoricalSource[];
  viewerConfig?: {
    defaultScale?: number;
    yOffset?: number;
    initialRotationY?: number;
  };
}

export interface UserArtifactContext {
  artifactName?: string;
  archaeologicalSite?: string;
  approximateEra?: string;
  museumReference?: string;
  additionalNotes?: string;
}

export interface ArtifactAnalysisResult {
  objectType: string;
  probableMaterial: string;
  survivingElements: string[];
  missingOrDamagedSections: string[];
  patternsAndInscriptions: string[];
  potentialPeriod: string;
  potentialCivilization: string;
  identificationCertainty: "supported" | "tentative" | "ambiguous";
  ambiguityExplanation: string;
  conservationObservations: string;
  cameraAngleAndOrientation?: string;
  surfaceReliefType?: string;
  exactMaterialColorAndPatina?: string;
}

export interface HistoricalResearchResult {
  researchSummary: string;
  supportedFindings: string[];
  uncertainInterpretations: string[];
  comparableObjects: ComparableParallel[];
  documentedReconstructionMethods: string[];
  suggestedHypothesesCount: 1 | 2 | 3;
  hypothesisBriefs: Array<{
    id: string;
    label: string;
    title: string;
    subtitle: string;
    methodologyNote: string;
    observedFeaturesPreserved: string[];
    hypothesizedAdditions: string[];
    visualPrompt: string;
    isSpeculative: boolean;
  }>;
}

export type JobStatus =
  | "uploaded"
  | "analyzing"
  | "researching"
  | "reconstructing_images"
  | "awaiting_selection"
  | "generating_multiview"
  | "generating_3d"
  | "persisting_assets"
  | "completed"
  | "failed";

export interface Variation3DTaskState {
  hypothesisId: string;
  label: string;
  status:
    | "pending"
    | "generating_multiview"
    | "generating_3d"
    | "completed"
    | "failed";
  tripoMultiviewTaskId?: string;
  tripoTaskId?: string;
  restoredModelUrl?: string;
  previewRenderUrl?: string;
  error?: string;
}

export interface RestorationJob {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: JobStatus;
  progress: number;
  stepLabel: string;
  stepDetail?: string;
  uploadedImageUrl: string;
  uploadedMimeType: string;
  userContext?: UserArtifactContext;
  analysis?: ArtifactAnalysisResult;
  research?: HistoricalResearchResult;
  hypotheses?: ReconstructionHypothesis[];
  selectedHypothesisId?: string;
  useMultiview?: boolean;
  generateAllVariations?: boolean;
  variationTasks?: Variation3DTaskState[];
  multiviewUrls?: {
    front?: string;
    left?: string;
    back?: string;
    right?: string;
  };
  tripoTaskId?: string;
  tripoMultiviewTaskId?: string;
  restoredModelUrl?: string;
  previewRenderUrl?: string;
  error?: string;
  errorCode?: string;
}

export interface ApiSessionStatus {
  hasAiKey: boolean;
  aiProvider: AiProvider | null;
  maskedAiKey: string | null;
  hasTripoKey: boolean;
  maskedTripoKey: string | null;
  ephemeralOnly: boolean;
}
