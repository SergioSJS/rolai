import { useState } from "react";
import type { SystemProfile } from "@rolai/rules-engine";
import type { DeckConfig } from "@rolai/deck-engine";
import type {
  DiceStyle,
  DiceStyles,
  QualityTier,
  ThemeName,
} from "../settings";
import {
  DEFAULT_DICE_STYLES,
  DICE_MATERIALS,
  DICE_MATERIAL_LABELS,
  DICE_PRESETS,
  DICE_TEXTURES,
  DICE_TEXTURE_FILES,
  DICE_TEXTURE_LABELS,
  QUALITY_TIERS,
  QUALITY_TIER_LABELS,
  THEMES,
  THEME_LABELS,
} from "../settings";
import type { DiceMaterial, DiceTexture } from "../settings";
import { familyFor, familyMemberSystems, PROFILE_FAMILIES } from "../profileFamilies";
import { CardsIcon, DiceSectionIcon, RenderIcon, RulesIcon, StreamIcon } from "./Glyphs";

interface SettingsPanelProps {
  tier: QualityTier;
  theme: ThemeName;
  diceStyles?: DiceStyles;
  diceStyle?: DiceStyle;
  diceScale: number;
  system: string;
  profiles: SystemProfile[];
  deckConfig: DeckConfig;
  onTierChange: (tier: QualityTier) => void;
  onThemeChange: (theme: ThemeName) => void;
  onDiceStylesChange?: (styles: DiceStyles) => void;
  onDiceStyleChange?: (style: DiceStyle) => void;
  onDiceScaleChange: (scale: number) => void;
  onSystemChange: (system: string) => void;
  onDeckConfigChange: (changes: Partial<DeckConfig>) => void;
}

// Contorno do numero na previa: sombra nas 4 direcoes com a cor escolhida.
function outlineShadow(color: string): string {
  return `-1px 0 0 ${color}, 1px 0 0 ${color}, 0 -1px 0 ${color}, 0 1px 0 ${color}`;
}

export function SettingsPanel({
  tier,
  theme,
  diceStyles,
  diceStyle,
  diceScale,
  system,
  profiles,
  deckConfig,
  onTierChange,
  onThemeChange,
  onDiceStylesChange,
  onDiceStyleChange,
  onDiceScaleChange,
  onSystemChange,
  onDeckConfigChange,
}: SettingsPanelProps) {
  const [activeSlot, setActiveSlot] = useState<"1" | "2" | "3">("1");

  const styles: DiceStyles = diceStyles ?? {
    "1": diceStyle ?? DEFAULT_DICE_STYLES["1"],
    "2": DEFAULT_DICE_STYLES["2"],
    "3": DEFAULT_DICE_STYLES["3"],
  };

  const currentDiceStyle = styles[activeSlot] ?? DEFAULT_DICE_STYLES[activeSlot];
  const activePreset = DICE_PRESETS.find(
    (p) =>
      p.style.body === currentDiceStyle.body &&
      p.style.number === currentDiceStyle.number &&
      p.style.texture === currentDiceStyle.texture &&
      p.style.material === currentDiceStyle.material,
  );

  const handleCurrentStyleChange = (next: DiceStyle) => {
    const updated: DiceStyles = { ...styles, [activeSlot]: next };
    onDiceStylesChange?.(updated);
    if (activeSlot === "1") {
      onDiceStyleChange?.(next);
    }
  };

  // Profiles que sao member de alguma familia (ex.: os 3 modos do
  // Infaernum) nao aparecem soltos no dropdown principal — so a familia,
  // uma vez. Selecionar a familia escolhe o PRIMEIRO member; o sub-seletor
  // abaixo troca entre os modos sem sair da familia.
  const grouped = familyMemberSystems();
  const standalone = profiles
    .filter((p) => !grouped.has(p.system))
    .map((p) => ({
      key: p.system,
      label: p.label,
      targetSystem: p.system,
    }));
  const families = PROFILE_FAMILIES.map((family) => ({
    key: family.key,
    label: family.label,
    targetSystem: family.members[0]!.system,
  }));
  const sortedSystems = [...standalone, ...families].sort((a, b) =>
    a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }),
  );
  const activeFamily = familyFor(system);

  return (
    <div className="settings-panel">
      <h3>
        <RulesIcon />
        Sistema
      </h3>
      <div className="settings-row">
        <label>
          Regras da mesa
          <select
            value={activeFamily?.key ?? system}
            onChange={(e) => {
              const selected = sortedSystems.find((item) => item.key === e.target.value);
              onSystemChange(selected ? selected.targetSystem : e.target.value);
            }}
          >
            <option value="">Notação livre</option>
            {sortedSystems.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {/* Sub-modo da familia (Year Zero: Genérico/Forbidden Lands/Alien/
            Walking Dead; Infaernum: acao/sim-ou-nao/ideias; Trophy: Dark/Gold). */}
        {activeFamily && (
          <label>
            Modo
            <select value={system} onChange={(e) => onSystemChange(e.target.value)}>
              {activeFamily.members.map((member) => (
                <option key={member.system} value={member.system}>
                  {member.subLabel}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <h3>
        <DiceSectionIcon />
        Dados (Slots de Cores)
      </h3>

      <div className="dice-slots-nav" role="tablist" aria-label="Slots de cores dos dados">
        <button
          type="button"
          role="tab"
          aria-selected={activeSlot === "1"}
          className={`dice-slot-btn${activeSlot === "1" ? " is-active" : ""}`}
          onClick={() => setActiveSlot("1")}
        >
          <span className="dice-slot-indicator" style={{ background: styles["1"].body }} />
          1 · Primário (Padrão)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSlot === "2"}
          className={`dice-slot-btn${activeSlot === "2" ? " is-active" : ""}`}
          onClick={() => setActiveSlot("2")}
        >
          <span className="dice-slot-indicator" style={{ background: styles["2"].body }} />
          2 · Secundário
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSlot === "3"}
          className={`dice-slot-btn${activeSlot === "3" ? " is-active" : ""}`}
          onClick={() => setActiveSlot("3")}
        >
          <span className="dice-slot-indicator" style={{ background: styles["3"].body }} />
          3 · Terciário
        </button>
      </div>

      {/* Previa com os 3 dados lado a lado no feltro. Clicar em qualquer dado seleciona o slot. */}
      <div className="dice-preview" aria-hidden>
        {(["1", "2", "3"] as const).map((slot) => {
          const s = styles[slot];
          const tex = DICE_TEXTURE_FILES[s.texture];
          const isSelected = activeSlot === slot;
          return (
            <div
              key={slot}
              className={`die-preview-container${isSelected ? " is-selected" : ""}`}
              onClick={() => setActiveSlot(slot)}
              title={`Configurar Cor ${slot}`}
              style={{ cursor: "pointer" }}
            >
              <div
                className={`die-preview ${slot === "1" ? "" : "die-preview-small"}`}
                style={{
                  background: s.body,
                  transform: `rotate(${slot === "1" ? -8 : slot === "2" ? 11 : -4}deg)`,
                  outline: isSelected ? "2px solid var(--accent, #38bdf8)" : undefined,
                  outlineOffset: "4px",
                }}
              >
                {tex !== null && (
                  <span
                    className="die-preview-tex"
                    style={{ backgroundImage: `url(/textures/${tex})` }}
                  />
                )}
                <span
                  className="die-preview-num"
                  style={{ color: s.number, textShadow: outlineShadow(s.outline) }}
                >
                  {slot === "1" ? "20" : slot === "2" ? "6" : "6"}
                </span>
              </div>
              <span className="die-preview-slot-badge">Cor {slot}</span>
            </div>
          );
        })}
      </div>
      <p className="settings-hint dice-preview-hint">
        Notação: use <code>1[3d6]</code>, <code>2[2d6]</code> ou <code>3[1d6]</code> para misturar cores na mesma rolagem.
      </p>

      <div className="settings-row">
        <label>
          Estilo
          <select
            value={activePreset?.id ?? ""}
            onChange={(e) => {
              const preset = DICE_PRESETS.find((p) => p.id === e.target.value);
              if (preset) handleCurrentStyleChange(preset.style);
            }}
          >
            {activePreset === undefined && (
              <option value="">Personalizado</option>
            )}
            {DICE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tamanho ({Math.round(diceScale * 100)}%)
          <input
            type="range"
            min={70}
            max={160}
            step={5}
            value={Math.round(diceScale * 100)}
            onChange={(e) => onDiceScaleChange(Number(e.target.value) / 100)}
          />
        </label>
      </div>

      <div className="settings-row">
        <label className="color-field">
          Corpo
          <input
            type="color"
            value={currentDiceStyle.body}
            onChange={(e) =>
              handleCurrentStyleChange({ ...currentDiceStyle, body: e.target.value })
            }
          />
        </label>
        <label className="color-field">
          Número
          <input
            type="color"
            value={currentDiceStyle.number}
            onChange={(e) =>
              handleCurrentStyleChange({ ...currentDiceStyle, number: e.target.value })
            }
          />
        </label>
        <label className="color-field">
          Contorno
          <input
            type="color"
            value={currentDiceStyle.outline}
            onChange={(e) =>
              handleCurrentStyleChange({ ...currentDiceStyle, outline: e.target.value })
            }
          />
        </label>
      </div>

      <div className="settings-row">
        <label>
          Textura
          <select
            value={currentDiceStyle.texture}
            onChange={(e) =>
              handleCurrentStyleChange({
                ...currentDiceStyle,
                texture: e.target.value as DiceTexture,
              })
            }
          >
            {DICE_TEXTURES.map((t) => (
              <option key={t} value={t}>
                {DICE_TEXTURE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Material
          <select
            value={currentDiceStyle.material}
            onChange={(e) =>
              handleCurrentStyleChange({
                ...currentDiceStyle,
                material: e.target.value as DiceMaterial,
              })
            }
          >
            {DICE_MATERIALS.map((m) => (
              <option key={m} value={m}>
                {DICE_MATERIAL_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="settings-hint">
        Textura é a estampa do corpo; material é o acabamento (brilho e
        reflexo). Vale só pros tiers 3D — o palco recarrega ao mudar.
      </p>

      <h3>
        <RenderIcon />
        Render
      </h3>
      <div className="settings-row">
        <label>
          Qualidade
          <select
            value={tier}
            onChange={(e) => onTierChange(e.target.value as QualityTier)}
          >
            {QUALITY_TIERS.map((t) => (
              <option key={t} value={t}>
                {QUALITY_TIER_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tema
          <select
            value={theme}
            onChange={(e) => onThemeChange(e.target.value as ThemeName)}
          >
            {THEMES.map((t) => (
              <option key={t} value={t}>
                {THEME_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h3>
        <CardsIcon />
        Baralho
      </h3>
      <div className="settings-row">
        <label>
          Curingas
          <select
            value={deckConfig.includeJokers ? "yes" : "no"}
            onChange={(e) =>
              onDeckConfigChange({ includeJokers: e.target.value === "yes" })
            }
          >
            <option value="no">Sem curinga</option>
            <option value="yes">Com 2 curingas</option>
          </select>
        </label>
        <label>
          Carta puxada
          <select
            value={deckConfig.removalMode}
            onChange={(e) =>
              onDeckConfigChange({
                removalMode: e.target.value as DeckConfig["removalMode"],
              })
            }
          >
            <option value="permanent">Some até reembaralhar</option>
            <option value="returns">Volta na hora (leitura)</option>
          </select>
        </label>
      </div>
      {deckConfig.removalMode === "permanent" && (
        <label>
          Monte vazio
          <select
            value={deckConfig.autoReshuffleOnEmpty ? "auto" : "manual"}
            onChange={(e) =>
              onDeckConfigChange({ autoReshuffleOnEmpty: e.target.value === "auto" })
            }
          >
            <option value="manual">Trava, espera reembaralhar</option>
            <option value="auto">Reembaralha sozinho</option>
          </select>
        </label>
      )}

      <h3>
        <StreamIcon />
        Stream
      </h3>
      <p className="settings-hint">
        Pro OBS, use Sala → "Copiar link pro OBS": uma URL só com os dados,
        fundo transparente (ou <code>&chroma=rrggbb</code> pra chroma key).
        O app normal sempre segue o tema.
      </p>
    </div>
  );
}
