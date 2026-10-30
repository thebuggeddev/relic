"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  useProgress,
  useTexture,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type TransitionMode = "initial" | "artifact" | "hypothesis";

interface LiveMeshPose {
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  alpha: number;
}

interface ContactSample {
  alpha: number;
  y: number;
  scale: number;
}

interface StageMeshSlot {
  slotId: number;
  artifactId: string;
  artifactKey: string;
  modelUrl: string;
  initialRotationY: number;
  defaultScale: number;
  dir: 1 | -1;
  mode: TransitionMode;
  hasPrecedingExit?: boolean;
  startPose?: LiveMeshPose;
}

interface ArtifactStage3DProps {
  artifactKey: string;
  artifactId?: string;
  restoredModelUrl: string;
  transitionDirection?: 1 | -1;
  preloadModelUrls?: string[];
  initialRotationY?: number;
  defaultScale?: number;
  pedestalTint?: string;
  rimLightColor?: string;
  onOpenUpload: () => void;
}

let cachedPedestalGeo: THREE.BoxGeometry | null = null;
function getSharedPedestalGeometry(): THREE.BoxGeometry {
  if (cachedPedestalGeo) return cachedPedestalGeo;
  const width = 1.78;
  const height = 0.42;
  const depth = 1.34;
  const geo = new THREE.BoxGeometry(width, height, depth, 20, 8, 16);

  const pos = geo.attributes.position;
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const halfD = depth * 0.5;

  const rockNoise = (x: number, y: number, z: number) =>
    Math.sin(x * 7.3 + z * 5.1) * 0.45 +
    Math.cos(x * 15.7 - y * 11.3 + z * 13.1) * 0.35 +
    Math.sin(x * 29.1 + z * 23.7) * 0.2;

  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i);
    let vy = pos.getY(i);
    let vz = pos.getZ(i);

    const nx = Math.abs(vx) / halfW;
    const ny = vy / halfH;
    const nz = Math.abs(vz) / halfD;

    const edgeProximity = Math.max(nx, nz);
    const n = rockNoise(vx, vy, vz);

    if (edgeProximity > 0.82) {
      const edgeStrength = (edgeProximity - 0.82) / 0.18;
      const chip = (n * 0.5 + 0.5) * 0.026 * edgeStrength;
      vx -= Math.sign(vx) * chip * 0.9;
      vz -= Math.sign(vz) * chip * 0.9;

      if (ny > 0.72) {
        const topRim = (ny - 0.72) / 0.28;
        vy -= Math.max(0, (0.6 - n) * 0.018 * edgeStrength * topRim);
      }
    }

    pos.setXYZ(i, vx, vy, vz);
  }

  geo.computeVertexNormals();
  cachedPedestalGeo = geo;
  return geo;
}

let cachedShadowTex: THREE.CanvasTexture | null = null;
function getSharedShadowTexture(): THREE.CanvasTexture {
  if (cachedShadowTex) return cachedShadowTex;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 4, half, half, half);
    grad.addColorStop(0, "rgba(4, 8, 10, 0.78)");
    grad.addColorStop(0.38, "rgba(4, 8, 10, 0.46)");
    grad.addColorStop(0.72, "rgba(4, 8, 10, 0.14)");
    grad.addColorStop(1, "rgba(4, 8, 10, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cachedShadowTex = tex;
  return tex;
}

let cachedShadowGeo: THREE.PlaneGeometry | null = null;
function getSharedShadowGeometry(): THREE.PlaneGeometry {
  if (!cachedShadowGeo) {
    cachedShadowGeo = new THREE.PlaneGeometry(1, 1);
  }
  return cachedShadowGeo;
}

function computePedestalColors(tint: string) {
  const sideColor = new THREE.Color(tint).lerp(new THREE.Color("#ffffff"), 0.58);
  const topColor = new THREE.Color("#ded8ca").lerp(sideColor, 0.18);
  return { sideColor, topColor };
}

interface NormalizedModelBounds {
  scale: number;
  posX: number;
  posY: number;
  posZ: number;
}

const warmModelUrls = new Set<string>();
const cachedModelBoundsMap = new Map<string, NormalizedModelBounds>();

function getNormalizedModelBounds(
  modelUrl: string,
  sourceScene: THREE.Object3D,
  initialRotationY: number,
  defaultScale: number
): NormalizedModelBounds {
  const key = `${modelUrl}|${initialRotationY.toFixed(4)}|${defaultScale.toFixed(4)}`;
  const cached = cachedModelBoundsMap.get(key);
  if (cached) return cached;

  const measureClone = sourceScene.clone(true);
  measureClone.rotation.set(0, initialRotationY, 0);
  measureClone.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(measureClone);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const targetHeight = 1.84 * defaultScale;
  const scale = targetHeight / maxDim;

  const result: NormalizedModelBounds = {
    scale,
    posX: -center.x * scale,
    posY: -box.min.y * scale,
    posZ: -center.z * scale,
  };
  cachedModelBoundsMap.set(key, result);
  return result;
}

function StudioEnvironment() {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    const envScene = new RoomEnvironment();
    const envRT = pmrem.fromScene(envScene, 0.04);
    envScene.dispose();
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.76;
    invalidate();
    return () => {
      scene.environment = null;
      envRT.dispose();
      pmrem.dispose();
    };
  }, [gl, invalidate, scene]);
  return null;
}

/**
 * Zero-FBO soft elliptical contact shadow on the pedestal top:
 * Replaces @react-three/drei ContactShadows with a cached 2-triangle quad (~0.01ms GPU)
 * that dynamically breathes in sync with turntable handoffs and vertical variant glides.
 */
function PedestalContactShadow({
  contactMapRef,
  visible = true,
}: {
  contactMapRef: React.MutableRefObject<Map<number, ContactSample>>;
  visible?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  const shadowTex = useMemo(() => getSharedShadowTexture(), []);
  const shadowGeo = useMemo(() => getSharedShadowGeometry(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat || !visible) return;

    if (contactMapRef.current.size === 0) {
      mat.opacity = 0.82;
      mesh.scale.set(1.45, 1.12, 1);
      return;
    }

    let bestContact = 0;
    let spread = 1;
    contactMapRef.current.forEach(({ alpha, y, scale }) => {
      const lift = Math.max(0, y - -0.92);
      const sink = Math.max(0, -0.92 - y);
      const c = alpha * Math.exp(-lift * 2.5) * Math.exp(-sink * 2.2);
      if (c > bestContact) {
        bestContact = c;
        spread = scale * (1 + Math.min(0.18, lift * 0.22));
      }
    });

    mat.opacity = 0.12 + 0.7 * bestContact;
    mesh.scale.set(1.45 * spread, 1.12 * spread, 1);
  });

  return (
    <mesh
      ref={meshRef}
      visible={visible}
      position={[0, -0.917, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[1.45, 1.12, 1]}
      geometry={shadowGeo}
      renderOrder={1}
    >
      <meshBasicMaterial
        ref={matRef}
        map={shadowTex}
        transparent
        opacity={0.82}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </mesh>
  );
}

/**
 * Freezes directional shadow map updates during motion & stationary orbit
 * (PedestalContactShadow handles dynamic plinth grounding at ~0.01ms GPU),
 * refreshing the directional self-shadow map once each time a model settles.
 */
function ShadowMapController({ activeMotion }: { activeMotion: boolean }) {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    if (!activeMotion) {
      gl.shadowMap.needsUpdate = true;
      invalidate();
    }
  }, [activeMotion, gl, invalidate]);
  return null;
}

/**
 * Excavated chiseled stone pedestal:
 * - Geometry is built once so artifact transitions never recompute vertex normals.
 * - Top & side stone tints smoothly interpolate in useFrame during artifact switches.
 */
function MuseumPedestal3D({
  tint = "#b5ae9e",
  visible = true,
  reducedMotion = false,
}: {
  tint?: string;
  visible?: boolean;
  reducedMotion?: boolean;
}) {
  const [topTex, sideTex] = useTexture([
    "/showcase/pedestal-top.jpg",
    "/showcase/pedestal-side.jpg",
  ]);

  const geometry = useMemo(() => getSharedPedestalGeometry(), []);

  const { materials, sideMat, topMat } = useMemo(() => {
    topTex.colorSpace = THREE.SRGBColorSpace;
    topTex.anisotropy = 4;
    sideTex.colorSpace = THREE.SRGBColorSpace;
    sideTex.anisotropy = 4;

    const { sideColor, topColor } = computePedestalColors("#b5ae9e");

    const sMat = new THREE.MeshStandardMaterial({
      map: sideTex,
      bumpMap: sideTex,
      bumpScale: 0.022,
      color: sideColor,
      roughness: 0.86,
      metalness: 0.08,
      transparent: true,
      opacity: 1,
      depthWrite: true,
    });

    const tMat = new THREE.MeshStandardMaterial({
      map: topTex,
      bumpMap: topTex,
      bumpScale: 0.016,
      color: topColor,
      roughness: 0.9,
      metalness: 0.03,
      transparent: true,
      opacity: 1,
      depthWrite: true,
    });

    const bMat = new THREE.MeshStandardMaterial({
      color: "#090d0e",
      roughness: 0.95,
      transparent: true,
      opacity: 1,
      depthWrite: true,
    });

    return {
      sideMat: sMat,
      topMat: tMat,
      materials: [sMat, sMat, tMat, bMat, sMat, sMat],
    };
  }, [topTex, sideTex]);

  const invalidate = useThree((s) => s.invalidate);
  const targetSideColorRef = useRef(new THREE.Color());
  const targetTopColorRef = useRef(new THREE.Color());

  useEffect(() => {
    const { sideColor, topColor } = computePedestalColors(tint);
    targetSideColorRef.current.copy(sideColor);
    targetTopColorRef.current.copy(topColor);
    invalidate();
  }, [invalidate, tint]);

  useFrame((state, delta) => {
    const dr =
      Math.abs(sideMat.color.r - targetSideColorRef.current.r) +
      Math.abs(sideMat.color.g - targetSideColorRef.current.g) +
      Math.abs(sideMat.color.b - targetSideColorRef.current.b);
    if (dr < 0.0008) return;
    const k = reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, 0.05) * 5.4);
    sideMat.color.lerp(targetSideColorRef.current, k);
    topMat.color.lerp(targetTopColorRef.current, k);
    state.invalidate();
  });

  useEffect(() => {
    return () => {
      const uniqueMats = new Set(materials);
      uniqueMats.forEach((m) => m.dispose());
    };
  }, [materials]);

  return (
    <mesh
      visible={visible}
      position={[0, -1.13, 0]}
      geometry={geometry}
      material={materials}
      receiveShadow
    />
  );
}

/**
 * Loads a target GLB inside an isolated Suspense boundary without unmounting
 * the currently displayed sculpture until the incoming mesh is ready in cache.
 */
function PreloadAndCommitModel({
  modelUrl,
  onReady,
}: {
  modelUrl: string;
  onReady: () => void;
}) {
  useGLTF(modelUrl);
  warmModelUrls.add(modelUrl);
  const firedRef = useRef(false);
  useEffect(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      onReady();
    }
  }, [onReady]);
  return null;
}

/**
 * Background VRAM prewarmer: parses sibling variation GLBs and uploads 1 PBR texture
 * per idle frame via gl.initTexture() so clicking I / II / III has 0ms GPU upload lag.
 */
function PrewarmSingleGlb({
  modelUrl,
  initialRotationY,
  defaultScale,
  pausedRef,
}: {
  modelUrl: string;
  initialRotationY: number;
  defaultScale: number;
  pausedRef: React.MutableRefObject<boolean>;
}) {
  const gltf = useGLTF(modelUrl);
  const { gl } = useThree();

  useEffect(() => {
    getNormalizedModelBounds(
      modelUrl,
      gltf.scene,
      initialRotationY,
      defaultScale
    );

    const texturesSet = new Set<THREE.Texture>();
    gltf.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mats = Array.isArray(obj.material)
          ? obj.material
          : obj.material
            ? [obj.material]
            : [];
        for (const m of mats) {
          if (m instanceof THREE.MeshStandardMaterial) {
            if (m.map) {
              m.map.anisotropy = 4;
              texturesSet.add(m.map);
            }
            if (m.normalMap) {
              m.normalMap.anisotropy = 4;
              texturesSet.add(m.normalMap);
            }
            if (m.roughnessMap) texturesSet.add(m.roughnessMap);
            if (m.metalnessMap) texturesSet.add(m.metalnessMap);
          }
        }
      }
    });

    const textures = Array.from(texturesSet);
    let idx = 0;
    let rafId = 0;

    const stepUpload = () => {
      if (pausedRef.current) {
        rafId = window.requestAnimationFrame(stepUpload);
        return;
      }
      if (idx < textures.length) {
        gl.initTexture(textures[idx++]);
        rafId = window.requestAnimationFrame(stepUpload);
      } else {
        warmModelUrls.add(modelUrl);
      }
    };

    rafId = window.requestAnimationFrame(stepUpload);
    return () => window.cancelAnimationFrame(rafId);
  }, [defaultScale, gl, gltf.scene, initialRotationY, modelUrl, pausedRef]);

  return null;
}

interface ClonedMaterialRecord {
  mat: THREE.Material;
  baseOpacity: number;
  baseDepthWrite: boolean;
}

/**
 * Renders either the active (entering/resting/holding) or exiting 3D sculpture:
 * - Keyed by slot.slotId so an active mesh transitions to role="exiting" in-place
 *   with zero React remount, zero scene re-cloning, and zero shader recompilation.
 * - Exhibit switch (mode === "artifact"): current sculpture rotates 180° on the stationary
 *   stone pedestal and dissolves; then the next sculpture appears and decelerates ~158° -> 0°.
 * - Variant switch (mode === "hypothesis"): carries the entire chiseled stone pedestal & contact
 *   shadow together with the sculpture in a crisp overlapped glide.
 */
function AnimatedArtifactMesh({
  slot,
  role,
  pedestalTint = "#b5ae9e",
  carryPedestal = false,
  pendingHint = null,
  livePoseMapRef,
  contactMapRef,
  reducedMotion = false,
  onExited,
  onEntered,
}: {
  slot: StageMeshSlot;
  role: "active" | "exiting";
  pedestalTint?: string;
  carryPedestal?: boolean;
  pendingHint?: { mode: TransitionMode; dir: 1 | -1 } | null;
  livePoseMapRef: React.MutableRefObject<Map<number, LiveMeshPose>>;
  contactMapRef: React.MutableRefObject<Map<number, ContactSample>>;
  reducedMotion?: boolean;
  onExited?: (slotId: number) => void;
  onEntered?: (slotId: number) => void;
}) {
  const gltf = useGLTF(slot.modelUrl);
  const [topTex, sideTex] = useTexture([
    "/showcase/pedestal-top.jpg",
    "/showcase/pedestal-side.jpg",
  ]);
  const motionGroupRef = useRef<THREE.Group>(null);
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const elapsedRef = useRef(0);
  const currentAlphaRef = useRef(role === "exiting" ? 1 : reducedMotion ? 1 : 0);
  const restoredOpaqueRef = useRef(false);
  const enteredFiredRef = useRef(false);
  const exitedFiredRef = useRef(false);
  const exitStartPoseRef = useRef<LiveMeshPose | null>(null);

  const pedestalGeo = useMemo(() => getSharedPedestalGeometry(), []);
  const shadowGeo = useMemo(() => getSharedShadowGeometry(), []);

  const { pedestalMaterials, pedestalUniqueMats, shadowMat } = useMemo(() => {
    topTex.colorSpace = THREE.SRGBColorSpace;
    topTex.anisotropy = 4;
    sideTex.colorSpace = THREE.SRGBColorSpace;
    sideTex.anisotropy = 4;

    const { sideColor, topColor } = computePedestalColors("#b5ae9e");

    const sMat = new THREE.MeshStandardMaterial({
      map: sideTex,
      bumpMap: sideTex,
      bumpScale: 0.022,
      color: sideColor,
      roughness: 0.86,
      metalness: 0.08,
      transparent: true,
      opacity: 1,
      depthWrite: true,
    });
    const tMat = new THREE.MeshStandardMaterial({
      map: topTex,
      bumpMap: topTex,
      bumpScale: 0.016,
      color: topColor,
      roughness: 0.9,
      metalness: 0.03,
      transparent: true,
      opacity: 1,
      depthWrite: true,
    });
    const bMat = new THREE.MeshStandardMaterial({
      color: "#090d0e",
      roughness: 0.95,
      transparent: true,
      opacity: 1,
      depthWrite: true,
    });
    const cShadowMat = new THREE.MeshBasicMaterial({
      map: getSharedShadowTexture(),
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });

    return {
      pedestalMaterials: [sMat, sMat, tMat, bMat, sMat, sMat],
      pedestalUniqueMats: [sMat, tMat, bMat],
      shadowMat: cShadowMat,
    };
  }, [sideTex, topTex]);

  useEffect(() => {
    const { sideColor, topColor } = computePedestalColors(pedestalTint);
    pedestalUniqueMats[0].color.copy(sideColor);
    pedestalUniqueMats[1].color.copy(topColor);
  }, [pedestalTint, pedestalUniqueMats]);

  const { wrapper, matRecords } = useMemo(() => {
    warmModelUrls.add(slot.modelUrl);
    const bounds = getNormalizedModelBounds(
      slot.modelUrl,
      gltf.scene,
      slot.initialRotationY,
      slot.defaultScale
    );

    const cloned = gltf.scene.clone(true);
    cloned.rotation.set(0, slot.initialRotationY, 0);
    cloned.scale.setScalar(bounds.scale);
    cloned.position.set(bounds.posX, bounds.posY, bounds.posZ);

    const group = new THREE.Group();
    const records: ClonedMaterialRecord[] = [];

    cloned.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.renderOrder = 2;

        const cloneOneMat = (srcMat: THREE.Material) => {
          const m = srcMat.clone();
          const baseOpacity = m.opacity;
          const baseDepthWrite = m.depthWrite;
          m.transparent = true;
          if (m instanceof THREE.MeshStandardMaterial) {
            m.envMapIntensity = 1.0;
            if (m.map) m.map.anisotropy = 4;
            if (m.normalMap) m.normalMap.anisotropy = 4;
          }
          records.push({
            mat: m,
            baseOpacity,
            baseDepthWrite,
          });
          return m;
        };

        if (Array.isArray(obj.material)) {
          obj.material = obj.material.map(cloneOneMat);
        } else if (obj.material) {
          obj.material = cloneOneMat(obj.material);
        }
      }
    });

    group.add(cloned);
    group.updateMatrixWorld(true);
    return { wrapper: group, matRecords: records };
  }, [gltf.scene, slot.modelUrl, slot.initialRotationY, slot.defaultScale]);

  useEffect(() => {
    const slotId = slot.slotId;
    const contactMap = contactMapRef.current;
    const liveMap = livePoseMapRef.current;
    return () => {
      contactMap.delete(slotId);
      liveMap.delete(slotId);
      matRecords.forEach(({ mat }) => mat.dispose());
      pedestalUniqueMats.forEach((m) => m.dispose());
      shadowMat.dispose();
    };
  }, [
    contactMapRef,
    livePoseMapRef,
    matRecords,
    pedestalUniqueMats,
    shadowMat,
    slot.slotId,
  ]);

  const applyAlpha = useCallback(
    (alpha: number, allowSoftExitDepth = false, keepBoundWhenZero = false) => {
      const clamped = Math.max(0, Math.min(1, alpha));
      currentAlphaRef.current = clamped;

      const g = motionGroupRef.current;
      if (g) {
        g.visible = keepBoundWhenZero ? true : clamped > 0.002;
      }

      if (clamped >= 0.997) {
        if (!restoredOpaqueRef.current) {
          restoredOpaqueRef.current = true;
          for (const rec of matRecords) {
            rec.mat.opacity = rec.baseOpacity;
            rec.mat.depthWrite = rec.baseDepthWrite;
          }
          for (const pMat of pedestalUniqueMats) {
            pMat.opacity = 1;
            pMat.depthWrite = true;
          }
          shadowMat.opacity = 0.82;
        }
        return;
      }

      restoredOpaqueRef.current = false;
      const effectiveAlpha =
        keepBoundWhenZero && clamped < 0.0002 ? 0.0002 : clamped;
      const writeDepth =
        clamped > 0.01 && !(allowSoftExitDepth && clamped < 0.35);

      for (const rec of matRecords) {
        rec.mat.depthWrite = writeDepth;
        rec.mat.opacity = rec.baseOpacity * effectiveAlpha;
      }
      for (const pMat of pedestalUniqueMats) {
        pMat.depthWrite = writeDepth;
        pMat.opacity = effectiveAlpha;
      }
      shadowMat.opacity = 0.82 * effectiveAlpha;
    },
    [matRecords, pedestalUniqueMats, shadowMat]
  );

  // Synchronously initialize frame-0 pose on mount or in-place active->exiting role flip
  useLayoutEffect(() => {
    const g = motionGroupRef.current;
    if (!g) return;
    const currentSlot = slotRef.current;
    elapsedRef.current = 0;

    if (reducedMotion) {
      g.position.set(0, -0.92, 0);
      g.scale.setScalar(1);
      g.rotation.set(0, 0, 0);
      applyAlpha(role === "exiting" ? 0 : 1);
      contactMapRef.current.set(currentSlot.slotId, {
        alpha: role === "exiting" ? 0 : 1,
        y: -0.92,
        scale: 1,
      });
      if (role === "exiting" && !exitedFiredRef.current) {
        exitedFiredRef.current = true;
        onExited?.(currentSlot.slotId);
      } else if (role === "active" && !enteredFiredRef.current) {
        enteredFiredRef.current = true;
        onEntered?.(currentSlot.slotId);
      }
      return;
    }

    if (role === "exiting") {
      exitedFiredRef.current = false;
      const sp: LiveMeshPose = currentSlot.startPose ?? {
        x: g.position.x,
        y: g.position.y,
        z: g.position.z,
        rotY: g.rotation.y,
        scale: g.scale.x,
        alpha: currentAlphaRef.current,
      };
      exitStartPoseRef.current = sp;
      g.position.set(sp.x, sp.y, sp.z);
      g.scale.setScalar(sp.scale);
      g.rotation.set(0, sp.rotY, 0);
      applyAlpha(sp.alpha, false);
      contactMapRef.current.set(currentSlot.slotId, {
        alpha: sp.alpha,
        y: sp.y,
        scale: sp.scale,
      });
      return;
    }

    enteredFiredRef.current = false;
    exitStartPoseRef.current = null;

    // Active incoming mesh initial pose before entrance begins
    if (currentSlot.mode === "artifact") {
      g.position.set(0, -0.92 + 0.035, 0);
      g.scale.setScalar(0.84);
      g.rotation.set(0, currentSlot.dir * Math.PI * 0.88, 0);
    } else if (currentSlot.mode === "hypothesis") {
      const enterStartY = currentSlot.dir > 0 ? 0.46 : -0.46;
      g.position.set(0, -0.92 + enterStartY, 0);
      g.scale.setScalar(0.96);
      g.rotation.set(0, 0, 0);
    } else {
      g.position.set(0, -0.92 + 0.065, 0);
      g.scale.setScalar(0.93);
      g.rotation.set(0, -0.22, 0);
    }
    applyAlpha(0, false, true);
    contactMapRef.current.set(currentSlot.slotId, {
      alpha: 0,
      y: g.position.y,
      scale: g.scale.x,
    });
  }, [
    applyAlpha,
    contactMapRef,
    onEntered,
    onExited,
    reducedMotion,
    role,
    slot.slotId,
  ]);

  useFrame((_, rawDelta) => {
    const g = motionGroupRef.current;
    if (!g || reducedMotion) return;
    const currentSlot = slotRef.current;
    const delta = Math.min(rawDelta, 0.05);
    elapsedRef.current += delta;
    const elapsed = elapsedRef.current;

    if (role === "exiting") {
      const sp =
        exitStartPoseRef.current ??
        currentSlot.startPose ?? {
          x: 0,
          y: -0.92,
          z: 0,
          rotY: 0,
          scale: 1,
          alpha: 1,
        };
      const duration = currentSlot.mode === "artifact" ? 0.36 : 0.24;
      const t = Math.min(1, elapsed / duration);
      const smooth = t * t * (3 - 2 * t);

      let nextX = 0;
      let nextY = -0.92;
      let nextZ = 0;
      let nextRotY = 0;
      let nextScale = 1;
      let nextAlpha = 0;
      let behindActive = false;

      if (currentSlot.mode === "artifact") {
        // Phase 1: Current model accelerates into a 180° turntable spin & dissolves cleanly
        const spinEase = 0.28 * t + 0.72 * t * t;
        nextX = THREE.MathUtils.lerp(sp.x, 0, smooth);
        nextZ = THREE.MathUtils.lerp(sp.z, 0, smooth);
        nextY = THREE.MathUtils.lerp(sp.y, -0.92 + 0.03, smooth);
        nextRotY = sp.rotY - currentSlot.dir * Math.PI * spinEase;
        nextScale = sp.scale * (1 - 0.17 * smooth);
        const fadeT = THREE.MathUtils.clamp((t - 0.16) / 0.84, 0, 1);
        nextAlpha = sp.alpha * (1 - fadeT * fadeT * (3 - 2 * fadeT));
        behindActive = elapsed >= 0.28;
      } else {
        // Variant switch: snappy immediate glide of stone block + sculpture DOWN (dir > 0) or UP (dir < 0)
        const vertEase = 0.45 * t + 0.55 * t * t;
        const exitDeltaY = currentSlot.dir > 0 ? -0.44 : 0.44;
        nextX = THREE.MathUtils.lerp(sp.x, 0, smooth);
        nextZ = THREE.MathUtils.lerp(sp.z, 0, smooth);
        nextY = sp.y + exitDeltaY * vertEase;
        nextRotY = THREE.MathUtils.lerp(sp.rotY, 0, smooth);
        nextScale = sp.scale * (1 - 0.045 * smooth);
        nextAlpha = sp.alpha * (1 - smooth);
        behindActive = elapsed >= 0.08;
      }

      g.position.set(nextX, nextY, nextZ);
      g.rotation.set(0, nextRotY, 0);
      g.scale.setScalar(nextScale);
      applyAlpha(nextAlpha, behindActive);

      contactMapRef.current.set(currentSlot.slotId, {
        alpha: nextAlpha,
        y: nextY,
        scale: nextScale,
      });

      if (t >= 1 && !exitedFiredRef.current) {
        exitedFiredRef.current = true;
        contactMapRef.current.delete(currentSlot.slotId);
        onExited?.(currentSlot.slotId);
      }
      return;
    }

    // Active mesh choreography
    const entryDelay =
      currentSlot.mode === "artifact"
        ? currentSlot.hasPrecedingExit
          ? 0.28
          : 0
        : currentSlot.mode === "hypothesis"
          ? currentSlot.hasPrecedingExit
            ? 0.08
            : 0
          : 0;

    const duration =
      currentSlot.mode === "artifact"
        ? 0.54
        : currentSlot.mode === "hypothesis"
          ? 0.34
          : 0.48;

    if (elapsed < entryDelay) {
      // Keep buffers bound at near-zero opacity so there is zero GPU upload hitch when entry begins
      applyAlpha(0, false, true);
      livePoseMapRef.current.set(currentSlot.slotId, {
        x: g.position.x,
        y: g.position.y,
        z: g.position.z,
        rotY: g.rotation.y,
        scale: g.scale.x,
        alpha: 0,
      });
      contactMapRef.current.set(currentSlot.slotId, {
        alpha: 0,
        y: g.position.y,
        scale: g.scale.x,
      });
      return;
    }

    const u = THREE.MathUtils.clamp((elapsed - entryDelay) / duration, 0, 1);

    let targetY = -0.92;
    let targetRotY = 0;
    let targetScale = 1;
    let targetAlpha = 1;

    if (currentSlot.mode === "artifact") {
      // Phase 2: Next model appears & decelerates smoothly out of the turntable spin
      const easeSpin = 1 - Math.pow(1 - u, 3.8);
      const easeScale = 1 - Math.pow(1 - u, 3.4);
      targetY = -0.92 + 0.035 * (1 - easeScale);
      targetRotY = currentSlot.dir * (Math.PI * 0.88) * (1 - easeSpin);
      targetScale = 0.84 + 0.16 * easeScale;
      const fadeU = THREE.MathUtils.clamp(u / 0.44, 0, 1);
      targetAlpha = fadeU * fadeU * (3 - 2 * fadeU);
    } else if (currentSlot.mode === "hypothesis") {
      // Variant switch: crisp stone block + sculpture arrival FROM TOP (dir > 0) or FROM BOTTOM (dir < 0)
      const easeVert = 1 - Math.pow(1 - u, 3.2);
      const enterStartY = currentSlot.dir > 0 ? 0.46 : -0.46;
      targetY = -0.92 + enterStartY * (1 - easeVert);
      targetRotY = 0;
      targetScale = 0.96 + 0.04 * easeVert;
      const fadeU = THREE.MathUtils.clamp(u / 0.36, 0, 1);
      targetAlpha = fadeU * fadeU * (3 - 2 * fadeU);
    } else {
      const easeOut = 1 - Math.pow(1 - u, 4);
      targetY = -0.92 + 0.065 * (1 - easeOut);
      targetRotY = -0.22 * (1 - easeOut);
      targetScale = 0.93 + 0.07 * easeOut;
      const fadeU = THREE.MathUtils.clamp(u / 0.5, 0, 1);
      targetAlpha = fadeU * fadeU * (3 - 2 * fadeU);
    }

    if (pendingHint) {
      // Responsive anticipation if incoming network GLB is still downloading
      const kHold = 1 - Math.exp(-delta * 8);
      if (pendingHint.mode === "artifact") {
        targetRotY = THREE.MathUtils.lerp(
          g.rotation.y,
          -pendingHint.dir * 0.28,
          kHold
        );
        targetScale = THREE.MathUtils.lerp(g.scale.x, 0.96, kHold);
      } else {
        const holdY = -0.92 + (pendingHint.dir > 0 ? -0.06 : 0.06);
        targetY = THREE.MathUtils.lerp(g.position.y, holdY, kHold);
        targetScale = THREE.MathUtils.lerp(g.scale.x, 0.98, kHold);
      }
      targetAlpha = THREE.MathUtils.lerp(currentAlphaRef.current, 0.9, kHold);
    }

    g.position.set(0, targetY, 0);
    g.rotation.set(0, targetRotY, 0);
    g.scale.setScalar(targetScale);
    applyAlpha(targetAlpha, false);

    livePoseMapRef.current.set(currentSlot.slotId, {
      x: 0,
      y: targetY,
      z: 0,
      rotY: targetRotY,
      scale: targetScale,
      alpha: targetAlpha,
    });
    contactMapRef.current.set(currentSlot.slotId, {
      alpha: targetAlpha,
      y: targetY,
      scale: targetScale,
    });

    if (u >= 1 && !pendingHint && !enteredFiredRef.current) {
      enteredFiredRef.current = true;
      onEntered?.(currentSlot.slotId);
    }
  });

  return (
    <group
      ref={motionGroupRef}
      position={[0, -0.92, 0]}
      renderOrder={role === "exiting" ? 2 : 3}
    >
      <group visible={carryPedestal}>
        <mesh
          position={[0, -0.21, 0]}
          geometry={pedestalGeo}
          material={pedestalMaterials}
          receiveShadow
          renderOrder={0}
        />
        <mesh
          position={[0, 0.003, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[1.45, 1.12, 1]}
          geometry={shadowGeo}
          material={shadowMat}
          renderOrder={1}
        />
      </group>
      <primitive object={wrapper} />
    </group>
  );
}

/**
 * Smoothly interpolates rim light color, key-light transition swell, and
 * camera return framing during artifact transitions.
 */
function StageLightingAndCameraRig({
  rimLightColor,
  pulseSeq,
  cameraResetSeq,
  controlsRef,
  reducedMotion,
}: {
  rimLightColor: string;
  pulseSeq: number;
  cameraResetSeq: number;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  reducedMotion: boolean;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);
  const targetRimColorRef = useRef(new THREE.Color(rimLightColor));
  const swellRef = useRef(0);
  const cameraAnimatingRef = useRef(false);

  const canonicalPos = useMemo(() => new THREE.Vector3(0, 0.12, 4.78), []);
  const canonicalTarget = useMemo(() => new THREE.Vector3(0, -0.14, 0), []);

  useEffect(() => {
    targetRimColorRef.current.set(rimLightColor);
    invalidate();
  }, [invalidate, rimLightColor]);

  useEffect(() => {
    if (pulseSeq > 0 && !reducedMotion) {
      swellRef.current = 1;
      invalidate();
    }
  }, [invalidate, pulseSeq, reducedMotion]);

  useEffect(() => {
    if (cameraResetSeq === 0) return;
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    if (reducedMotion) {
      ctrl.target.copy(canonicalTarget);
      ctrl.object.position.copy(canonicalPos);
      ctrl.update();
      cameraAnimatingRef.current = false;
      invalidate();
      return;
    }
    cameraAnimatingRef.current = true;
    invalidate();
  }, [
    cameraResetSeq,
    canonicalPos,
    canonicalTarget,
    controlsRef,
    invalidate,
    reducedMotion,
  ]);

  // Cancel automatic camera glide immediately if the visitor grabs OrbitControls
  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const stopGlide = () => {
      cameraAnimatingRef.current = false;
    };
    ctrl.addEventListener("start", stopGlide);
    return () => {
      ctrl.removeEventListener("start", stopGlide);
    };
  }, [controlsRef]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const kColor = reducedMotion ? 1 : 1 - Math.exp(-delta * 5.5);
    let dirty = false;

    if (rimLightRef.current) {
      const dist =
        Math.abs(rimLightRef.current.color.r - targetRimColorRef.current.r) +
        Math.abs(rimLightRef.current.color.g - targetRimColorRef.current.g) +
        Math.abs(rimLightRef.current.color.b - targetRimColorRef.current.b);
      if (dist > 0.0008) {
        rimLightRef.current.color.lerp(targetRimColorRef.current, kColor);
        dirty = true;
      }
    }

    if (keyLightRef.current) {
      if (swellRef.current > 0.004) {
        swellRef.current *= Math.exp(-delta * 4.2);
        keyLightRef.current.intensity = 1.55 + 0.34 * swellRef.current;
        dirty = true;
      } else if (swellRef.current > 0) {
        swellRef.current = 0;
        keyLightRef.current.intensity = 1.55;
        dirty = true;
      }
    }

    if (cameraAnimatingRef.current && controlsRef.current) {
      const ctrl = controlsRef.current;
      const kCam = 1 - Math.exp(-delta * 6.8);
      ctrl.object.position.lerp(canonicalPos, kCam);
      ctrl.target.lerp(canonicalTarget, kCam);
      ctrl.update();
      dirty = true;

      if (
        ctrl.object.position.distanceToSquared(canonicalPos) < 0.00025 &&
        ctrl.target.distanceToSquared(canonicalTarget) < 0.00025
      ) {
        ctrl.object.position.copy(canonicalPos);
        ctrl.target.copy(canonicalTarget);
        ctrl.update();
        cameraAnimatingRef.current = false;
      }
    }

    if (dirty) {
      state.invalidate();
    }
  });

  return (
    <>
      <ambientLight intensity={0.42} color="#f5efe2" />
      <directionalLight
        ref={keyLightRef}
        position={[3.4, 5.2, 4.2]}
        intensity={1.55}
        color="#fff3dc"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0002}
      />
      <directionalLight
        ref={rimLightRef}
        position={[-3.8, 2.4, -2.5]}
        intensity={0.68}
        color={rimLightColor}
      />
      <spotLight
        position={[0, 4.6, -3.6]}
        intensity={0.9}
        angle={0.55}
        penumbra={0.8}
        color="#dcb879"
      />
    </>
  );
}

/**
 * Pure Three.js fallback ring inside <Suspense> on initial cold load
 * (never mounts a ReactDOM root inside R3F).
 */
function MeshSuspenseRing() {
  const ringRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 1.8;
    }
  });
  return (
    <mesh ref={ringRef} position={[0, 0.05, 0]}>
      <torusGeometry args={[0.26, 0.008, 12, 48, Math.PI * 1.4]} />
      <meshBasicMaterial color="#dcb879" transparent opacity={0.75} />
    </mesh>
  );
}

class StageErrorBoundary extends React.Component<
  { fallback: React.ReactNode; resetKey: string; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: {
    fallback: React.ReactNode;
    resetKey: string;
    children: React.ReactNode;
  }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export function ArtifactStage3D({
  artifactKey,
  artifactId,
  restoredModelUrl,
  transitionDirection = 1,
  preloadModelUrls,
  initialRotationY = -Math.PI / 2,
  defaultScale = 1,
  pedestalTint = "#b5ae9e",
  rimLightColor = "#dcb879",
  onOpenUpload,
}: ArtifactStage3DProps) {
  const resolvedArtifactId = artifactId ?? artifactKey;
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const { active: isGlobalAssetLoading } = useProgress();

  const slotCounterRef = useRef(1);
  const [displayedSlot, setDisplayedSlot] = useState<StageMeshSlot>(() => ({
    slotId: 1,
    artifactId: resolvedArtifactId,
    artifactKey,
    modelUrl: restoredModelUrl,
    initialRotationY,
    defaultScale,
    dir: 1,
    mode: "initial",
  }));
  const [exitingSlot, setExitingSlot] = useState<StageMeshSlot | null>(null);
  const [pendingSlot, setPendingSlot] = useState<StageMeshSlot | null>(null);
  const [isEnteringMotion, setIsEnteringMotion] = useState(true);
  const [pulseSeq, setPulseSeq] = useState(0);
  const [cameraResetSeq, setCameraResetSeq] = useState(0);
  const [showDelayedLoader, setShowDelayedLoader] = useState(false);
  const [prewarmUrls, setPrewarmUrls] = useState<string[]>([]);

  const displayedSlotRef = useRef(displayedSlot);
  displayedSlotRef.current = displayedSlot;
  const exitingSlotRef = useRef<StageMeshSlot | null>(null);
  exitingSlotRef.current = exitingSlot;
  const livePoseMapRef = useRef<Map<number, LiveMeshPose>>(new Map());
  const contactMapRef = useRef<Map<number, ContactSample>>(new Map());
  const latestPendingIdRef = useRef<number | null>(null);

  const isStageTransitioning =
    Boolean(pendingSlot) || Boolean(exitingSlot) || isEnteringMotion;
  const isTransitioningRef = useRef(isStageTransitioning);
  isTransitioningRef.current = isStageTransitioning;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Trigger smooth transition slot whenever artifactKey or restoredModelUrl changes
  useEffect(() => {
    const current = displayedSlotRef.current;

    if (
      restoredModelUrl === current.modelUrl &&
      artifactKey === current.artifactKey
    ) {
      if (
        initialRotationY !== current.initialRotationY ||
        defaultScale !== current.defaultScale
      ) {
        setDisplayedSlot((prev) => ({
          ...prev,
          initialRotationY,
          defaultScale,
        }));
      }
      return;
    }

    const mode: TransitionMode =
      resolvedArtifactId !== current.artifactId ? "artifact" : "hypothesis";

    // Glide camera back to canonical hero view when switching exhibits;
    // preserve visitor's orbited angle when comparing variants of the same model.
    if (mode === "artifact") {
      setCameraResetSeq((n) => n + 1);
    }

    // Immediate zero-waterfall fast-path when GLB is already warm in memory/VRAM
    if (
      restoredModelUrl === current.modelUrl ||
      warmModelUrls.has(restoredModelUrl)
    ) {
      const nextId = ++slotCounterRef.current;
      latestPendingIdRef.current = null;
      setPendingSlot(null);

      const livePose = livePoseMapRef.current.get(current.slotId);
      let hasPrecedingExit = false;
      if (!reducedMotion) {
        if (!livePose || livePose.alpha >= 0.05) {
          setExitingSlot({
            ...current,
            dir: transitionDirection,
            mode,
            startPose: livePose,
          });
          hasPrecedingExit = true;
        } else {
          livePoseMapRef.current.delete(current.slotId);
          hasPrecedingExit = Boolean(exitingSlotRef.current);
        }
      } else {
        setExitingSlot(null);
      }

      setDisplayedSlot({
        slotId: nextId,
        artifactId: resolvedArtifactId,
        artifactKey,
        modelUrl: restoredModelUrl,
        initialRotationY,
        defaultScale,
        dir: transitionDirection,
        mode,
        hasPrecedingExit,
      });
      setIsEnteringMotion(!reducedMotion);
      setPulseSeq((n) => n + 1);
      return;
    }

    const nextSlot: StageMeshSlot = {
      slotId: ++slotCounterRef.current,
      artifactId: resolvedArtifactId,
      artifactKey,
      modelUrl: restoredModelUrl,
      initialRotationY,
      defaultScale,
      dir: transitionDirection,
      mode,
    };
    latestPendingIdRef.current = nextSlot.slotId;
    setPendingSlot(nextSlot);
  }, [
    artifactKey,
    defaultScale,
    initialRotationY,
    reducedMotion,
    resolvedArtifactId,
    restoredModelUrl,
    transitionDirection,
  ]);

  const handlePendingReady = useCallback(
    (readySlot: StageMeshSlot) => {
      if (latestPendingIdRef.current !== readySlot.slotId) return;
      latestPendingIdRef.current = null;

      const outgoing = displayedSlotRef.current;
      const livePose = livePoseMapRef.current.get(outgoing.slotId);
      let hasPrecedingExit = false;

      if (!reducedMotion && outgoing.slotId !== readySlot.slotId) {
        if (!livePose || livePose.alpha >= 0.05) {
          setExitingSlot({
            ...outgoing,
            dir: readySlot.dir,
            mode: readySlot.mode,
            startPose: livePose,
          });
          hasPrecedingExit = true;
        } else {
          livePoseMapRef.current.delete(outgoing.slotId);
          hasPrecedingExit = Boolean(exitingSlotRef.current);
        }
      } else {
        setExitingSlot(null);
      }

      setDisplayedSlot({
        ...readySlot,
        hasPrecedingExit,
      });
      setPendingSlot(null);
      setIsEnteringMotion(!reducedMotion);
      setPulseSeq((n) => n + 1);
    },
    [reducedMotion]
  );

  const handleExited = useCallback((slotId: number) => {
    setExitingSlot((prev) => (prev?.slotId === slotId ? null : prev));
  }, []);

  const handleEntered = useCallback((slotId: number) => {
    if (displayedSlotRef.current.slotId === slotId) {
      setIsEnteringMotion(false);
    }
  }, []);

  // Debounce loading pill by 170ms so cached/preloaded transitions never flash a spinner
  useEffect(() => {
    const waiting = Boolean(pendingSlot) || isGlobalAssetLoading;
    if (!waiting) {
      setShowDelayedLoader(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setShowDelayedLoader(true);
    }, 170);
    return () => window.clearTimeout(timer);
  }, [pendingSlot, isGlobalAssetLoading]);

  // Early staggered preload + VRAM texture warm-up of sibling variations first, then neighbor exhibits
  useEffect(() => {
    if (!preloadModelUrls || preloadModelUrls.length === 0) return;
    let cancelled = false;
    const timers: number[] = [];

    const targets = preloadModelUrls
      .filter((u) => Boolean(u) && u !== restoredModelUrl)
      .slice(0, 4);

    targets.forEach((url, index) => {
      const t = window.setTimeout(() => {
        if (cancelled) return;
        useGLTF.preload(url);
        setPrewarmUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
      }, 220 + index * 180);
      timers.push(t);
    });

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [preloadModelUrls, restoredModelUrl]);

  const isHypothesisTransition =
    exitingSlot?.mode === "hypothesis" ||
    (displayedSlot.mode === "hypothesis" && isEnteringMotion) ||
    pendingSlot?.mode === "hypothesis";

  const renderedSlots =
    exitingSlot && exitingSlot.slotId !== displayedSlot.slotId
      ? [
          { slot: exitingSlot, role: "exiting" as const },
          { slot: displayedSlot, role: "active" as const },
        ]
      : [{ slot: displayedSlot, role: "active" as const }];

  return (
    <div
      data-stage-model={displayedSlot.modelUrl}
      data-stage-target-model={restoredModelUrl}
      data-stage-transitioning={isStageTransitioning ? "true" : "false"}
      className="relative flex h-full w-full flex-col items-center justify-end select-none"
    >
      {/* Main 3D Viewport */}
      <div className="relative w-full flex-1 min-h-[410px] sm:min-h-[480px] lg:min-h-0">
        {/* Editorial AI Reconstruction Callout */}
        <div className="pointer-events-none absolute right-0 top-[4.5%] z-20 hidden xl:flex flex-col items-start max-w-[188px]">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rotate-45 bg-[#dcb879]" />
            <span className="font-sans-ui text-[10px] font-medium uppercase tracking-[0.2em] text-[#dcb879]">
              AI Reconstruction
            </span>
          </div>
          <p className="mt-1 pl-3.5 font-editorial text-[13.5px] leading-[1.3] text-[#c8d2ce]">
            Based on visible details and historical patterns.
          </p>
          <svg
            width="68"
            height="22"
            viewBox="0 0 76 24"
            fill="none"
            aria-hidden="true"
            className="-ml-7 mt-0.5 opacity-70"
          >
            <path
              d="M74 2H26L2 22"
              stroke="rgba(220,184,121,0.5)"
              strokeWidth="0.9"
            />
          </svg>
        </div>

        {/* Debounced Pure React DOM loading badge outside R3F reconciler */}
        {showDelayedLoader && (
          <div className="pointer-events-none absolute left-1/2 top-5 z-20 -translate-x-1/2 flex items-center gap-2 rounded-full border border-[#dcb879]/35 bg-black/65 px-3.5 py-1.5 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-opacity duration-200">
            <span className="h-3 w-3 animate-spin rounded-full border-[1.75px] border-[#dcb879]/25 border-t-[#ebd09e]" />
            <span className="font-sans-ui text-[9.5px] uppercase tracking-[0.2em] text-[#ebd09e]">
              Loading 3D Relic
            </span>
          </div>
        )}

        {/* Three.js Interactive PBR Viewport */}
        <div className="absolute inset-y-0 inset-x-0 lg:-inset-x-10 xl:-inset-x-14">
          <StageErrorBoundary
            resetKey={restoredModelUrl}
            fallback={
              <div className="flex h-full w-full items-center justify-center p-6 text-center">
                <div className="max-w-xs rounded-xl border border-[#dcb879]/35 bg-black/60 p-5 backdrop-blur-md">
                  <p className="font-display text-base text-[#f3ede2]">
                    Unable to render 3D mesh
                  </p>
                  <p className="mt-1 font-editorial text-sm text-[#b7c5c1]">
                    Verify WebGL support or re-select the artifact model.
                  </p>
                </div>
              </div>
            }
          >
            <Canvas
              shadows
              frameloop={
                isStageTransitioning || isGlobalAssetLoading
                  ? "always"
                  : "demand"
              }
              dpr={[1, 1.75]}
              camera={{
                position: [0, 0.12, 4.78],
                fov: 35,
                near: 0.1,
                far: 40,
              }}
              gl={{
                powerPreference: "high-performance",
                antialias: true,
                alpha: true,
                stencil: false,
                preserveDrawingBuffer: false,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.08,
              }}
              className="h-full w-full cursor-grab active:cursor-grabbing"
            >
              <StudioEnvironment />
              <ShadowMapController activeMotion={isStageTransitioning} />

              <StageLightingAndCameraRig
                rimLightColor={rimLightColor}
                pulseSeq={pulseSeq}
                cameraResetSeq={cameraResetSeq}
                controlsRef={controlsRef}
                reducedMotion={reducedMotion}
              />

              <Suspense fallback={null}>
                <MuseumPedestal3D
                  tint={pedestalTint}
                  visible={!isHypothesisTransition}
                  reducedMotion={reducedMotion}
                />
              </Suspense>

              <PedestalContactShadow
                contactMapRef={contactMapRef}
                visible={!isHypothesisTransition}
              />

              {/* Background VRAM prewarmer for sibling variations & adjacent exhibits */}
              {prewarmUrls.map((url) =>
                url !== displayedSlot.modelUrl &&
                url !== exitingSlot?.modelUrl ? (
                  <Suspense key={`prewarm-${url}`} fallback={null}>
                    <PrewarmSingleGlb
                      modelUrl={url}
                      initialRotationY={initialRotationY}
                      defaultScale={defaultScale}
                      pausedRef={isTransitioningRef}
                    />
                  </Suspense>
                ) : null
              )}

              {/* Background preloader commits uncached incoming slot once GLB is parsed */}
              {pendingSlot && (
                <Suspense fallback={null}>
                  <PreloadAndCommitModel
                    key={pendingSlot.slotId}
                    modelUrl={pendingSlot.modelUrl}
                    onReady={() => handlePendingReady(pendingSlot)}
                  />
                </Suspense>
              )}

              {/* Unified slot list keyed by slotId so active -> exiting flips in-place with zero remount */}
              {renderedSlots.map((item) => (
                <Suspense
                  key={item.slot.slotId}
                  fallback={
                    item.role === "active" && !exitingSlot ? (
                      <MeshSuspenseRing />
                    ) : null
                  }
                >
                  <AnimatedArtifactMesh
                    slot={item.slot}
                    role={item.role}
                    pedestalTint={pedestalTint}
                    carryPedestal={isHypothesisTransition}
                    pendingHint={
                      item.role === "active" && pendingSlot
                        ? { mode: pendingSlot.mode, dir: pendingSlot.dir }
                        : null
                    }
                    livePoseMapRef={livePoseMapRef}
                    contactMapRef={contactMapRef}
                    reducedMotion={reducedMotion}
                    onExited={handleExited}
                    onEntered={handleEntered}
                  />
                </Suspense>
              ))}

              <OrbitControls
                ref={controlsRef}
                target={[0, -0.14, 0]}
                enableDamping
                dampingFactor={0.065}
                enablePan
                minDistance={2.2}
                maxDistance={7.4}
                maxPolarAngle={Math.PI * 0.58}
                minPolarAngle={Math.PI * 0.14}
              />
            </Canvas>
          </StageErrorBoundary>
        </div>

        {/* Golden "Upload Your Artifact" Pill CTA nestled right across the lower stone plinth base */}
        <div className="pointer-events-none absolute inset-x-0 bottom-1.5 sm:bottom-2.5 z-30 flex justify-center px-4">
          <button
            type="button"
            onClick={onOpenUpload}
            className="btn-gold-pill pointer-events-auto group flex w-full max-w-[365px] items-center justify-between rounded-full px-6 py-3.5 cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center text-[#2b200f]">
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </span>

            <span className="font-display text-[1.08rem] font-semibold tracking-[0.01em] text-[#23190b]">
              Upload Your Artifact
            </span>

            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#2b200f]/45 text-[#2b200f] transition-transform duration-200 group-hover:translate-x-0.5">
              <svg
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3.5 8H12.5M9 4.5L12.5 8L9 11.5" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
