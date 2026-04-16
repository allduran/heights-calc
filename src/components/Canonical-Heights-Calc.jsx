import { useState } from "react";

// ─── DATA ────────────────────────────────────────────────────────────────────

const ANIMATION_TYPES = [
  {
    id: "vault",
    label: "Vault",
    icon: "↗",
    desc: "Saltar por encima con apoyo de mano",
    color: "#F5A623",
    ranges: { min: 0.5, max: 1.1, sweet: [0.7, 0.9] },
    blenderTips: [
      "Root bone inicia en suelo, arco alto en frame 8–12",
      "Mano de apoyo: IK target a height + 0.02m sobre el obstáculo",
      "Root Motion: desplazamiento forward ~1.5× obstacle depth",
    ],
    unityTips: [
      "Two Bone IK en mano dominante para corrección en runtime",
      "Trigger collider al 80% de la altura como activation zone",
      "Blend Tree: Idle → VaultApproach → VaultOver → Land",
    ],
    phases: ["Approach", "Plant", "Push", "Flight", "Land"],
  },
  {
    id: "climb_low",
    label: "Climb bajo",
    icon: "↑",
    desc: "Escalar con impulso (tipo MGS)",
    color: "#5BC8A8",
    ranges: { min: 1.1, max: 1.6, sweet: [1.2, 1.4] },
    blenderTips: [
      "Ambas manos tocan borde: IK targets a height exacta",
      "Hip dip pronunciado al 40% de la animación",
      "Root sube gradualmente — no pop al final",
    ],
    unityTips: [
      "Two Bone IK en ambas manos con weight fade in/out",
      "Ledge grab collider: altura del borde ± 0.05m tolerancia",
      "Animation Rigging: Chain IK en torso para lean forward",
    ],
    phases: ["Approach", "Jump", "Grab", "Pull", "Mount"],
  },
  {
    id: "climb_high",
    label: "Climb alto",
    icon: "⬆",
    desc: "Escalar con agarre y colgarse",
    color: "#60A5FA",
    ranges: { min: 1.6, max: 2.4, sweet: [1.8, 2.2] },
    blenderTips: [
      "Personaje queda colgado — root en nivel del borde",
      "Stretch en spine al colgarse: +5–8% en escala Y",
      "Pull-up: concentrar esfuerzo en frames 15–25 de 40",
    ],
    unityTips: [
      "Estado Hanging separado con blend hacia ClimbUp",
      "Raycast hacia abajo desde manos para detectar borde",
      "Override layer para upper body mientras cuelga",
    ],
    phases: ["Run", "Jump", "Hang", "Pull", "Climb", "Mount"],
  },
  {
    id: "crouch_pass",
    label: "Agacharse / pasar",
    icon: "↙",
    desc: "Pasar bajo obstáculos o entrar en cobertura",
    color: "#C084FC",
    ranges: { min: 0.8, max: 1.2, sweet: [0.9, 1.1] },
    blenderTips: [
      "Hip height baja a ~0.55× altura normal del personaje",
      "Head clearance: top of head = obstacle height − 0.05m",
      "Loop suave: crouch walk con cycle de 0.6s",
    ],
    unityTips: [
      "Capsule collider dinámico: altura reducida al hacer crouch",
      "NavMesh: área Crouch con cost ×1.5 para pathfinding",
      "Animator: Bool isCrouching con AnyState transition",
    ],
    phases: ["Detect", "Crouch", "Move", "Exit"],
  },
  {
    id: "slide",
    label: "Slide",
    icon: "→",
    desc: "Deslizarse por debajo a velocidad",
    color: "#F472B6",
    ranges: { min: 0.6, max: 1.0, sweet: [0.7, 0.9] },
    blenderTips: [
      "Root Motion forward: 2.0–2.5m en 20–25 frames",
      "Hip casi a ras del suelo en punto más bajo: ~0.2m",
      "Inercia visible: lean back al inicio, forward al salir",
    ],
    unityTips: [
      "CapsuleCollider height = 0.6m durante slide",
      "Trigger: activar solo si velocidad > umbral (e.g. 4 m/s)",
      "Cancela al presionar jump: blend to roll o stand",
    ],
    phases: ["Run", "Drop", "Slide", "Rise"],
  },
  {
    id: "roll",
    label: "Roll / dodge",
    icon: "○",
    desc: "Rodar para esquivar o caída segura",
    color: "#34D399",
    ranges: { min: 0.0, max: 0.5, sweet: [0.0, 0.3] },
    blenderTips: [
      "Root describe un arco — no traslación lineal",
      "Shoulder contact en frame 6–8; rodilla en 12–14",
      "Duración total: 20–24 frames a 24fps",
    ],
    unityTips: [
      "iFrames: Physics layer swap durante 0.3–0.4s",
      "Root Motion solo en Y (absorbe caída), manual en XZ",
      "Trigger desde fall height > 2m ó input direccional",
    ],
    phases: ["Tuck", "Roll", "Rise"],
  },
];

const CHARACTER_PRESETS = [
  { label: "Estándar (1.75m)", height: 1.75 },
  { label: "Compacto (1.65m)", height: 1.65 },
  { label: "Alto (1.85m)", height: 1.85 },
];

// ─── VISUAL BAR ───────────────────────────────────────────────────────────────

function HeightBar({ anim, characterHeight, obstacleHeight }) {
  const maxH = Math.max(characterHeight * 1.1, anim.ranges.max + 0.2);
  const pct = (h) => ((h / maxH) * 100).toFixed(1);

  const inRange = obstacleHeight >= anim.ranges.min && obstacleHeight <= anim.ranges.max;
  const inSweet = obstacleHeight >= anim.ranges.sweet[0] && obstacleHeight <= anim.ranges.sweet[1];

  return (
    <div style={{ position: "relative", height: 160, width: 48, flexShrink: 0 }}>
      {/* Track */}
      <div style={{
        position: "absolute", left: "50%", transform: "translateX(-50%)",
        width: 10, height: "100%", background: "#1A1B24", borderRadius: 5,
      }} />

      {/* Range band */}
      <div style={{
        position: "absolute",
        left: "50%", transform: "translateX(-50%)",
        width: 10,
        bottom: `${pct(anim.ranges.min)}%`,
        height: `${pct(anim.ranges.max) - pct(anim.ranges.min)}%`,
        background: anim.color + "33",
        borderRadius: 3,
      }} />

      {/* Sweet spot */}
      <div style={{
        position: "absolute",
        left: "50%", transform: "translateX(-50%)",
        width: 10,
        bottom: `${pct(anim.ranges.sweet[0])}%`,
        height: `${pct(anim.ranges.sweet[1]) - pct(anim.ranges.sweet[0])}%`,
        background: anim.color + "88",
        borderRadius: 3,
      }} />

      {/* Character height line */}
      <div style={{
        position: "absolute",
        left: "50%", transform: "translateX(-50%)",
        width: 22, height: 1.5, background: "#777575",
        bottom: `${pct(characterHeight)}%`,
      }} />

      {/* Obstacle height indicator */}
      {obstacleHeight > 0 && (
        <div style={{
          position: "absolute",
          left: "50%", transform: "translateX(-50%)",
          width: 26, height: 2,
          background: inSweet ? anim.color : inRange ? anim.color + "88" : "#E87B5A",
          bottom: `${pct(obstacleHeight)}%`,
          transition: "bottom 0.2s, background 0.2s",
          borderRadius: 1,
          boxShadow: inSweet ? `0 0 6px ${anim.color}` : "none",
        }} />
      )}
    </div>
  );
}

// ─── ANIMATION CARD ───────────────────────────────────────────────────────────

function AnimCard({ anim, characterHeight, obstacleHeight }) {
  const [tab, setTab] = useState("blender");
  const inRange = obstacleHeight >= anim.ranges.min && obstacleHeight <= anim.ranges.max;
  const inSweet = obstacleHeight >= anim.ranges.sweet[0] && obstacleHeight <= anim.ranges.sweet[1];

  const status = obstacleHeight <= 0 ? "idle"
    : inSweet ? "sweet"
    : inRange ? "ok"
    : "out";

  const statusColor = { idle: "#444", sweet: anim.color, ok: anim.color + "99", out: "#E87B5A" };
  const statusLabel = { idle: "—", sweet: "SWEET SPOT", ok: "VÁLIDO", out: "FUERA DE RANGO" };

  return (
    <div style={{
      background: "#10111A",
      border: `1px solid ${status === "sweet" ? anim.color + "66" : status === "out" ? "#E87B5A33" : "#1C1D27"}`,
      borderRadius: 10,
      overflow: "hidden",
      transition: "border-color 0.3s",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid #1A1B24",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ fontSize: 32, color: anim.color }}>{anim.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#E8E6DF", letterSpacing: 0.5 }}>{anim.label}</div>
          <div style={{ fontSize: 16, color: "#777575", marginTop: 1 }}>{anim.desc}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, letterSpacing: 2, color: statusColor[status] }}>{statusLabel[status]}</div>
          <div style={{ fontSize: 14, color: "#777575", marginTop: 2 }}>
            {anim.ranges.min}–{anim.ranges.max}m
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px", display: "flex", gap: 16, alignItems: "flex-start" }}>
        <HeightBar anim={anim} characterHeight={characterHeight} obstacleHeight={obstacleHeight} />

        <div style={{ flex: 1 }}>
          {/* Measurements */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8, marginBottom: 14,
          }}>
            {[
              { label: "Mín", value: anim.ranges.min + "m" },
              { label: "Sweet", value: anim.ranges.sweet[0] + "–" + anim.ranges.sweet[1] + "m" },
              { label: "Máx", value: anim.ranges.max + "m" },
            ].map((m) => (
              <div key={m.label} style={{
                background: "#0D0E16",
                border: "1px solid #1C1D27",
                borderRadius: 6, padding: "8px 10px",
              }}>
                <div style={{ fontSize: 24, color: "#777575", letterSpacing: 1, marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: 16, color: anim.color, fontWeight: 700 }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* % of character */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 24, color: "#cdcdcd", letterSpacing: 2, marginBottom: 6 }}>% DE ALTURA DEL PERSONAJE</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["min", "sweet_lo", "sweet_hi", "max"].map((k) => {
                const v = k === "sweet_lo" ? anim.ranges.sweet[0]
                  : k === "sweet_hi" ? anim.ranges.sweet[1]
                  : anim.ranges[k];
                const p = Math.round((v / characterHeight) * 100);
                return (
                  <div key={k} style={{
                    fontSize: 16, color: "#c8c8c8",
                    background: "#0D0E16",
                    borderRadius: 4, padding: "3px 7px",
                  }}>
                    {p}%
                  </div>
                );
              })}
            </div>
          </div>

          {/* Phases */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 24, color: "#c3c3c3", letterSpacing: 2, marginBottom: 6 }}>FASES</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {anim.phases.map((ph, i) => (
                <span key={ph} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{
                    fontSize: 16, color: anim.color + "BB",
                    background: anim.color + "11",
                    borderRadius: 4, padding: "2px 7px",
                  }}>{ph}</span>
                  {i < anim.phases.length - 1 && <span style={{ color: "#8d8d8d", fontSize: 16 }}>→</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div>
            <div style={{ display: "flex", gap: 0, marginBottom: 8 }}>
              {["blender", "unity"].map((t) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  background: tab === t ? "#1A1B26" : "transparent",
                  border: "1px solid #1C1D27",
                  borderRadius: t === "blender" ? "4px 0 0 4px" : "0 4px 4px 0",
                  color: tab === t ? anim.color : "#444",
                  fontSize: 12, letterSpacing: 2,
                  padding: "4px 10px",
                  cursor: "pointer",
                  textTransform: "uppercase",
                }}>
                  {t === "blender" ? "⬡ Blender" : "▶ Unity"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {(tab === "blender" ? anim.blenderTips : anim.unityTips).map((tip, i) => (
                <div key={i} style={{
                  fontSize: 16, color: "#afafaf",
                  padding: "5px 9px",
                  background: "#0D0E16",
                  borderRadius: 5,
                  borderLeft: `2px solid ${anim.color}44`,
                  lineHeight: 1.5,
                }}>
                  {tip}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function CanonicalHeightsCalc() {
  const [characterHeight, setCharacterHeight] = useState(1.75);
  const [obstacleHeight, setObstacleHeight] = useState(0);
  const [obstacleInput, setObstacleInput] = useState("");
  const [filter, setFilter] = useState("all");

  const compatible = ANIMATION_TYPES.filter(
    (a) => obstacleHeight >= a.ranges.min && obstacleHeight <= a.ranges.max
  );

  const displayed = filter === "all" ? ANIMATION_TYPES
    : filter === "compatible" ? compatible
    : ANIMATION_TYPES.filter((a) => a.id === filter);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0B12",
      fontFamily: "'Courier New', Courier, monospace",
      color: "#C0BFCC",
      padding: "24px 16px 48px",
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 16, letterSpacing: 4, color: "#5BC8A8", marginBottom: 6 }}>
            ANIMATION REFERENCE
          </div>
          <h1 style={{
            fontSize: 32, fontWeight: 700, color: "#EDEAE0",
            margin: "0 0 4px", letterSpacing: -0.5,
          }}>
            Alturas Canónicas de Obstáculos
          </h1>
          <p style={{ fontSize: 16, color: "#848484", margin: 0 }}>
            Vault · Climb · Slide · Roll · Crouch — Unity 6 / Blender
          </p>
        </div>

        {/* Controls */}
        <div style={{
          background: "#10111A",
          border: "1px solid #1C1D27",
          borderRadius: 10,
          padding: "18px 20px",
          marginBottom: 24,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
        }}>
          {/* Character height */}
          <div>
            <div style={{ fontSize: 16, letterSpacing: 3, color: "#b3b3b3", marginBottom: 10 }}>
              ALTURA DEL PERSONAJE
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {CHARACTER_PRESETS.map((p) => (
                <button key={p.height} onClick={() => setCharacterHeight(p.height)} style={{
                  background: characterHeight === p.height ? "#1E2030" : "transparent",
                  border: `1px solid ${characterHeight === p.height ? "#5BC8A8" : "#1C1D27"}`,
                  borderRadius: 5,
                  color: characterHeight === p.height ? "#5BC8A8" : "#777575",
                  fontSize: 12, padding: "5px 10px",
                  cursor: "pointer",
                }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="range" min={1.0} max={2.0} step={0.01}
                value={characterHeight}
                onChange={(e) => setCharacterHeight(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: "#5BC8A8" }}
              />
              <span style={{ fontSize: 24, fontWeight: 700, color: "#5BC8A8", minWidth: 50 }}>
                {characterHeight.toFixed(2)}m
              </span>
            </div>
          </div>

          {/* Obstacle height */}
          <div>
            <div style={{ fontSize: 16, letterSpacing: 3, color: "#b3b3b3", marginBottom: 10 }}>
              ALTURA DEL OBSTÁCULO
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                type="number" min={0} max={3} step={0.05}
                value={obstacleInput}
                placeholder="ej. 0.85"
                onChange={(e) => {
                  setObstacleInput(e.target.value);
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 0) setObstacleHeight(v);
                }}
                style={{
                  flex: 1, background: "#0D0E16", border: "1px solid #1C1D27",
                  borderRadius: 6, color: "#E8C547", fontSize: 16,
                  padding: "8px 12px", fontFamily: "inherit", outline: "none",
                }}
              />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#E8C547", alignSelf: "center" }}>m</span>
            </div>
            <input
              type="range" min={0} max={2.8} step={0.05}
              value={obstacleHeight}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setObstacleHeight(v);
                setObstacleInput(v.toFixed(2));
              }}
              style={{ width: "100%", accentColor: "#E8C547" }}
            />

            {/* Compatible badge */}
            {obstacleHeight > 0 && (
              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {compatible.length === 0
                  ? <span style={{ fontSize: 10, color: "#E87B5A" }}>Sin animaciones compatibles</span>
                  : compatible.map((a) => (
                    <span key={a.id} style={{
                      fontSize: 9, color: a.color,
                      background: a.color + "11",
                      border: `1px solid ${a.color}33`,
                      borderRadius: 4, padding: "2px 8px",
                    }}>{a.label}</span>
                  ))
                }
              </div>
            )}
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          <button onClick={() => setFilter("all")} style={{
            background: filter === "all" ? "#1A1B26" : "transparent",
            border: `1px solid ${filter === "all" ? "#5BC8A8" : "#1C1D27"}`,
            borderRadius: 5, color: filter === "all" ? "#5BC8A8" : "#777575",
            fontSize: 12, letterSpacing: 2, padding: "5px 12px", cursor: "pointer",
          }}>TODOS</button>
          {obstacleHeight > 0 && (
            <button onClick={() => setFilter("compatible")} style={{
              background: filter === "compatible" ? "#1A1B26" : "transparent",
              border: `1px solid ${filter === "compatible" ? "#E8C547" : "#1C1D27"}`,
              borderRadius: 5, color: filter === "compatible" ? "#E8C547" : "#777575",
              fontSize: 12, letterSpacing: 2, padding: "5px 12px", cursor: "pointer",
            }}>COMPATIBLES ({compatible.length})</button>
          )}
          {ANIMATION_TYPES.map((a) => (
            <button key={a.id} onClick={() => setFilter(a.id)} style={{
              background: filter === a.id ? "#1A1B26" : "transparent",
              border: `1px solid ${filter === a.id ? a.color : "#1C1D27"}`,
              borderRadius: 5, color: filter === a.id ? a.color : "#777575",
              fontSize: 12, letterSpacing: 1, padding: "5px 10px", cursor: "pointer",
            }}>{a.icon} {a.label}</button>
          ))}
        </div>

        {/* Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {displayed.map((anim) => (
            <AnimCard
              key={anim.id}
              anim={anim}
              characterHeight={characterHeight}
              obstacleHeight={obstacleHeight}
            />
          ))}
        </div>

        {/* Legend */}
        <div style={{
          marginTop: 28, padding: "14px 18px",
          background: "#10111A", border: "1px solid #1C1D27",
          borderRadius: 8, display: "flex", gap: 20, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 16, color: "#8c8c8c", letterSpacing: 2, alignSelf: "center" }}>LEYENDA</span>
          {[
            { color: "#33334499", label: "Rango válido" },
            { color: "#5BC8A888", label: "Sweet spot" },
            { color: "#777575", label: "Altura personaje" },
            { color: "#E87B5A", label: "Fuera de rango" },
          ].map((l) => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 12, height: 4, background: l.color, borderRadius: 2 }} />
              <span style={{ fontSize: 16, color: "#777575" }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
