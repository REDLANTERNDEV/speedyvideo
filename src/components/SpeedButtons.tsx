import { useState, useEffect } from "react";

const speeds = [0.5, 1.0, 1.1, 1.5, 1.75, 2.5];

function SpeedButtons() {
  const [elementSpeed, setElementSpeed] = useState(1.0);

  useEffect(() => {
    const savedSpeed = localStorage.getItem("selectedSpeed");
    if (savedSpeed) {
      setElementSpeed(parseFloat(savedSpeed));
    } else {
      localStorage.setItem("selectedSpeed", speeds.toString());
    }
  }, []);

  const handleClick = (speed: number) => {
    setElementSpeed(speed);
    console.log("Tıklanan hız:", speed);
  };

  return (
    <div className="container">
      {speeds.map((speed, index) => (
        <button
          key={index}
          className={`content ${speed === elementSpeed ? "active" : ""}`}
          onClick={() => handleClick(speed)}
        >
          {speed}
        </button>
      ))}
    </div>
  );
}

export default SpeedButtons;
