// Conteudo de Preferencias (renderizado dentro do modal pela App):
// aparencia dos dados, qualidade de render e tema visual. Dados vem
// primeiro: e a preferencia que o jogador mais mexe.

import type { SystemProfile } from "@rolai/rules-engine";
import type {
  DiceStyle,
  QualityTier,
  ThemeName,
} from "../settings";
import {
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

interface SettingsPanelProps {
  tier: QualityTier;
  theme: ThemeName;
  diceStyle: DiceStyle;
  diceScale: number;
  system: string;
  profiles: SystemProfile[];
  onTierChange: (tier: QualityTier) => void;
  onThemeChange: (theme: ThemeName) => void;
  onDiceStyleChange: (style: DiceStyle) => void;
  onDiceScaleChange: (scale: number) => void;
  onSystemChange: (system: string) => void;
}

// Contorno do numero na previa: sombra nas 4 direcoes com a cor escolhida.
function outlineShadow(color: string): string {
  return `-1px 0 0 ${color}, 1px 0 0 ${color}, 0 -1px 0 ${color}, 0 1px 0 ${color}`;
}

export function SettingsPanel({
  tier,
  theme,
  diceStyle,
  diceScale,
  system,
  profiles,
  onTierChange,
  onThemeChange,
  onDiceStyleChange,
  onDiceScaleChange,
  onSystemChange,
}: SettingsPanelProps) {
  const textureFile = DICE_TEXTURE_FILES[diceStyle.texture];
  const activePreset = DICE_PRESETS.find(
    (p) =>
      p.style.body === diceStyle.body &&
      p.style.number === diceStyle.number &&
      p.style.texture === diceStyle.texture &&
      p.style.material === diceStyle.material,
  );

  return (
    <div className="settings-panel">
      <h3>Sistema</h3>
      <label>
        Regras da mesa
        <select value={system} onChange={(e) => onSystemChange(e.target.value)}>
          <option value="">Notação livre</option>
          {profiles.map((p) => (
            <option key={p.system} value={p.system}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <h3>Dados</h3>
      {/* Previa com as MESMAS cores e textura (o proprio .webp estampado no
          dado 3D). Mudou algo com o modal aberto? O dado de verdade tambem
          rola no palco, atras da janela. */}
      <div className="dice-preview" aria-hidden>
        <div
          className="die-preview"
          style={{
            background: diceStyle.body,
            transform: `rotate(-8deg) scale(${diceScale})`,
          }}
        >
          {textureFile !== null && (
            <span
              className="die-preview-tex"
              style={{ backgroundImage: `url(/textures/${textureFile})` }}
            />
          )}
          <span
            className="die-preview-num"
            style={{ color: diceStyle.number, textShadow: outlineShadow(diceStyle.outline) }}
          >
            20
          </span>
        </div>
        <div
          className="die-preview die-preview-small"
          style={{
            background: diceStyle.body,
            transform: `rotate(11deg) scale(${diceScale})`,
          }}
        >
          {textureFile !== null && (
            <span
              className="die-preview-tex"
              style={{ backgroundImage: `url(/textures/${textureFile})` }}
            />
          )}
          <span
            className="die-preview-num"
            style={{ color: diceStyle.number, textShadow: outlineShadow(diceStyle.outline) }}
          >
            6
          </span>
        </div>
      </div>
      <p className="settings-hint dice-preview-hint">
        Mexeu em algo? O dado de verdade rola no palco, atrás desta janela.
      </p>

      <div className="settings-row">
        <label>
          Estilo
          <select
            value={activePreset?.id ?? ""}
            onChange={(e) => {
              const preset = DICE_PRESETS.find((p) => p.id === e.target.value);
              if (preset) onDiceStyleChange(preset.style);
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
            value={diceStyle.body}
            onChange={(e) =>
              onDiceStyleChange({ ...diceStyle, body: e.target.value })
            }
          />
        </label>
        <label className="color-field">
          Número
          <input
            type="color"
            value={diceStyle.number}
            onChange={(e) =>
              onDiceStyleChange({ ...diceStyle, number: e.target.value })
            }
          />
        </label>
        <label className="color-field">
          Contorno
          <input
            type="color"
            value={diceStyle.outline}
            onChange={(e) =>
              onDiceStyleChange({ ...diceStyle, outline: e.target.value })
            }
          />
        </label>
      </div>

      <div className="settings-row">
        <label>
          Textura
          <select
            value={diceStyle.texture}
            onChange={(e) =>
              onDiceStyleChange({
                ...diceStyle,
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
            value={diceStyle.material}
            onChange={(e) =>
              onDiceStyleChange({
                ...diceStyle,
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

      <h3>Render</h3>
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

      <h3>Stream</h3>
      <p className="settings-hint">
        Pro OBS, use Sala → "Copiar link pro OBS": uma URL só com os dados,
        fundo transparente (ou <code>&chroma=rrggbb</code> pra chroma key).
        O app normal sempre segue o tema.
      </p>
    </div>
  );
}
