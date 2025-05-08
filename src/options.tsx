import { useEffect, useState, useRef } from "react";
import "./styles/options.css";
import { LogoSvg } from "./components/LogoSvg";
import { useTheme } from "./context/ThemeContext";

export default function Options({ onClose }: { readonly onClose: () => void }) {
  const [speedList, setSpeedList] = useState<string[]>([]);
  const { darkMode } = useTheme();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (chrome?.storage?.local) {
      chrome.storage.local.get(["defaultSpeedList"], (result) => {
        if (Array.isArray(result.defaultSpeedList)) {
          setSpeedList(
            result.defaultSpeedList.map((v: number) => v.toString())
          );
        }
      });
    }
    // else: skip storage access if not available
  }, []);

  // Save the current speedList to chrome.storage.local
  const handleSave = () => {
    // stringleri sayıya çevir, min/max uygula
    const parsedList = speedList.map((v) => {
      let num = parseFloat(v);
      if (isNaN(num)) num = 0.1;
      if (num > 16) num = 16;
      if (num < 0.1) num = 0.1;
      return parseFloat(num.toFixed(2));
    });
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ defaultSpeedList: parsedList }, () => {
        onClose();
      });
    } else {
      onClose();
    }
  };

  const handleSpeedChange = (
    idx: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = inputRefs.current[idx];
    const selectionStart = input?.selectionStart ?? 0;
    const newValue = e.target.value;
    setSpeedList((list) => list.map((v, i) => (i === idx ? newValue : v)));
    setTimeout(() => {
      const ref = inputRefs.current[idx];
      if (ref) {
        ref.setSelectionRange(selectionStart, selectionStart);
        ref.focus();
      }
    }, 0);
  };

  return (
    <div className="options-body">
      <div className="options-header">
        <div className="options-logo">
          <LogoSvg fillColor={darkMode ? "#FFFFFF" : "#000000"} />
        </div>
      </div>
      <div className="options-container">
        {speedList.map((speedValue, idx) => (
          <input
            key={`${speedValue}-${idx}`}
            type="text"
            data-speed={speedValue}
            className="options-content"
            value={speedValue}
            onChange={(e) => handleSpeedChange(idx, e)}
            inputMode="decimal"
            pattern="[0-9.]*"
            maxLength={5}
            ref={(el) => {
              inputRefs.current[idx] = el;
            }}
          />
        ))}
      </div>
      <div className="options-buttons">
        <button className="options-save-button" onClick={handleSave}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="23"
            height="19"
            viewBox="0 0 23 19"
            fill="none"
          >
            <path
              d="M22.0767 3.13687L22.0701 3.12937L19.8267 0.923434C19.4758 0.572734 19.0004 0.375332 18.5043 0.374454C18.0083 0.373575 17.5321 0.569291 17.1801 0.918747L8.74259 9.24656L5.56821 6.16687C5.21588 5.81836 4.7399 5.62351 4.24432 5.62492C3.74874 5.62632 3.27388 5.82387 2.92353 6.17437L0.673526 8.42437C0.322591 8.77591 0.125488 9.25234 0.125488 9.74906C0.125488 10.2458 0.322591 10.7222 0.673526 11.0737L7.3879 17.8237C7.56202 17.9979 7.76875 18.1361 7.99629 18.2304C8.22382 18.3247 8.4677 18.3732 8.71399 18.3732C8.96029 18.3732 9.20417 18.3247 9.4317 18.2304C9.65924 18.1361 9.86597 17.9979 10.0401 17.8237L22.0767 5.78812C22.4282 5.43651 22.6256 4.95968 22.6256 4.4625C22.6256 3.96531 22.4282 3.48849 22.0767 3.13687ZM8.71353 15.9684L2.52884 9.75L4.25009 8.02593L7.96728 11.625C8.17846 11.8296 8.46135 11.9433 8.75537 11.9419C9.04939 11.9405 9.33117 11.8241 9.5404 11.6175L18.5001 2.77593L20.2176 4.46343L8.71353 15.9684Z"
              fill="#F8F9FA"
            />
          </svg>
          Save
        </button>
        <button className="options-cancel-button" onClick={onClose}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
          >
            <path
              d="M14.7959 8.79594L12.5938 11L14.7988 13.2041C15.0101 13.4154 15.1288 13.7021 15.1288 14.0009C15.1288 14.2998 15.0101 14.5865 14.7988 14.7978C14.5874 15.0092 14.3008 15.1279 14.0019 15.1279C13.703 15.1279 13.4163 15.0092 13.205 14.7978L11 12.5938L8.79594 14.7987C8.5846 15.0101 8.29795 15.1288 7.99907 15.1288C7.70018 15.1288 7.41354 15.0101 7.20219 14.7987C6.99085 14.5874 6.87212 14.3008 6.87212 14.0019C6.87212 13.703 6.99085 13.4163 7.20219 13.205L9.40625 11L7.20407 8.79594C7.09942 8.69129 7.01641 8.56706 6.95977 8.43033C6.90314 8.2936 6.87399 8.14706 6.87399 7.99906C6.87399 7.70018 6.99272 7.41353 7.20407 7.20219C7.41541 6.99084 7.70206 6.87211 8.00094 6.87211C8.29983 6.87211 8.58647 6.99084 8.79782 7.20219L11 9.40625L13.2041 7.20125C13.4154 6.98991 13.7021 6.87117 14.0009 6.87117C14.2998 6.87117 14.5865 6.98991 14.7978 7.20125C15.0092 7.41259 15.1279 7.69924 15.1279 7.99813C15.1279 8.29701 15.0092 8.58366 14.7978 8.795L14.7959 8.79594ZM21.125 11C21.125 13.0025 20.5312 14.9601 19.4186 16.6251C18.3061 18.2902 16.7248 19.5879 14.8747 20.3543C13.0246 21.1206 10.9888 21.3211 9.02471 20.9305C7.06066 20.5398 5.25656 19.5755 3.84055 18.1595C2.42454 16.7435 1.46023 14.9393 1.06955 12.9753C0.678878 11.0112 0.879387 8.97543 1.64572 7.12533C2.41206 5.27523 3.70981 3.69392 5.37486 2.58137C7.0399 1.46882 8.99747 0.875 11 0.875C13.6844 0.877978 16.258 1.94567 18.1562 3.84383C20.0543 5.74199 21.122 8.3156 21.125 11ZM18.875 11C18.875 9.44247 18.4131 7.91992 17.5478 6.62488C16.6825 5.32985 15.4526 4.32049 14.0136 3.72445C12.5747 3.12841 10.9913 2.97246 9.46367 3.27632C7.93607 3.58017 6.53288 4.3302 5.43154 5.43153C4.3302 6.53287 3.58018 7.93606 3.27632 9.46366C2.97246 10.9913 3.12841 12.5747 3.72445 14.0136C4.32049 15.4526 5.32985 16.6825 6.62489 17.5478C7.91993 18.4131 9.44248 18.875 11 18.875C13.0879 18.8728 15.0896 18.0424 16.566 16.566C18.0424 15.0896 18.8728 13.0879 18.875 11Z"
              fill="#F8F9FA"
            />
          </svg>
          Cancel
        </button>
      </div>
    </div>
  );
}
