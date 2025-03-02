import { useState, useEffect } from "react";

const speeds = [
  { value: 0.5, label: "0.5" },
  { value: 1.0, label: "1.0" },
  { value: 1.1, label: "1.1" },
  { value: 1.5, label: "1.5" },
  { value: 1.75, label: "1.75" },
  { value: 2.5, label: "2.5" },
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
      {speeds.map((speedObj, index) => (
        <button
          key={index}
          data-speed={speedObj.value}
          className={`content ${
            speedObj.value === elementSpeed ? "active" : ""
          }`}
          onClick={() => handleClick(speedObj.value)}
        >
          {speedObj.label}
        </button>
      ))}
    </div>
  );
}

export default SpeedButtons;
