import { useState, useEffect } from "react";
import { LogoSvg } from "./components/LogoSvg";
import "./styles/popup.css";
import SpeedButtons from "./components/SpeedButtons";
import PinButton from "./components/PinButton";
import ThemeButton from "./components/ThemeButton";

const Popup = () => {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }, [darkMode]);

  useEffect(() => {
    chrome.storage.local.get(["darkMode"], (result) => {
      if (result.darkMode) {
        setDarkMode(true);
      } else {
        setDarkMode(false);
      }
    });
  }, []);

  const toggleTheme = () => {
    if (darkMode) {
      setDarkMode(false);
      chrome.storage.local.set({ darkMode: false });
    } else {
      setDarkMode(true);
      chrome.storage.local.set({ darkMode: true });
    }
  };
  return (
    <div>
      <div className="header">
        <ThemeButton
          fillColor={darkMode ? "#FFFFFF" : "#000000"}
          onClick={toggleTheme}
        />
        <div className="center-logo">
          <LogoSvg fillColor={darkMode ? "#FFFFFF" : "#000000"} />
        </div>
        <div className="right-icons">
          <PinButton fillColor={darkMode ? "#FFFFFF" : "#000000"} />

          <div style={{ cursor: "pointer" }}>
            <svg
              width="25"
              height="23"
              viewBox="0 0 25 23"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M17.4613 14.9732L18.8502 13.5843C19.0673 13.3673 19.4449 13.5192 19.4449 13.8317V20.1426C19.4449 21.2928 18.5117 22.226 17.3615 22.226H2.08338C0.93318 22.226 0 21.2928 0 20.1426V4.86447C0 3.71427 0.93318 2.78109 2.08338 2.78109H13.9543C14.2625 2.78109 14.4187 3.15437 14.2017 3.37572L12.8128 4.76464C12.7477 4.82975 12.6609 4.86447 12.5654 4.86447H2.08338V20.1426H17.3615V15.2163C17.3615 15.1251 17.3962 15.0383 17.4613 14.9732ZM24.2583 6.21433L12.8605 17.6121L8.93682 18.0462C7.79965 18.1721 6.83174 17.2128 6.95762 16.067L7.39165 12.1433L18.7895 0.745459C19.7834 -0.248486 21.3893 -0.248486 22.379 0.745459L24.254 2.6205C25.2479 3.61444 25.2479 5.22472 24.2583 6.21433ZM19.97 7.5555L17.4483 5.03375L9.38388 13.1025L9.06704 15.9368L11.9013 15.6199L19.97 7.5555ZM22.7826 4.09623L20.9076 2.22119C20.7296 2.04323 20.4388 2.04323 20.2652 2.22119L18.924 3.56236L21.4458 6.08412L22.787 4.74294C22.9606 4.56065 22.9606 4.27418 22.7826 4.09623Z"
                fill={darkMode ? "#FFFFFF" : "#000000"}
              />
            </svg>
          </div>
        </div>
      </div>

      <SpeedButtons />
      <div className="footer">
        <a href="https://github.com/REDLANTERNDEV/speedyvideo" target="_blank">
          <svg
            width="25"
            height="25"
            viewBox="0 0 25 25"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.5 1.04166C9.49321 1.01111 6.59729 2.17563 4.4487 4.27929C2.30011 6.38296 1.07467 9.25363 1.04169 12.2604C1.05327 14.6366 1.81767 16.948 3.22509 18.8627C4.6325 20.7773 6.61051 22.1966 8.87502 22.9167C9.44794 23.0208 9.65627 22.6771 9.65627 22.375C9.65627 22.0729 9.65627 21.4062 9.65627 20.4687C6.46877 21.1458 5.79169 18.9687 5.79169 18.9687C5.5795 18.2853 5.12839 17.7011 4.52085 17.3229C3.47919 16.6354 4.60419 16.6458 4.60419 16.6458C4.96424 16.694 5.30872 16.823 5.6118 17.0232C5.91488 17.2235 6.16869 17.4898 6.35419 17.8021C6.67745 18.3626 7.20787 18.7738 7.83128 18.9472C8.4547 19.1206 9.12126 19.0423 9.68752 18.7292C9.74576 18.1587 10.0041 17.6273 10.4167 17.2292C7.87502 16.9479 5.20835 15.9896 5.20835 11.6875C5.18562 10.5653 5.60027 9.47824 6.3646 8.65625C6.01651 7.69278 6.05761 6.63157 6.47919 5.69791C6.47919 5.69791 7.44794 5.39583 9.60419 6.84375C11.4812 6.34358 13.4564 6.34358 15.3334 6.84375C17.5209 5.39583 18.4584 5.69791 18.4584 5.69791C18.8799 6.63157 18.921 7.69278 18.5729 8.65625C19.355 9.46317 19.7922 10.5429 19.7917 11.6667C19.7917 15.9792 17.1042 16.9271 14.5834 17.2083C14.8594 17.4763 15.0726 17.8021 15.2077 18.1624C15.3428 18.5226 15.3964 18.9083 15.3646 19.2917V22.3646C15.3646 22.3646 15.5729 23.0208 16.1459 22.9062C18.4039 22.1817 20.3753 20.762 21.7783 18.8501C23.1814 16.9382 23.9444 14.6319 23.9584 12.2604C23.9254 9.25363 22.6999 6.38296 20.5513 4.27929C18.4028 2.17563 15.5068 1.01111 12.5 1.04166Z"
              fill={darkMode ? "#FFFFFF" : "#000000"}
            />
          </svg>
        </a>
      </div>
    </div>
  );
};
export default Popup;
