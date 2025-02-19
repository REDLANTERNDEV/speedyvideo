import "./styles/popup.css";
import speedyvideologo from "./assets/speedyvideo-dark.svg";
import githublogo from "./assets/github.svg";
import editlogo from "./assets/edit.svg";
import themelogo from "./assets/theme.svg";
import pinlogo from "./assets/pin.svg";
const Popup = () => {
  return (
    <div>
      <div className="header">
        <img className="left-icon" src={themelogo} alt="theme switch icon" />
        <img
          className="center-logo"
          src={speedyvideologo}
          alt="speedy video logo"
        />
        <div className="right-icons">
          <img src={pinlogo} alt="pin icon" />
          <img src={editlogo} alt="edit icon" />
        </div>
      </div>

      <div className="container">
        <button className="content">0.50</button>
        <button className="content">1.0</button>
        <button className="content">1.1</button>
        <button className="content">1.5</button>
        <button className="content">1.75</button>
        <button className="content">2.5</button>
      </div>
      <div className="footer">
        <img src={githublogo} alt="github logo icon" />
      </div>
    </div>
  );
};
export default Popup;
