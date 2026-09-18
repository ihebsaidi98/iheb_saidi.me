"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import {
  useEnvironment,
  type Environment,
} from "@/lib/environment";

/* ================= TYPES ================= */

type Pointer = {
  x: number;
  y: number;
};

/** Version-proof non-null ref (never attached to a DOM node). */
type PointerRef = {
  current: Pointer;
};

/* ================= SHADERS ================= */

const WAVE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uAmp;
  uniform float uPixelRatio;
  attribute float aScale;
  varying float vElev;

  void main() {
    vec3 p = position;
    float t = uTime;

    float e =
      sin(p.x * 0.55 + t * 0.9) *
      cos(p.z * 0.50 + t * 0.7) *
      0.55
      +
      sin(p.x * 1.40 - t * 0.6) *
      sin(p.z * 1.20 + t * 0.5) *
      0.22;

    p.y += e * uAmp;
    vElev = e;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    gl_Position = projectionMatrix * mv;

    gl_PointSize =
      uSize * aScale * uPixelRatio * (8.0 / -mv.z);
  }
`;

const WAVE_FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vElev;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;

    float alpha = smoothstep(0.5, 0.08, d);

    vec3 col = mix(
      uColorA,
      uColorB,
      clamp(vElev * 0.9 + 0.5, 0.0, 1.0)
    );

    gl_FragColor = vec4(col, alpha * 0.8);
  }
`;

const FRESNEL_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);

    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);

    gl_Position = projectionMatrix * mv;
  }
`;

const FRESNEL_FRAG = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uRim;
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    float fres = pow(
      1.0 - max(
        dot(normalize(vNormal), normalize(vView)),
        0.0
      ),
      2.4
    );

    float pulse = 0.8 + 0.2 * sin(uTime * 1.3);

    vec3 col = mix(uBase, uRim, fres) * (0.55 + fres * pulse);

    gl_FragColor = vec4(col, 0.92);
  }
`;

const ORBIT_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  uniform float uSize;
  uniform float uPixelRatio;

  attribute float aOffset;
  attribute float aSpeed;

  void main() {
    float a = aOffset + uTime * aSpeed;

    vec3 p = vec3(
      cos(a) * uRadius,
      sin(uTime * 0.7 + aOffset * 4.0) * 0.16,
      sin(a) * uRadius
    );

    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    gl_Position = projectionMatrix * mv;

    gl_PointSize = uSize * uPixelRatio * (8.0 / -mv.z);
  }
`;

const ORBIT_FRAG = /* glsl */ `
  uniform vec3 uColor;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;

    gl_FragColor = vec4(uColor, smoothstep(0.5, 0.1, d) * 0.9);
  }
`;

const GRID_VERT = /* glsl */ `
  varying vec3 vWorld;

  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);

    vWorld = w.xyz;

    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const GRID_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vWorld;

  void main() {
    vec2 coord = vWorld.xz * 0.45;

    vec2 g =
      abs(fract(coord - 0.5) - 0.5) / fwidth(coord);

    float line = 1.0 - min(min(g.x, g.y), 1.0);

    float fade = smoothstep(17.0, 4.0, length(vWorld.xz));

    gl_FragColor = vec4(uColor, line * fade * 0.32);
  }
`;

/* ================= HOOKS ================= */

function usePointer(enabled: boolean): PointerRef {
  const pointer = useRef<Pointer>({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;

    let raf = 0;

    const onMove = (event: PointerEvent) => {
      if (raf) return;

      raf = requestAnimationFrame(() => {
        pointer.current.x =
          event.clientX / window.innerWidth - 0.5;

        pointer.current.y =
          event.clientY / window.innerHeight - 0.5;

        raf = 0;
      });
    };

    window.addEventListener("pointermove", onMove, {
      passive: true,
    });

    return () => {
      window.removeEventListener("pointermove", onMove);

      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled]);

  return pointer;
}

function useVisible(
  ref: React.RefObject<HTMLElement | null>,
) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const element = ref.current;

    if (
      !element ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "150px 0px" },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return visible;
}

/* ================= SCENE PARTS ================= */

function CameraRig({
  pointer,
  mobile,
  reduceMotion,
}: {
  pointer: PointerRef;
  mobile: boolean;
  reduceMotion: boolean;
}) {
  useFrame(({ camera, clock }) => {
    if (reduceMotion) return;

    const t = clock.elapsedTime;

    const tx = mobile
      ? 0
      : pointer.current.x * 0.45 + Math.sin(t * 0.1) * 0.03;

    const ty = mobile
      ? 0
      : -pointer.current.y * 0.25 + Math.cos(t * 0.08) * 0.02;

    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      tx,
      0.04,
    );

    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      ty,
      0.04,
    );

    camera.lookAt(0, 0, -2);
  });

  return null;
}

function WaveField({
  lowPower,
  reduceMotion,
}: {
  lowPower: boolean;
  reduceMotion: boolean;
}) {
  const count = lowPower ? 90 : 140;

  /**
   * GPU resources are created in an effect, NOT useMemo.
   * This keeps create/dispose symmetric — StrictMode's
   * mount → cleanup → re-mount cycle can't reuse a
   * disposed geometry/material.
   */
  const [resources, setResources] = useState<{
    geometry: THREE.BufferGeometry;
    material: THREE.ShaderMaterial;
  } | null>(null);

  useEffect(() => {
    const total = count * count;

    const positions = new Float32Array(total * 3);
    const scales = new Float32Array(total);

    let i = 0;

    for (let x = 0; x < count; x++) {
      for (let z = 0; z < count; z++) {
        positions[i * 3] = (x / count - 0.5) * 28;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = (z / count - 0.5) * 28;

        scales[i] = 0.4 + Math.random();

        i++;
      }
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );

    geometry.setAttribute(
      "aScale",
      new THREE.BufferAttribute(scales, 1),
    );

    const material = new THREE.ShaderMaterial({
      vertexShader: WAVE_VERT,
      fragmentShader: WAVE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 4.2 },
        uAmp: { value: 1.1 },
        uPixelRatio: { value: 1 },
        uColorA: { value: new THREE.Color("#0f766e") },
        uColorB: { value: new THREE.Color("#67e8f9") },
      },
    });

    setResources({ geometry, material });

    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [count]);

  const pixelRatio = useThree((state) =>
    state.gl.getPixelRatio(),
  );

  useEffect(() => {
    if (!resources) return;

    resources.material.uniforms.uPixelRatio.value = pixelRatio;
  }, [resources, pixelRatio]);

  useFrame(({ clock }) => {
    if (!resources || reduceMotion) return;

    resources.material.uniforms.uTime.value =
      clock.elapsedTime;
  });

  if (!resources) return null;

  return (
    <points
      geometry={resources.geometry}
      material={resources.material}
      position={[0, -1.6, -3]}
      frustumCulled={false}
    />
  );
}

function Core({ env }: { env: Environment }) {
  const group = useRef<THREE.Group>(null);

  const [materials, setMaterials] = useState<{
    fresnel: THREE.ShaderMaterial;
    wire: THREE.MeshBasicMaterial;
  } | null>(null);

  useEffect(() => {
    const fresnel = new THREE.ShaderMaterial({
      vertexShader: FRESNEL_VERT,
      fragmentShader: FRESNEL_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uBase: { value: new THREE.Color("#022c22") },
        uRim: { value: new THREE.Color("#5eead4") },
      },
    });

    const wire = new THREE.MeshBasicMaterial({
      color: "#34d399",
      wireframe: true,
      transparent: true,
      opacity: 0.13,
    });

    setMaterials({ fresnel, wire });

    return () => {
      fresnel.dispose();
      wire.dispose();
    };
  }, []);

  useFrame(({ clock }) => {
    if (!materials || env.reduceMotion) return;

    const t = clock.elapsedTime;

    materials.fresnel.uniforms.uTime.value = t;

    if (group.current) {
      const scale =
        (env.mobile ? 0.85 : 1.25) *
        (1 + Math.sin(t * 0.9) * 0.03);

      group.current.scale.setScalar(scale);
    }
  });

  if (!materials) return null;

  return (
    <group
      ref={group}
      position={
        env.mobile
          ? [0, 1.1, -4.2]
          : [2.8, 0.2, -2.6]
      }
      scale={env.mobile ? 0.85 : 1.25}
    >
      <mesh material={materials.fresnel}>
        <sphereGeometry args={[1, 48, 48]} />
      </mesh>

      <mesh
        material={materials.wire}
        rotation={[0.4, 0.2, 0]}
      >
        <icosahedronGeometry args={[1.34, 1]} />
      </mesh>
    </group>
  );
}

function OrbitRing({ env }: { env: Environment }) {
  const count = env.lowPower ? 140 : 260;

  const [resources, setResources] = useState<{
    geometry: THREE.BufferGeometry;
    material: THREE.ShaderMaterial;
  } | null>(null);

  useEffect(() => {
    const offsets = new Float32Array(count);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      offsets[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.22 + Math.random() * 0.18;
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(count * 3), 3),
    );

    geometry.setAttribute(
      "aOffset",
      new THREE.BufferAttribute(offsets, 1),
    );

    geometry.setAttribute(
      "aSpeed",
      new THREE.BufferAttribute(speeds, 1),
    );

    const material = new THREE.ShaderMaterial({
      vertexShader: ORBIT_VERT,
      fragmentShader: ORBIT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uRadius: { value: 1.95 },
        uSize: { value: 3.6 },
        uPixelRatio: { value: 1 },
        uColor: { value: new THREE.Color("#7dd3fc") },
      },
    });

    setResources({ geometry, material });

    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [count]);

  const pixelRatio = useThree((state) =>
    state.gl.getPixelRatio(),
  );

  useEffect(() => {
    if (!resources) return;

    resources.material.uniforms.uPixelRatio.value = pixelRatio;
  }, [resources, pixelRatio]);

  useFrame(({ clock }) => {
    if (!resources || env.reduceMotion) return;

    resources.material.uniforms.uTime.value =
      clock.elapsedTime;
  });

  if (!resources) return null;

  return (
    <points
      geometry={resources.geometry}
      material={resources.material}
      position={
        env.mobile
          ? [0, 1.1, -4.2]
          : [2.8, 0.2, -2.6]
      }
      scale={env.mobile ? 0.85 : 1.25}
      frustumCulled={false}
    />
  );
}

function GridFloor() {
  const [material, setMaterial] =
    useState<THREE.ShaderMaterial | null>(null);

  useEffect(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader: GRID_VERT,
      fragmentShader: GRID_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color("#2dd4bf") },
      },
    });

    setMaterial(material);

    return () => material.dispose();
  }, []);

  if (!material) return null;

  return (
    <mesh
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -2.4, -3]}
    >
      <planeGeometry args={[40, 40]} />
    </mesh>
  );
}

/* ================= SCENE ================= */

function Scene({
  env,
  pointer,
}: {
  env: Environment;
  pointer: PointerRef;
}) {
  return (
    <>
      <CameraRig
        pointer={pointer}
        mobile={env.mobile}
        reduceMotion={env.reduceMotion}
      />

      <WaveField
        lowPower={env.lowPower || env.mobile}
        reduceMotion={env.reduceMotion}
      />

      <GridFloor />

      <Core env={env} />

      <OrbitRing env={env} />
    </>
  );
}

/* ================= FALLBACK ================= */

function Fallback() {
  return (
    <div
      aria-hidden="true"
      className="
        absolute
        inset-0
        overflow-hidden
        bg-[#04070c]
      "
    >
      <div
        className="
          absolute
          left-[62%]
          top-[42%]
size-[42vw] max-w-[420px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          bg-emerald-400/[0.05]
          blur-[100px]
        "
      />

      <div
        className="
          absolute
          left-[62%]
          top-[42%]
size-[26vw] max-w-[260px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          border
          border-emerald-300/10
        "
      />

      <div
        className="
          absolute
          left-[62%]
          top-[42%]
size-[16vw] max-w-[160px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          border
          border-cyan-300/[0.07]
        "
      />

      <div
        className="
          absolute
          bottom-0
          left-0
          right-0
          h-64
          bg-gradient-to-t
          from-[#04070c]
          to-transparent
        "
      />
    </div>
  );
}

function ReadabilityOverlay() {
  return (
    <>
      <div
        aria-hidden="true"
        className="
          absolute
          inset-0
          bg-[radial-gradient(circle_at_66%_42%,transparent_8%,rgba(4,7,12,0.25)_50%,rgba(4,7,12,0.85)_100%)]
        "
      />

      <div
        aria-hidden="true"
        className="
          absolute
          inset-y-0
          left-0
          w-[62%]
          bg-gradient-to-r
          from-[#04070c]
          via-[#04070c]/80
          to-transparent
        "
      />
    </>
  );
}

/* ================= PUBLIC ================= */

export default function HeroScene3D() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const visible = useVisible(wrapperRef);

  const env = useEnvironment();

  /**
   * Hydration guard:
   * Server + first client paint must render identical output.
   * `useEnvironment` returns SERVER_ENV during SSR (webgl: false),
   * while the client's first real snapshot may be webgl: true —
   * branching on `env.webgl` alone causes a hydration mismatch.
   * We render the fallback until mounted, then commit the truth.
   */
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showCanvas = mounted && env.webgl;

  const pointer = usePointer(
    showCanvas &&
    !env.mobile &&
    !env.reduceMotion &&
    visible,
  );

  const frameloop: "always" | "demand" | "never" =
    !visible
      ? "never"
      : env.reduceMotion
        ? "demand"
        : "always";

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className="
        pointer-events-none
        absolute
        inset-0
        z-0
      "
    >
      {showCanvas ? (
        <Canvas
          frameloop={frameloop}
          camera={{
            position: [0, 0.4, 8],
            fov: env.mobile ? 55 : 45,
            near: 0.1,
            far: 40,
          }}
          dpr={
            env.mobile || env.lowPower
              ? 1
              : [1, 1.5]
          }
          gl={{
            alpha: true,
            antialias: !env.mobile && !env.lowPower,
            powerPreference: "high-performance",
            stencil: false,
            depth: true,
          }}
          style={{
            position: "absolute",
            inset: 0,
          }}
        >
          <Scene env={env} pointer={pointer} />
        </Canvas>
      ) : (
        <Fallback />
      )}

      <ReadabilityOverlay />
    </div>
  );
}