import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

import { BASE, CUES, HERO_CHIP, SEQ, type Shot } from "./cues";
import { allInGeometry, cardGeometry, chipGeometry, TRI_SIDE } from "./geometry";
import { buildPile, type ChipRest } from "./layout";
import { Sound } from "./sound";
import { buildStudioEnvironment } from "./studio";
import { BOX, BOXES, feltGeometry, inlayGeometries, railGeometry, TABLE, trackGeometry } from "./table";
import {
  allInTextures,
  backgroundTexture,
  cardBackTextures,
  CHIP_STYLES,
  chipTextures,
  feltTextures,
  gridTexture,
  kingTextures,
  woodTexture,
} from "./textures";
import { THEME } from "@/lib/theme";

export type Callout = { el: HTMLElement; line: SVGLineElement; key: "chips" | "cards" | "allin"; side: "l" | "r" };
export type FrameState = { seq: number; labels: number; scrollY: number };

type Flyer = {
  mesh: THREE.Mesh;
  rest: THREE.Vector3;
  restQ: THREE.Quaternion;
  start: THREE.Vector3;
  ctrl: THREE.Vector3;
  t0: number;
  dur: number;
  order: number;
  lift: THREE.Vector3;
};

const FOV = 26;
const DEG = Math.PI / 180;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const UP = new THREE.Vector3(0, 1, 0);

// Финальный проход: виньетка и плёночное зерно поверх готовой картинки.
const GrainShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 0.035 }, uVig: { value: 0.42 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmount; uniform float uVig; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float v = smoothstep(0.95, 0.28, length(vUv - 0.5));
      c.rgb *= mix(1.0 - uVig, 1.0, v);
      float n = hash(vUv * vec2(1387.0, 911.0) + fract(uTime) * 61.0) - 0.5;
      c.rgb += n * uAmount;
      gl_FragColor = c;
    }`,
};

export class Engine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 5, 6000);
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private grain!: ShaderPass;
  private sound = new Sound();

  private chips: ChipRest[] = [];
  private chipSlot: { mesh: THREE.InstancedMesh; index: number }[] = [];
  private chipMeshes: THREE.InstancedMesh[] = [];
  private cards: Flyer[] = [];
  private tri!: Flyer;
  private felt!: THREE.Mesh;
  private anchors: Record<Callout["key"], THREE.Vector3>;
  private callouts: Callout[] = [];

  private blueprint = false;
  private realMaterials = new Map<THREE.Object3D, THREE.Material | THREE.Material[]>();
  private wireMat = new THREE.MeshBasicMaterial({ color: 0x9fd0ff, wireframe: true, transparent: true, opacity: 0.28 });
  private gridMat!: THREE.MeshBasicMaterial;

  // единые часы и состояние
  private time = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  private seq = 0;
  private prevSeq = 0;
  private shot: Shot = { ...BASE };
  private cueY: { y: number; shot: Shot }[] = [];
  private stageTop = 0;
  private stageLen = 1;
  private w = 1;
  private h = 1;
  private pointer = new THREE.Vector2();
  private pointerSm = new THREE.Vector2();
  private shake = 0;
  private burstT = -1;
  private first = true;

  // адаптивное качество
  private baseRatio = 1;
  private scale = 1;
  private fpsFrames = 0;
  private fpsTime = 0;
  private lockQuality = false;

  onFrame: ((s: FrameState) => void) | null = null;
  private bgTexture!: THREE.Texture;

  constructor(private canvas: HTMLCanvasElement) {
    this.lockQuality = new URLSearchParams(location.search).get("q") === "lock";
    const mobile = matchMedia("(max-width: 820px), (pointer: coarse)").matches;
    this.baseRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(this.baseRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.bgTexture = backgroundTexture();
    this.scene.background = this.bgTexture;
    this.scene.environment = buildStudioEnvironment(this.renderer);
    this.scene.environmentIntensity = 1.15;

    this.buildLights();
    this.buildTable();
    this.buildChips(mobile ? 40 : 56);
    const a = this.buildCardsAndButton();
    this.anchors = a;
    this.buildPost();

    this.resize();
    this.measure();
    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onPointer, { passive: true });
    document.addEventListener("visibilitychange", this.onVisibility);
    (window as unknown as { __poker: Engine }).__poker = this;
  }

  /* ───────────────────────────── сборка сцены ───────────────────────────── */

  private buildLights() {
    // Прожектор над столом: световое пятно на сукне и тени под фишками
    const key = new THREE.SpotLight(0xfff0dc, 2.9, 0, 0.66, 1, 0);
    key.position.set(-170, 540, 250);
    key.target.position.set(0, 0, 30);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 250;
    key.shadow.camera.far = 1100;
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.35;
    key.shadow.radius = 5;
    this.scene.add(key, key.target);

    const rim = new THREE.DirectionalLight(0xffd29a, 1.1);
    rim.position.set(260, 150, -320);
    this.scene.add(rim);

    const cool = new THREE.DirectionalLight(0xbfd4ff, 0.35);
    cool.position.set(-300, 120, -100);
    this.scene.add(cool);
  }

  private buildTable() {
    const { a, felt: r } = TABLE;
    const w = (a + r) * 2;
    const h = r * 2;
    const { fade, bump } = feltTextures(w, h, a, r, BOX.line, BOX, BOXES);
    const table = new THREE.Group();
    table.position.z = TABLE.z;

    const feltMat = new THREE.MeshPhysicalMaterial({
      color: THEME.felt.color,
      map: fade,
      roughness: 0.96,
      metalness: 0,
      bumpMap: bump,
      bumpScale: 0.6,
      sheen: 1,
      sheenRoughness: 0.55,
      sheenColor: new THREE.Color(THEME.felt.sheen),
      sheenColorMap: fade,
      specularIntensity: 0.15,
    });
    this.felt = new THREE.Mesh(feltGeometry(), feltMat);
    this.felt.receiveShadow = true;
    table.add(this.felt);

    // Дорожка: тёмный орех под лаком — в ней отражаются полосы студийного света
    const wood = new THREE.MeshPhysicalMaterial({
      map: woodTexture(),
      roughness: 0.38,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      side: THREE.DoubleSide,
    });
    const gold = new THREE.MeshPhysicalMaterial({ color: THEME.goldMetal, metalness: 1, roughness: 0.2, side: THREE.DoubleSide });
    const leatherBump = bump.clone();
    leatherBump.repeat.set(60, 3);
    leatherBump.needsUpdate = true;
    const leather = new THREE.MeshPhysicalMaterial({
      color: THEME.leather.color,
      roughness: 0.5,
      bumpMap: leatherBump,
      bumpScale: 0.35,
      clearcoat: 0.25,
      clearcoatRoughness: 0.45,
      sheen: 0.4,
      sheenColor: new THREE.Color(THEME.leather.sheen),
      side: THREE.DoubleSide,
    });

    const parts: [THREE.BufferGeometry, THREE.Material][] = [
      [trackGeometry(), wood],
      [railGeometry(), leather],
      ...inlayGeometries().map((g): [THREE.BufferGeometry, THREE.Material] => [g, gold]),
    ];
    for (const [geo, mat] of parts) {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      table.add(m);
      this.tableParts.push(m);
    }
    this.scene.add(table);
    this.gridMat = new THREE.MeshBasicMaterial({ map: gridTexture() });
  }
  private tableParts: THREE.Mesh[] = [];

  private buildChips(segments: number) {
    const { chips, stackTop } = buildPile(7);
    chips[0].style = 0; // фишка с заставки — чёрная с золотом
    chips[0].start.set(HERO_CHIP.x, HERO_CHIP.y, HERO_CHIP.z);
    chips[0].ctrl.copy(chips[0].start).lerp(chips[0].pos, 0.5).setY(HERO_CHIP.y + 40);
    this.chips = chips;
    this.stackTop.copy(stackTop);

    const geo = chipGeometry(segments);
    CHIP_STYLES.forEach((style, s) => {
      const count = chips.filter((c) => c.style === s).length;
      const tex = chipTextures(style);
      const mat = new THREE.MeshPhysicalMaterial({
        map: tex.map,
        roughnessMap: tex.orm,
        metalnessMap: tex.orm,
        roughness: 1,
        metalness: 1,
        clearcoat: 0.1,
        clearcoatRoughness: 0.55,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.chipMeshes.push(mesh);
      this.scene.add(mesh);
    });
    const next = CHIP_STYLES.map(() => 0);
    this.chipSlot = chips.map((c) => ({ mesh: this.chipMeshes[c.style], index: next[c.style]++ }));
  }
  private stackTop = new THREE.Vector3();

  private buildCardsAndButton() {
    const edge = new THREE.MeshPhysicalMaterial({ color: 0xece6d8, roughness: 0.55 });
    const back = cardBackTextures();
    const backMat = new THREE.MeshPhysicalMaterial({
      map: back.map,
      roughnessMap: back.orm,
      metalnessMap: back.orm,
      roughness: 1,
      metalness: 1,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
    });
    const geo = cardGeometry();

    const card = (kind: "spade" | "heart", x: number, y: number, z: number, yaw: number, t0: number, i: number): Flyer => {
      const tex = kingTextures(kind);
      const face = new THREE.MeshPhysicalMaterial({
        map: tex.map,
        roughnessMap: tex.orm,
        metalnessMap: tex.orm,
        roughness: 1,
        metalness: 1,
        clearcoat: 0.35,
        clearcoatRoughness: 0.3,
      });
      const mesh = new THREE.Mesh(geo, [face, backMat, edge]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      const rest = new THREE.Vector3(x, y, z);
      const start = new THREE.Vector3(x + 330 + i * 60, 70 + i * 30, z + 330);
      const ctrl = start.clone().lerp(rest, 0.5).setY(150);
      return {
        mesh,
        rest,
        restQ: new THREE.Quaternion().setFromAxisAngle(UP, yaw),
        start,
        ctrl,
        t0,
        dur: SEQ.cardDur,
        order: 0.9 + i * 0.04,
        lift: new THREE.Vector3(x * 1.6, 150 + i * 46, 30),
      };
    };
    this.cards = [card("spade", -21, 0.02, 82, 0.17, SEQ.cardA, 0), card("heart", 23, 0.38, 86, -0.21, SEQ.cardB, 1)];

    // Кнопка ALL-IN: лаковая эмаль на лице, полированное золото на фаске
    const tex = allInTextures(TRI_SIDE);
    const lacquer = new THREE.MeshPhysicalMaterial({
      map: tex.map,
      roughnessMap: tex.orm,
      metalnessMap: tex.orm,
      roughness: 1,
      metalness: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    });
    const gold = new THREE.MeshPhysicalMaterial({ color: THEME.goldMetal, metalness: 1, roughness: 0.14 });
    const triMesh = new THREE.Mesh(allInGeometry(), [lacquer, lacquer, gold]);
    triMesh.castShadow = true;
    triMesh.receiveShadow = true;
    triMesh.frustumCulled = false;
    this.scene.add(triMesh);
    const rest = new THREE.Vector3(6, 0.74, 158);
    this.tri = {
      mesh: triMesh,
      rest,
      restQ: new THREE.Quaternion().setFromAxisAngle(UP, -0.1),
      start: new THREE.Vector3(40, 250, 230),
      ctrl: new THREE.Vector3(20, 190, 170),
      t0: SEQ.tri,
      dur: SEQ.triDur,
      order: 1,
      lift: new THREE.Vector3(0, 250, -60),
    };

    return {
      chips: this.stackTop.clone(),
      cards: new THREE.Vector3(23, 1, 70),
      allin: new THREE.Vector3(6, 6, 166),
    };
  }

  private buildPost() {
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Высокий порог: светятся только блики на золоте и лаке
    this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.24, 0.5, 1.25);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass()); // ACES + sRGB
    this.grain = new ShaderPass(GrainShader);
    this.composer.addPass(this.grain);
  }

  /* ───────────────────────────── управление ───────────────────────────── */

  /** Прогревает все шейдеры за лоадером, чтобы первый кадр не дёргался. */
  async ready() {
    this.pose(0);
    await this.renderer.compileAsync(this.scene, this.camera);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  setCallouts(list: Callout[]) {
    this.callouts = list;
  }

  setSound(on: boolean) {
    this.sound.setEnabled(on);
  }

  setBlueprint(on: boolean) {
    if (on === this.blueprint) return;
    this.blueprint = on;
    const meshes: THREE.Mesh[] = [...this.chipMeshes, ...this.cards.map((c) => c.mesh), this.tri.mesh, ...this.tableParts];
    for (const m of meshes) {
      if (on) {
        this.realMaterials.set(m, m.material);
        m.material = this.wireMat;
      } else {
        m.material = this.realMaterials.get(m)!;
      }
      m.castShadow = !on;
    }
    if (on) {
      this.realMaterials.set(this.felt, this.felt.material);
      this.felt.material = this.gridMat;
    } else {
      this.felt.material = this.realMaterials.get(this.felt)!;
    }
    this.scene.background = on ? new THREE.Color(0x040d1a) : this.bgTexture;
  }

  /** Подбросить всю кучу (после удержания кнопки). */
  burst() {
    this.burstT = 0;
  }

  /** Включает наклон телефона. Вызывается из обработчика жеста. */
  enableTilt() {
    const D = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    const listen = () => window.addEventListener("deviceorientation", this.onTilt, { passive: true });
    if (D && typeof D.requestPermission === "function") {
      D.requestPermission().then((r) => r === "granted" && listen()).catch(() => {});
    } else if (D && matchMedia("(pointer: coarse)").matches) {
      listen();
    }
  }

  /** Мгновенно привести сцену к текущему скроллу (для проверок и первого кадра). */
  snap() {
    this.first = true;
    this.frame(performance.now());
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointermove", this.onPointer);
    window.removeEventListener("deviceorientation", this.onTilt);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
        mat.dispose();
      }
    });
    this.scene.environment?.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  /* ───────────────────────────── события ───────────────────────────── */

  private onResize = () => {
    this.resize();
    this.measure();
  };

  private onPointer = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    this.pointer.set((e.clientX / this.w) * 2 - 1, (e.clientY / this.h) * 2 - 1);
  };

  private onTilt = (e: DeviceOrientationEvent) => {
    if (e.gamma == null || e.beta == null) return;
    this.pointer.set(THREE.MathUtils.clamp(e.gamma / 30, -1, 1), THREE.MathUtils.clamp((e.beta - 45) / 30, -1, 1));
  };

  private onVisibility = () => {
    this.last = performance.now();
  };

  private resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.renderer.setPixelRatio(this.baseRatio * this.scale);
    this.renderer.setSize(this.w, this.h, false);
    this.composer.setPixelRatio(this.baseRatio * this.scale);
    this.composer.setSize(this.w, this.h);
    this.camera.aspect = this.w / this.h;
  }

  /** Пересчитывает, на каком пикселе скролла стоит каждый кадр сценария. */
  measure() {
    const vh = window.innerHeight;
    const aspect = this.w / this.h;
    const portrait = aspect < 0.85;
    const side = clamp01((aspect - 0.85) / 0.4); // боковой сдвиг только на широких экранах
    const list: { y: number; shot: Shot }[] = [];
    for (const cue of CUES) {
      const el = document.querySelector<HTMLElement>(`[data-cue="${cue.sec}"]`);
      if (!el) continue;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const y = top + (cue.f ?? 0.5) * (el.offsetHeight - vh);
      const shot = { ...BASE, ...cue.shot, ...(portrait ? cue.mobile : null) };
      // На почти квадратных окнах сцене тесно рядом с текстом — отъезжаем
      if (shot.ox !== 0 && !portrait) shot.frame *= 1 + clamp01((1.7 - aspect) / 0.8) * 0.3;
      shot.ox *= side;
      list.push({ y, shot });
      if (cue.sec === "stage" && cue.f === 0) {
        this.stageTop = top;
        this.stageLen = Math.max(1, el.offsetHeight - vh);
      }
    }
    this.cueY = list.sort((a, b) => a.y - b.y);
  }

  /* ───────────────────────────── кадр ───────────────────────────── */

  private tick = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    this.frame(now);
  };

  private frame(now: number) {
    const rawDt = (now - this.last) / 1000;
    const dt = Math.min(0.05, Math.max(0, rawDt));
    this.last = now;
    this.time += dt; // одни часы на всё, что движется

    const y = window.scrollY;
    const target = this.blend(y);
    const seqTarget = clamp01((y - this.stageTop) / this.stageLen);

    if (this.first) {
      this.shot = { ...target };
      this.seq = this.prevSeq = seqTarget;
      this.pointerSm.copy(this.pointer);
      this.first = false;
    } else {
      const k = 1 - Math.exp(-dt * 4.2);
      for (const key of Object.keys(target) as (keyof Shot)[]) this.shot[key] += (target[key] - this.shot[key]) * k;
      this.seq += (seqTarget - this.seq) * (1 - Math.exp(-dt * 6.5));
      this.pointerSm.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    }

    if (this.burstT >= 0) {
      this.burstT += dt;
      if (this.burstT > 0.55 && this.burstT < 1.5) this.sound.click(0.55);
      if (this.burstT > 2) this.burstT = -1;
    }

    this.pose(this.shot.explode);
    this.events();
    this.placeCamera(dt);
    this.placeCallouts();

    this.renderer.toneMappingExposure = (this.blueprint ? 1 : 1.08) * (1 - this.shot.dim * 0.6);
    this.grain.uniforms.uTime.value = this.time;
    this.composer.render(dt);

    this.onFrame?.({ seq: this.seq, labels: this.shot.labels, scrollY: y });
    this.prevSeq = this.seq;
    if (rawDt < 0.25) this.adapt(rawDt);
  }

  private blend(y: number): Shot {
    const c = this.cueY;
    if (!c.length) return BASE;
    if (y <= c[0].y) return c[0].shot;
    for (let i = 0; i < c.length - 1; i++) {
      const a = c[i];
      const b = c[i + 1];
      if (y < b.y) {
        const t = smooth(clamp01((y - a.y) / Math.max(1, b.y - a.y)));
        const out = { ...a.shot };
        for (const key of Object.keys(out) as (keyof Shot)[]) out[key] = a.shot[key] + (b.shot[key] - a.shot[key]) * t;
        return out;
      }
    }
    return c[c.length - 1].shot;
  }

  /* ───────────────────────────── позы деталей ───────────────────────────── */

  private m4 = new THREE.Matrix4();
  private p = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private q2 = new THREE.Quaternion();
  private s1 = new THREE.Vector3(1, 1, 1);
  private s0 = new THREE.Vector3(0, 0, 0);
  private v = new THREE.Vector3();

  private bezier(out: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number) {
    const i = 1 - t;
    return out.set(
      i * i * a.x + 2 * i * t * b.x + t * t * c.x,
      i * i * a.y + 2 * i * t * b.y + t * t * c.y,
      i * i * a.z + 2 * i * t * b.z + t * t * c.z,
    );
  }

  /** «Разбор»: верхние детали уходят первыми и возвращаются последними. */
  private liftAmount(explode: number, order: number) {
    const delay = (1 - order) * 0.42;
    return smooth(clamp01((explode - delay) / 0.58));
  }

  private hop(order: number) {
    if (this.burstT < 0) return 0;
    return clamp01((this.burstT - order * 0.4) / 0.8);
  }

  private pose(explode: number) {
    const { p, q, q2 } = this;
    const seq = this.seq;

    for (let i = 0; i < this.chips.length; i++) {
      const c = this.chips[i];
      const slot = this.chipSlot[i];
      const hero = i === 0;
      const t0 = hero ? 0.004 : SEQ.chipsFrom + c.order * SEQ.chipsSpan;
      const dur = hero ? 0.2 : SEQ.chipDur;
      const u = (seq - t0) / dur;

      if (u <= 0 && !hero) {
        // ждёт своей очереди в стопке внутри бокса
        this.m4.compose(c.start, c.startQuat, this.s1);
        slot.mesh.setMatrixAt(slot.index, this.m4);
        continue;
      }

      const e = clamp01(u);
      const t = 1 - Math.pow(1 - e, 1.7);
      this.bezier(p, c.start, c.ctrl, c.pos, t);
      q.copy(c.startQuat).slerp(c.quat, smooth(t));
      q2.setFromAxisAngle(c.axis, c.turns * Math.PI * 2 * smooth(t));
      q.multiply(q2);

      if (hero) {
        // На заставке фишка висит и медленно вращается, как монета
        const idle = 1 - smooth(clamp01(u * 1.6));
        if (idle > 0) {
          q2.setFromAxisAngle(UP, this.time * 0.42 + this.pointerSm.x * 0.7);
          this.q3.setFromAxisAngle(this.xAxis, Math.PI / 2 - 0.2 + this.pointerSm.y * 0.25);
          q2.multiply(this.q3);
          q.slerp(q2, idle);
          p.y += Math.sin(this.time * 0.9) * 2.2 * idle;
        }
      }

      if (u > 1) {
        const k = clamp01((u - 1) / 0.45);
        p.y += c.bounce * (1 - k) * (1 - k) * Math.abs(Math.sin(k * Math.PI * 2));
      }

      const lift = this.liftAmount(explode, c.order);
      if (lift > 0) {
        p.addScaledVector(c.lift, lift);
        p.y += Math.sin(this.time * 1.1 + c.phase) * 3 * lift;
        q2.setFromAxisAngle(c.axis, lift * 1.2 + Math.sin(this.time * 0.5 + c.phase) * 0.18 * lift);
        q.multiply(q2);
      }

      const hop = this.hop(c.order);
      if (hop > 0 && hop < 1) {
        p.y += Math.sin(hop * Math.PI) * (26 + (c.phase / 6.28) * 46);
        q2.setFromAxisAngle(c.axis, Math.PI * 2 * smooth(hop));
        q.multiply(q2);
      }

      this.m4.compose(p, q, this.s1);
      slot.mesh.setMatrixAt(slot.index, this.m4);
    }
    for (const m of this.chipMeshes) m.instanceMatrix.needsUpdate = true;

    // Карты: летят справа, вращаясь, и переворачиваются лицом вверх
    for (const c of this.cards) {
      const u = (seq - c.t0) / c.dur;
      c.mesh.visible = u > 0;
      if (u <= 0) continue;
      const e = clamp01(u);
      const t = 1 - Math.pow(1 - e, 2);
      this.bezier(p, c.start, c.ctrl, c.rest, t);
      const rem = Math.pow(1 - t, 1.2);
      q.setFromAxisAngle(UP, -Math.PI * 2.2 * rem).multiply(c.restQ);
      q2.setFromAxisAngle(this.zAxis, Math.PI * 3 * rem);
      q.multiply(q2);
      if (u > 1) {
        const k = clamp01((u - 1) / 0.3);
        p.y += 1.6 * (1 - k) * Math.abs(Math.sin(k * Math.PI));
      }
      this.liftFlyer(c, explode);
      c.mesh.position.copy(p);
      c.mesh.quaternion.copy(q);
    }

    // Кнопка ALL-IN: падает сверху с ускорением и припечатывает всё
    {
      const c = this.tri;
      const u = (seq - c.t0) / c.dur;
      c.mesh.visible = u > 0;
      if (u > 0) {
        const e = clamp01(u);
        const t = Math.pow(e, 2.3);
        this.bezier(p, c.start, c.ctrl, c.rest, t);
        const rem = 1 - smooth(e);
        q.copy(c.restQ);
        q2.setFromAxisAngle(this.v.set(1, 0, 0.35).normalize(), 0.95 * rem);
        q.multiply(q2);
        q2.setFromAxisAngle(UP, 1.4 * rem);
        q.premultiply(q2);
        if (u > 1) {
          const k = clamp01((u - 1) / 0.5);
          p.y += 5 * (1 - k) * (1 - k) * Math.abs(Math.sin(k * Math.PI * 2));
        }
        this.liftFlyer(c, explode);
        c.mesh.position.copy(p);
        c.mesh.quaternion.copy(q);
      }
    }
  }
  private q3 = new THREE.Quaternion();
  private xAxis = new THREE.Vector3(1, 0, 0);
  private zAxis = new THREE.Vector3(0, 0, 1);

  private liftFlyer(c: Flyer, explode: number) {
    const { p, q, q2 } = this;
    const lift = this.liftAmount(explode, c.order);
    if (lift > 0) {
      p.addScaledVector(c.lift, lift);
      p.y += Math.sin(this.time * 0.9 + c.order * 9) * 3 * lift;
      q2.setFromAxisAngle(this.v.set(1, 0, 0.3).normalize(), lift * (0.75 + Math.sin(this.time * 0.4 + c.order * 5) * 0.08));
      q.multiply(q2);
    }
    const hop = this.hop(c.order);
    if (hop > 0 && hop < 1) p.y += Math.sin(hop * Math.PI) * 22;
  }

  /** События «в такт»: звук срабатывает, когда прокрутка проходит момент приземления. */
  private events() {
    const a = this.prevSeq;
    const b = this.seq;
    if (b <= a) return;
    const crossed = (t: number) => a < t && t <= b;
    for (const c of this.chips) {
      if (crossed(SEQ.chipsFrom + c.order * SEQ.chipsSpan + SEQ.chipDur)) this.sound.click(0.6 + c.order * 0.4);
    }
    for (const c of this.cards) if (crossed(c.t0 + c.dur * 0.35)) this.sound.swish();
    if (crossed(this.tri.t0 + this.tri.dur)) {
      this.sound.thud();
      this.shake = 1;
    }
  }

  /* ───────────────────────────── камера ───────────────────────────── */

  private target = new THREE.Vector3();
  private euler = new THREE.Euler();

  private placeCamera(dt: number) {
    const s = this.shot;
    const aspect = this.w / this.h;
    // Кадрируем по размеру: «уместить N мм», поэтому сценарий одинаково
    // работает на телефоне и на мониторе.
    const dist = s.frame / (2 * Math.tan((FOV * DEG) / 2)) / Math.min(1, aspect);
    const drift = Math.sin(this.time * 0.13) * 1.6 * (s.dim > 0.05 ? 1 : 0.4);
    const az = (s.azim + drift) * DEG + this.pointerSm.x * 0.07;
    const el = THREE.MathUtils.clamp(s.elev * DEG - this.pointerSm.y * 0.035, 0.03, 1.5);

    this.shake = Math.max(0, this.shake - dt * 3.2);
    const sh = this.shake * this.shake * 2.4;
    this.target.set(s.tx + Math.sin(this.time * 91) * sh, s.ty + Math.cos(this.time * 77) * sh, s.tz);

    this.camera.position.set(
      this.target.x + dist * Math.cos(el) * Math.sin(az),
      this.target.y + dist * Math.sin(el),
      this.target.z + dist * Math.cos(el) * Math.cos(az),
    );
    this.camera.lookAt(this.target);
    this.camera.setViewOffset(this.w, this.h, -s.ox * this.w, -s.oy * this.h, this.w, this.h);

    // Курсор (или наклон телефона) вращает студию — блики бегут по золоту
    this.euler.set(this.pointerSm.y * 0.3, -this.pointerSm.x * 0.8 + this.time * 0.02, 0);
    this.scene.environmentRotation.copy(this.euler);
  }

  /* ───────────────────────────── выноски ───────────────────────────── */

  private placeCallouts() {
    const a = this.shot.labels;
    if (!this.callouts.length) return;
    const show = a > 0.02 ? a : 0;
    const rows = { l: 0, r: 0 };
    for (const c of this.callouts) {
      c.el.style.opacity = String(show);
      c.line.style.opacity = String(show * 0.7);
      if (show <= 0) continue;
      this.v.copy(this.anchors[c.key]).project(this.camera);
      const x = (this.v.x * 0.5 + 0.5) * this.w;
      const y = (-this.v.y * 0.5 + 0.5) * this.h;
      // две ровные колонки по краям, строки не налезают друг на друга
      const narrow = this.w < 720;
      const colX = c.side === "l" ? this.w * (narrow ? 0.05 : 0.09) : this.w * (narrow ? 0.95 : 0.91);
      const rowY = Math.max(this.h * 0.2 + rows[c.side] * 96, Math.min(this.h * 0.8, y - 46));
      rows[c.side]++;
      c.el.style.transform = `translate(${colX}px, ${rowY}px) translate(${c.side === "l" ? "0" : "-100%"}, -50%)`;
      const edge = c.side === "l" ? colX + c.el.offsetWidth + 12 : colX - c.el.offsetWidth - 12;
      c.line.setAttribute("x1", String(edge));
      c.line.setAttribute("y1", String(rowY));
      c.line.setAttribute("x2", String(x));
      c.line.setAttribute("y2", String(y));
    }
  }

  /* ───────────────────────────── качество ───────────────────────────── */

  private adapt(dt: number) {
    if (this.lockQuality || document.hidden) return;
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime < 1.6) return;
    const fps = this.fpsFrames / this.fpsTime;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    if (this.time < 3 || fps >= 40) return;
    // Сначала снижаем разрешение, и только потом отключаем свечение
    if (this.scale > 0.62) {
      this.scale -= 0.14;
      this.resize();
    } else if (this.bloom.enabled) {
      this.bloom.enabled = false;
    }
  }
}

