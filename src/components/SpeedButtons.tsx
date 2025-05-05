import { useState, useEffect } from "react";

const defaultSpeedList = [0.5, 1.0, 1.1, 1.5, 2.0, 2.5, 3.0, 8.0, 16.0];

function SpeedButtons() {
  const [elementSpeed, setElementSpeed] = useState(1.0);
  const [speedList, setSpeedList] = useState<number[]>(defaultSpeedList);

  useEffect(() => {
    chrome?.storage?.local?.get(
      ["selectedSpeed", "defaultSpeedList"],
      (result) => {
        setElementSpeed(
          result.selectedSpeed ? parseFloat(result.selectedSpeed) : 1.0
        );
        setSpeedList(
          Array.isArray(result.defaultSpeedList) &&
            result.defaultSpeedList.length > 0
            ? result.defaultSpeedList
            : defaultSpeedList
        );
      }
    );
  }, []);

  useEffect(() => {
    chrome?.storage?.local?.set({ selectedSpeed: elementSpeed.toString() });
  }, [elementSpeed]);

  const handleClick = (speed: number) => {
    setElementSpeed(speed);
    console.log("Tıklanan hız:", speed);
  };

  useEffect(() => {
    chrome?.storage?.local?.set({ defaultSpeedList: speedList });
  }, [speedList]);

  return (
    <div className="container">
      {speedList.map((speedValue) => (
        <button
          key={speedValue}
          data-speed={speedValue.toFixed(2)}
          className={`content ${speedValue === elementSpeed ? "active" : ""}`}
          onClick={() => handleClick(speedValue)}
        >
          {speedValue.toFixed(2)}
        </button>
      ))}
    </div>
  );
}

export default SpeedButtons;
