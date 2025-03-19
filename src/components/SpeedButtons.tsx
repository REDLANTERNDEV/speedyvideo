import { useState, useEffect } from "react";

const speedList = [
  { value: 0.5 },
  { value: 1.0 },
  { value: 1.1 },
  { value: 1.5 },
  { value: 2.5 },
  { value: 3.0 },
];

function SpeedButtons() {
  const [elementSpeed, setElementSpeed] = useState(1.0);
  useEffect(() => {
    chrome?.storage?.local?.get(["selectedSpeed"], (result) => {
      setElementSpeed(
        result.selectedSpeed ? parseFloat(result.selectedSpeed) : 1.0
      );
    });
  }, []);

  useEffect(() => {
    chrome?.storage?.local?.set({ selectedSpeed: elementSpeed.toString() });
  }, [elementSpeed]);

  const handleClick = (speed: number) => {
    setElementSpeed(speed);
    console.log("Tıklanan hız:", speed);
  };

  return (
    <div className="container">
      {speedList.map((speedValue, index) => (
        <button
          key={index}
          data-speed={speedValue.value.toFixed(2)}
          className={`content ${
            speedValue.value === elementSpeed ? "active" : ""
          }`}
          onClick={() => handleClick(speedValue.value)}
        >
          {speedValue.value.toFixed(2)}
        </button>
      ))}
    </div>
  );
}

export default SpeedButtons;
