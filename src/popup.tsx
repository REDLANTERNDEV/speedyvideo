import { useEffect, useState } from "react";
import { LogoSvg } from "./components/LogoSvg";
import "./styles/popup.css";
import SpeedButtons from "./components/SpeedButtons";
import PinButton from "./components/PinButton";
import ThemeButton from "./components/ThemeButton";
import EditButton from "./components/EditButton";
import Options from "./options";
import { useTheme } from "./context/ThemeContext";

const Popup = () => {
  const { darkMode, toggleTheme } = useTheme();
  const [showOptions, setShowOptions] = useState(false);
  const [elementSpeed, setElementSpeed] = useState(1.0);
  const [isPinned, setIsPinned] = useState(false);
  const [tabId, setTabId] = useState<number | null>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTabId = tabs[0]?.id;
      if (currentTabId) {
        setTabId(currentTabId);
        chrome.storage.local.get(
          [`pinnedSpeed_${currentTabId}`, "selectedSpeed"],
          (result) => {
            if (!result.selectedSpeed) {
              chrome.storage.local.set({ selectedSpeed: "1.0" });
            }
            if (result[`pinnedSpeed_${currentTabId}`] !== undefined) {
              setElementSpeed(
                parseFloat(result[`pinnedSpeed_${currentTabId}`])
              );
              setIsPinned(true);
            } else {
              setElementSpeed(
                result.selectedSpeed ? parseFloat(result.selectedSpeed) : 1.0
              );
              setIsPinned(false);
            }
          }
        );
      }
    });
  }, []);

  useEffect(() => {
    if (tabId !== null) {
      chrome.storage.local.get(
        [`pinnedSpeed_${tabId}`, "selectedSpeed"],
        (result) => {
          if (isPinned && result[`pinnedSpeed_${tabId}`] !== undefined) {
            setElementSpeed(parseFloat(result[`pinnedSpeed_${tabId}`]));
          } else {
            setElementSpeed(
              result.selectedSpeed ? parseFloat(result.selectedSpeed) : 1.0
            );
          }
        }
      );
    }
  }, [tabId, isPinned]);

  useEffect(() => {
    if (tabId !== null && elementSpeed) {
      chrome.tabs.sendMessage(tabId, {
        type: "UPDATE_SPEED",
        speed: elementSpeed,
      });
    }
  }, [elementSpeed, tabId]);

  if (showOptions) {
    return <Options onClose={() => setShowOptions(false)} />;
  }

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
          <PinButton
            fillColor={darkMode ? "#FFFFFF" : "#000000"}
            selectedSpeed={elementSpeed}
            setIsPinned={setIsPinned}
            setTabId={setTabId}
          />
          <EditButton
            onClick={() => setShowOptions(true)}
            fillColor={darkMode ? "#FFFFFF" : "#000000"}
          />
        </div>
      </div>
      <SpeedButtons
        elementSpeed={elementSpeed}
        setElementSpeed={setElementSpeed}
        isPinned={isPinned}
        tabId={tabId}
      />
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
