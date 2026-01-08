import React from "react";
import { Mic, Check } from "lucide-react";
import "../../styles/VoiceoverOption.css";

function VoiceoverOption({ translator, isSelected, onSelect }) {
  return (
    <button
      type="button"
      className={
        "translator-item" + (isSelected ? " translator-item--selected" : "")
      }
      onClick={() => onSelect(translator.id)}
      aria-pressed={isSelected}
    >
      <span className="translator-item__left">
        <Mic size={16} className="translator-item__icon" />
        <span className="translator-item__name">{translator.name}</span>
      </span>

      <span className="translator-item__right">
        {isSelected ? (
          <span className="translator-item__check" aria-label="Обрано">
            <Check size={14} />
          </span>
        ) : (
          <span className="translator-item__hint">Обрати</span>
        )}
      </span>
    </button>
  );
}

export default VoiceoverOption;
