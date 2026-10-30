import type {
  AiProvider,
  ArtifactAnalysisResult,
  ComparableParallel,
  HistoricalResearchResult,
  UserArtifactContext,
} from "@/types/artifact";
import { searchOpenAccessMuseumParallels } from "@/lib/ai/museum-search";

export class AiProviderError extends Error {
  public readonly statusCode: number;
  public readonly userActionableMessage: string;

  constructor(
    message: string,
    statusCode: number,
    userActionableMessage: string
  ) {
    super(message);
    this.name = "AiProviderError";
    this.statusCode = statusCode;
    this.userActionableMessage = userActionableMessage;
  }
}

export async function validateAiProviderKey(
  provider: AiProvider,
  apiKey: string
): Promise<{ valid: boolean; modelLabel: string }> {
  const cleaned = apiKey.trim();
  if (!cleaned) {
    throw new AiProviderError(
      "Empty AI API key",
      400,
      "Please enter an API key for your selected AI provider."
    );
  }

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${cleaned}` },
      signal: AbortSignal.timeout(15000),
    }).catch(() => {
      throw new AiProviderError(
        "OpenAI network error",
        504,
        "Unable to reach api.openai.com. Check your network connection and retry."
      );
    });

    if (res.status === 401 || res.status === 403) {
      throw new AiProviderError(
        "Invalid OpenAI API key",
        401,
        "OpenAI rejected this API key. Ensure it is an active secret key ('sk-...') with access to GPT-4o and gpt-image-1.5."
      );
    }
    if (!res.ok) {
      throw new AiProviderError(
        `OpenAI validation status ${res.status}`,
        res.status,
        `OpenAI returned HTTP ${res.status} when validating credentials.`
      );
    }
    return { valid: true, modelLabel: "OpenAI GPT-4o + gpt-image-1.5" };
  }

  // Gemini validation
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=5&key=${encodeURIComponent(
      cleaned
    )}`,
    {
      method: "GET",
      signal: AbortSignal.timeout(15000),
    }
  ).catch(() => {
    throw new AiProviderError(
      "Gemini network error",
      504,
      "Unable to reach Google Generative Language API. Check your network connection."
    );
  });

  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new AiProviderError(
      "Invalid Gemini API key",
      401,
      "Google Gemini rejected this API key. Create or verify your key in Google AI Studio (aistudio.google.com/apikey)."
    );
  }
  if (!res.ok) {
    throw new AiProviderError(
      `Gemini validation status ${res.status}`,
      res.status,
      `Google Gemini returned HTTP ${res.status} during validation.`
    );
  }

  return { valid: true, modelLabel: "Google Gemini 2.5 Flash + Image Generation" };
}

function extractJsonObject<T>(rawText: string): T {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new AiProviderError(
      "Malformed structured output from AI model",
      502,
      "The AI model returned an unreadable analysis response. Please retry."
    );
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    throw new AiProviderError(
      "Invalid JSON returned from AI model",
      502,
      "Failed parsing archaeological analysis JSON. Please retry."
    );
  }
}

async function callVisionOrTextJson<T>(params: {
  provider: AiProvider;
  apiKey: string;
  systemInstruction: string;
  userPrompt: string;
  imageBase64?: string;
  imageMimeType?: string;
  enableWebSearch?: boolean;
}): Promise<T> {
  const {
    provider,
    apiKey,
    systemInstruction,
    userPrompt,
    imageBase64,
    imageMimeType = "image/png",
  } = params;

  if (provider === "openai") {
    const contentParts: Array<Record<string, unknown>> = [
      { type: "text", text: userPrompt },
    ];
    if (imageBase64) {
      contentParts.unshift({
        type: "image_url",
        image_url: {
          url: `data:${imageMimeType};base64,${imageBase64}`,
          detail: "high",
        },
      });
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.25,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: contentParts },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data?.error?.message || `OpenAI HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) {
        throw new AiProviderError(
          msg,
          401,
          "OpenAI rejected your API key during artifact analysis. Check API Settings."
        );
      }
      if (res.status === 429) {
        throw new AiProviderError(
          msg,
          429,
          "OpenAI rate limit or billing quota reached. Check your OpenAI usage tier and credits."
        );
      }
      throw new AiProviderError(msg, 502, `OpenAI analysis error: ${msg}`);
    }

    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new AiProviderError(
        "Empty response from OpenAI",
        502,
        "OpenAI returned an empty analysis response. Please try again."
      );
    }
    return extractJsonObject<T>(text);
  }

  // Gemini 2.5 Flash
  const parts: Array<Record<string, unknown>> = [];
  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: imageMimeType,
        data: imageBase64,
      },
    });
  }
  parts.push({ text: userPrompt });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
      apiKey.trim()
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.25,
          responseMimeType: "application/json",
        },
      }),
      signal: AbortSignal.timeout(45000),
    }
  );

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error?.message || `Gemini HTTP ${res.status}`;
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new AiProviderError(
        msg,
        401,
        `Google Gemini API error: ${msg}`
      );
    }
    if (res.status === 429) {
      throw new AiProviderError(
        msg,
        429,
        "Google Gemini quota or rate limit reached. Wait a moment or check your billing tier."
      );
    }
    throw new AiProviderError(msg, 502, `Gemini analysis error: ${msg}`);
  }

  const textParts = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("\n");

  if (!textParts.trim()) {
    throw new AiProviderError(
      "Empty Gemini output",
      502,
      "Gemini returned an empty archaeological assessment. Please retry."
    );
  }

  return extractJsonObject<T>(textParts);
}

/**
 * Step 1: Vision Archaeological Examination
 */
export async function analyzeUploadedArtifact(params: {
  provider: AiProvider;
  apiKey: string;
  imageBuffer: Buffer;
  userContext?: UserArtifactContext;
}): Promise<ArtifactAnalysisResult> {
  const imageBase64 = params.imageBuffer.toString("base64");
  const ctxLines = [
    params.userContext?.artifactName
      ? `User-supplied artifact name: ${params.userContext.artifactName}`
      : null,
    params.userContext?.archaeologicalSite
      ? `User-supplied site/origin: ${params.userContext.archaeologicalSite}`
      : null,
    params.userContext?.approximateEra
      ? `User-supplied approximate era: ${params.userContext.approximateEra}`
      : null,
    params.userContext?.museumReference
      ? `User-supplied museum/catalog reference: ${params.userContext.museumReference}`
      : null,
    params.userContext?.additionalNotes
      ? `User-supplied notes: ${params.userContext.additionalNotes}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const systemInstruction = `You are a senior museum conservator and archaeological specialist.
Examine the uploaded photograph of an artifact carefully and objectively.
NEVER fabricate historical identifications, fake museum accession numbers, or numerical confidence percentages.
If the photograph is ambiguous, modern, or lacks diagnostic cultural markers, set "identificationCertainty" to "ambiguous" and explain clearly what is observable versus uncertain.
Return strictly a JSON object matching the requested schema.`;

  const userPrompt = `Analyze this photograph of a damaged, incomplete, or weathered object for forensic archaeological conservation assessment.
${ctxLines ? `\nOptional user-provided context:\n${ctxLines}\n` : ""}
Return a JSON object with these exact keys:
{
  "objectType": "Concise typological classification (e.g., 'Neck-amphora fragment', 'Limestone portrait bust', 'Carved stone vessel')",
  "probableMaterial": "Observed probable material and surface finish (e.g., 'Wheel-thrown terracotta with flat black-gloss slip', 'Fine-grained white Pentelic marble')",
  "exactMaterialColorAndPatina": "Precise visual description of observed color, mineral grain, polish, glaze sheen, veining, and weathering patina (e.g., 'Mirror-polished honey-ochre yellow jasper with minute dark mineral flecks', 'Medium-dark cool dove-gray limestone with fine calcite veins')",
  "cameraAngleAndOrientation": "Exact camera viewpoint and facing direction of the surviving fragment (e.g., 'Strict frontal orthographic view', 'Three-quarter profile facing right at eye level')",
  "surfaceReliefType": "Exact surface dimensionality — distinguish strictly between 'Smooth flat 2D painted/incised ceramic (zero 3D relief)', 'Shallow carved bas-relief', 'High architectural relief', or 'Full 3D sculpture in the round'",
  "survivingElements": ["List 3 to 6 exact structural, anatomical, or iconographic details visibly preserved in the fragment, including exact pose/orientation"],
  "missingOrDamagedSections": ["List 2 to 5 specific fractures, missing appendages, spalling, rim losses, missing composite inlays, or museum mount clips"],
  "patternsAndInscriptions": ["List visible iconography, decorative bands, relief motifs, brushwork/incisions, tool marks, or inscriptions — or state 'No surviving inscriptions visible'"],
  "potentialPeriod": "Estimated historical period if diagnostic evidence supports it, or 'Undetermined period (insufficient diagnostic evidence)'",
  "potentialCivilization": "Probable cultural attribution if supported by visible style/context, or 'Unattributed / Ambiguous origin'",
  "identificationCertainty": "supported" | "tentative" | "ambiguous",
  "ambiguityExplanation": "1-2 sentences explaining how securely the artifact can be attributed and whether optional context would refine reconstruction",
  "conservationObservations": "2-3 sentences summarizing condition, break geometry, and structural cues available for strict in-situ visual completion"
}`;

  const parsed = await callVisionOrTextJson<
    ArtifactAnalysisResult & { museumSearchQueries?: string[] }
  >({
    provider: params.provider,
    apiKey: params.apiKey,
    systemInstruction,
    userPrompt,
    imageBase64,
    imageMimeType: "image/png",
  });

  const certainty = ["supported", "tentative", "ambiguous"].includes(
    parsed.identificationCertainty
  )
    ? parsed.identificationCertainty
    : "tentative";

  return {
    objectType: parsed.objectType || "Archaeological Artifact",
    probableMaterial: parsed.probableMaterial || "Unidentified historic material",
    exactMaterialColorAndPatina:
      parsed.exactMaterialColorAndPatina || parsed.probableMaterial || undefined,
    cameraAngleAndOrientation:
      parsed.cameraAngleAndOrientation || "Centered museum studio viewpoint",
    surfaceReliefType:
      parsed.surfaceReliefType || "Full 3D object with authentic surface finish",
    survivingElements: Array.isArray(parsed.survivingElements)
      ? parsed.survivingElements.slice(0, 6)
      : [],
    missingOrDamagedSections: Array.isArray(parsed.missingOrDamagedSections)
      ? parsed.missingOrDamagedSections.slice(0, 6)
      : [],
    patternsAndInscriptions: Array.isArray(parsed.patternsAndInscriptions)
      ? parsed.patternsAndInscriptions.slice(0, 6)
      : [],
    potentialPeriod: parsed.potentialPeriod || "Undetermined period",
    potentialCivilization:
      parsed.potentialCivilization || "Unattributed cultural context",
    identificationCertainty: certainty,
    ambiguityExplanation:
      parsed.ambiguityExplanation ||
      "Attribution rests on visible morphological traits and should be treated as an interpretive hypothesis.",
    conservationObservations:
      parsed.conservationObservations ||
      "Surviving contours provide structural geometry for bounded missing-section completion.",
  };
}

/**
 * Step 2: Historical Research & Grounded Reconstruction Hypothesis Planning
 */
export async function conductHistoricalResearch(params: {
  provider: AiProvider;
  apiKey: string;
  analysis: ArtifactAnalysisResult;
  userContext?: UserArtifactContext;
}): Promise<HistoricalResearchResult> {
  const { analysis, userContext } = params;

  // Query live Open-Access Museum APIs (The Met & Art Institute of Chicago) for genuine surviving parallels
  const searchTerms = [
    [analysis.potentialCivilization, analysis.objectType]
      .filter((s) => s && !s.toLowerCase().includes("unattributed"))
      .join(" "),
    userContext?.artifactName || analysis.objectType,
  ].filter(Boolean);

  const verifiedParallels: ComparableParallel[] =
    await searchOpenAccessMuseumParallels(searchTerms, 4);

  const parallelsContext =
    verifiedParallels.length > 0
      ? `Verified open-access museum collection parallels retrieved from The Metropolitan Museum of Art / Art Institute of Chicago:\n${JSON.stringify(
          verifiedParallels,
          null,
          2
        )}`
      : "No exact open-access API match returned; rely strictly on well-documented typological scholarship without inventing accession numbers or URLs.";

  const systemInstruction = `You are an archaeological research curator preparing forensic conservation hypotheses for a digital museum exhibit.
Rules:
1. Distinguish strictly between observed/supported archaeological facts and uncertain/speculative interpretations.
2. NEVER invent fake URLs, fake accession numbers, or numerical confidence percentages.
3. For comparable museum parallels, prefer using the verified open-access museum records supplied in the prompt (keeping their exact URLs and accession numbers).
4. Design 3 distinct, historically grounded visual reconstruction hypotheses when missing portions admit multiple plausible interpretations (or 2 if evidence is tightly constrained).
5. STRICT IN-SITU FRAGMENT CONTINUITY — Every visualPrompt MUST instruct the image editing model to:
   - Lock and preserve 100% of the surviving fragment's exact visual appearance in situ: exact camera angle/facing direction (${analysis.cameraAngleAndOrientation || "matching original photo"}), exact material color, mineral grain, and patina (${analysis.exactMaterialColorAndPatina || analysis.probableMaterial}), exact pose/drapery/anatomy, and exact painted brushwork or carved incisions.
   - Respect surface dimensionality (${analysis.surfaceReliefType || "matching original surface"}): NEVER turn flat 2D painted pottery figures into 3D embossed relief, and NEVER turn carved stone statues into glossy human flesh or plastic.
   - Seamlessly heal and eliminate raw fracture lines, crack seams, surface chips, and modern museum mount clips so the restored artifact appears whole and unified as it existed in antiquity BEFORE breakage.
   - Reconstruct ONLY the missing or damaged sections in historically attested style.
   - Present the single complete 3D-ready artifact centered, full-view from top to base, upright on a clean transparent background with balanced museum studio lighting (no external pedestals, no split screens, no text labels, no display cases).`;

  const userPrompt = `Prepare historical research and reconstruction hypothesis briefs based on this Step 1 analysis:
${JSON.stringify(analysis, null, 2)}

Optional user context:
${JSON.stringify(userContext ?? {}, null, 2)}

${parallelsContext}

Return strictly a JSON object matching this schema:
{
  "researchSummary": "3-4 concise scholarly sentences situating the object's form, material tradition, and comparative typology",
  "supportedFindings": ["3-4 points directly supported by visible physical traits and established archaeological parallels"],
  "uncertainInterpretations": ["2-4 elements that remain uncertain (e.g., exact lost finial motif, original pigment intensity, missing inscription characters)"],
  "documentedReconstructionMethods": ["2-3 real archaeological/conservation reconstruction principles applied here (e.g., 'Axial profile symmetry projection for wheel-thrown vessels', 'Iconographic canon comparison with contemporaneous Attic workshops')"],
  "suggestedHypothesesCount": 3,
  "hypothesisBriefs": [
    {
      "id": "hyp-1",
      "label": "Interpretation I",
      "title": "Short title (e.g., 'Conservative Structural Completion')",
      "subtitle": "5-8 word subtitle",
      "methodologyNote": "2 sentences explaining why specific missing features were reconstructed this way and what remains interpretive",
      "observedFeaturesPreserved": ["2-3 surviving traits strictly retained"],
      "hypothesizedAdditions": ["2-3 missing elements reconstructed"],
      "visualPrompt": "Detailed museum-accurate restoration prompt for image editing/reconstruction...",
      "isSpeculative": false
    }
  ]
}`;

  const raw = await callVisionOrTextJson<{
    researchSummary?: string;
    supportedFindings?: string[];
    uncertainInterpretations?: string[];
    documentedReconstructionMethods?: string[];
    suggestedHypothesesCount?: number;
    hypothesisBriefs?: HistoricalResearchResult["hypothesisBriefs"];
  }>({
    provider: params.provider,
    apiKey: params.apiKey,
    systemInstruction,
    userPrompt,
  });

  const briefs = Array.isArray(raw.hypothesisBriefs)
    ? raw.hypothesisBriefs.slice(0, 3)
    : [];

  const isAmbiguous = analysis.identificationCertainty === "ambiguous";

  const normalizedBriefs: HistoricalResearchResult["hypothesisBriefs"] =
    briefs.length > 0
      ? briefs.map((b, idx) => ({
          id: `hyp-${idx + 1}`,
          label: `Interpretation ${["I", "II", "III"][idx] ?? idx + 1}`,
          title: b.title || `Reconstruction Hypothesis ${idx + 1}`,
          subtitle: b.subtitle || "Historically informed completion",
          methodologyNote:
            b.methodologyNote ||
            "Reconstructs missing geometry from surviving symmetry and documented material conventions.",
          observedFeaturesPreserved: Array.isArray(b.observedFeaturesPreserved)
            ? b.observedFeaturesPreserved
            : analysis.survivingElements.slice(0, 3),
          hypothesizedAdditions: Array.isArray(b.hypothesizedAdditions)
            ? b.hypothesizedAdditions
            : analysis.missingOrDamagedSections.slice(0, 3),
          visualPrompt: b.visualPrompt,
          isSpeculative: Boolean(b.isSpeculative || isAmbiguous),
        }))
      : [
          {
            id: "hyp-1",
            label: "Interpretation I",
            title: "Conservative Structural Restoration",
            subtitle: "Symmetry-guided completion of missing sections",
            methodologyNote:
              "Completes fractured profiles strictly following surviving contours without speculative surface embellishment.",
            observedFeaturesPreserved: analysis.survivingElements.slice(0, 3),
            hypothesizedAdditions: analysis.missingOrDamagedSections.slice(0, 3),
            visualPrompt: `Restore this damaged ${analysis.probableMaterial} ${analysis.objectType} into its complete, intact original form. Preserve the surviving structure, proportions, material patina, and visible surface patterns faithfully, reconstructing only the missing or broken portions (${analysis.missingOrDamagedSections.join(", ")}). Show the single complete object centered upright against a clean neutral studio background with soft museum lighting, no text, no pedestals.`,
            isSpeculative: isAmbiguous,
          },
        ];

  const count = Math.min(3, Math.max(1, normalizedBriefs.length)) as 1 | 2 | 3;

  return {
    researchSummary:
      raw.researchSummary ||
      "Comparative typological assessment relates the surviving morphology and fabrication marks to documented historical parallels.",
    supportedFindings: Array.isArray(raw.supportedFindings)
      ? raw.supportedFindings
      : [],
    uncertainInterpretations: Array.isArray(raw.uncertainInterpretations)
      ? raw.uncertainInterpretations
      : [],
    comparableObjects: verifiedParallels,
    documentedReconstructionMethods: Array.isArray(
      raw.documentedReconstructionMethods
    )
      ? raw.documentedReconstructionMethods
      : [],
    suggestedHypothesesCount: count,
    hypothesisBriefs: normalizedBriefs,
  };
}
